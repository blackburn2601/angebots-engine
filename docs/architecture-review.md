# Architecture Review & Improvement Backlog

> Written 2026-06-08. Revisit when planning the next development sprint.

---

## Verdict

The foundation is solid and well-suited for the use case. A single Next.js binary covering frontend + backend + API in one docker-compose stack is exactly the right call for a per-customer self-hosted product. No Kubernetes, no API gateway, no message queue — just two containers per instance. A new customer can be deployed in 15 minutes.

The improvements below are refinements, not architectural rethinks.

---

## What is genuinely well-designed

| Decision | Why it's right |
|---|---|
| Per-customer docker-compose stack | Maximum isolation, minimal ops overhead, easy to hand off |
| Pure `runEngine()` function | Runs in browser (simulator), on server (API), and in tests — same code, three contexts |
| JSON config blob (`config_json`) | Adding a new field type or rule property requires zero DB migrations |
| Service layer | Pages and routes never touch Prisma directly — queries stay maintainable |
| Standalone Next.js output | Docker image contains only what's needed, no full `node_modules` |
| JWT sessions (no DB sessions) | No session table overhead, stateless, scales to multiple instances without Redis |

---

## Improvements — Prioritised

### Priority 1 — Duplicated API surface

**Problem:** Two nearly identical sets of route files exist:
- `/api/domains/[id]` — session cookie auth (used by the UI)
- `/api/v1/domains/[id]` — Bearer token auth (used by external clients)

Same logic, duplicated in two directories. Every bug fix or feature addition must be made twice. This is already ~20 route files doubled.

**Fix:** Create a unified auth middleware that accepts both mechanisms, delete `/api/` entirely, point the UI at `/api/v1/`:

```typescript
// src/lib/unified-auth.ts
export async function requireAnyAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const valid = await authenticateApiKey(authHeader);
    if (!valid) return null;
    return { type: "api_key" as const };
  }
  const session = await auth();
  if (!session?.user) return null;
  return { type: "session" as const, user: session.user };
}
```

Keep only `/api/v1/`. The browser UI uses it with the session cookie (which Next.js sends automatically). One route file per resource = single source of truth.

**Effort:** Medium — mechanical work, no logic changes.  
**Impact:** Halves the number of API route files, eliminates all sync bugs between the two surfaces.

---

### Priority 2 — `config_json` / `items_json` as `String` instead of Postgres `Json`

**Problem:** `Domain.config_json` and `Pricelist.items_json` are stored as `String` columns despite containing JSON. This means:
- Manual `JSON.parse()` / `JSON.stringify()` scattered throughout the codebase
- No native Postgres JSON indexing or querying
- `DomainService.parseConfig()` exists only to wrap a try/catch around `JSON.parse`

**Fix:** Migrate to Prisma's `Json` type which maps to PostgreSQL `jsonb`:

```prisma
// prisma/schema.prisma
model Domain {
  config_json  Json  @default("{\"felder\":[],\"parameter\":[],\"validierungen\":[],\"regelwerk\":[],\"komponenten\":[]}")
}

model Pricelist {
  items_json  Json  @default("[]")
}
```

Prisma returns the parsed object directly. All `JSON.parse(domain.config_json)` and `JSON.stringify(config)` calls in editors, services, and routes disappear. `DomainService.parseConfig()` becomes unnecessary.

**Migration required:** Yes — one Prisma migration that casts the existing string columns to `jsonb` using `ALTER TABLE ... ALTER COLUMN config_json TYPE jsonb USING config_json::jsonb`.

**Effort:** Medium — migration + search/replace of `JSON.parse`/`JSON.stringify` calls.  
**Impact:** Significant code cleanup, safer data storage, future-proof for JSON queries.

---

### Priority 3 — Password hash returned by service layer

**Problem:** `UserService.findAll()`, `findById()`, etc. return the full Prisma `User` model including the `password` hash. API routes manually exclude it — but only if the developer remembers. One forgotten exclusion leaks a bcrypt hash in an API response.

**Fix:** Exclude at the service layer using Prisma's `omit`:

```typescript
// src/services/UserService.ts
static findAll() {
  return prisma.user.findMany({
    orderBy: { erstellt_am: "asc" },
    omit: { password: true },
  });
}
```

Apply to all `UserService` methods. The guarantee lives in one place, not scattered across route files.

**Effort:** Small.  
**Impact:** Security hygiene — eliminates an entire class of accidental data exposure.

---

### Priority 4 — `muss_pw_aendern` flag not enforced

**Problem:** The JWT carries `muss_pw_aendern: boolean`, it's set to `true` when an admin creates a user — but nothing actually redirects the user to change their password. The flag is stored, transported in the token, and then ignored.

**Fix:** Add a check in `src/app/(app)/layout.tsx`:

```typescript
const user = await requireAuth();
if (user.muss_pw_aendern) {
  redirect("/settings/profile?force=true");
}
```

The profile page already shows the password change form — it just needs to explain why the user is there and block navigation away until the password is changed.

**Effort:** Small.  
**Impact:** Closes a real security gap — admins can create accounts but can't force a password change.

---

### Priority 5 — In-memory API rate limiter inconsistency

**Problem:** `src/lib/api-rate-limit.ts` (for `/api/v1/*`) is in-memory — resets on restart, not shared across multiple app instances. The login rate limiter (`src/lib/rate-limit.ts`) correctly uses the DB and survives restarts.

**Fix options:**
- **Option A (simple):** Keep it as-is, add a comment documenting the limitation. Acceptable for single-instance deployments.
- **Option B (consistent):** Rewrite to use the `ApiLog` table, same pattern as the login limiter. No new infrastructure needed.

**Effort:** Small.  
**Impact:** Consistency; important if the app is ever run with multiple replicas.

---

## Minor items

| Item | Fix | Effort |
|---|---|---|
| `prisma/dev.db` committed to repo | Add `prisma/*.db` to `.gitignore`, remove file with `git rm --cached` | Trivial |
| `WebhookUrl` table has no dispatch logic | Either implement webhook firing on domain save, or remove the table until it's needed | Medium |
| `ts-node` for DB seeding | Replace with `tsx` (`npx tsx prisma/seed.ts`) — faster, simpler, no extra `tsconfig` flags | Trivial |
| NextAuth v5 beta `(user as any)` casts | Track the stable NextAuth v5 release and remove casts | Small, timing-dependent |

---

## What does NOT need changing

- **Per-customer docker-compose** — correct level of simplicity for this product
- **No Redis / no queue / no microservices** — appropriate for the scale and customer profile
- **JSON config blob** — right call; relational tables for domain config would be far worse
- **Prisma** — correct choice, no reason to change
- **`runEngine()` as a pure function** — keep this, it's the best design decision in the codebase
