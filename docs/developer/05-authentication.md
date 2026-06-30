# Authentication & Authorization

## Overview

The application uses two separate authentication mechanisms:

| Mechanism | Used for | Implementation |
|---|---|---|
| **Session cookie (JWT)** | Browser users (login form) | NextAuth v5 Credentials provider |
| **Bearer token (API key)** | External API clients | Custom bcrypt verification |

---

## Browser Authentication — NextAuth

### Configuration

Located at `src/lib/auth.ts`.

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },  // 8 hours
  pages: { signIn: "/login" },
  providers: [ Credentials({ ... }) ],
  callbacks: { jwt, session }
});
```

### Login flow

1. User submits email + password on `/login`
2. `loginSchema.safeParse()` validates input with Zod
3. `checkRateLimit(ip)` checks if the IP has too many recent failed attempts (5 in 15 min)
4. `prisma.user.findUnique({ where: { email } })` — find user
5. Check `user.aktiv` — blocked users cannot log in
6. `bcrypt.compare(password, user.password)` — verify password
7. On success: update `letzter_login`, record success attempt
8. NextAuth issues a **JWT** stored in a cookie
9. The JWT payload contains: `id`, `email`, `name`, `rolle`, `muss_pw_aendern`

### JWT and Session structure

After login, the session carries:

```typescript
session.user = {
  id: string,          // User CUID
  email: string,
  name: string,
  rolle: "SUPER_ADMIN" | "DOMAIN_ADMIN" | "SELLER",
  muss_pw_aendern: boolean,
}
```

The `rolle` and `muss_pw_aendern` fields are custom — they are added in the `jwt` callback and then copied to the `session` callback.

### Route handler

`src/app/api/auth/[...nextauth]/route.ts` exports the NextAuth GET and POST handlers. These handle the login form POST, session cookie issuance, and sign-out.

### Protecting pages

`src/lib/auth-helpers.ts` provides two functions:

```typescript
// Redirects to /login if not authenticated
const user = await requireAuth();

// Redirects to / if authenticated but not in the required roles
const user = await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
```

Both are called at the top of Server Component page functions (they are async server-side calls).

---

## API Key Authentication

### How keys work

1. `ApiKeyService.create(label)` generates a random key:
   - Format: `eak_live_<48 random hex chars>` (65 chars total)
   - Hashed with bcrypt (cost 10) → stored in `ApiKey.key_hash`
   - First 17 chars stored in `ApiKey.key_prefix` (for fast lookup)
2. The raw key is returned to the user **once only**
3. On every API call, `authenticateApiKey(authHeader)` verifies it:
   ```typescript
   const prefix = rawKey.slice(0, 17);
   const candidates = await prisma.apiKey.findMany({
     where: { key_prefix: prefix, aktiv: true }
   });
   for (const candidate of candidates) {
     if (await bcrypt.compare(rawKey, candidate.key_hash)) { ... }
   }
   ```
4. On success, `letzter_zugriff` is updated

### Using API keys in requests

```http
GET /api/v1/domains
Authorization: Bearer eak_live_abc123...
```

---

## Authorization — User Roles

Three roles exist:

| Role | Level | Access |
|---|---|---|
| `SUPER_ADMIN` | Full access | Everything including users, API keys, config, logs |
| `DOMAIN_ADMIN` | Manager | Domains, pricelists, webhooks (no users/API keys/config) |
| `SELLER` | Read + use | Dashboard, domains (read), configurator |

Role is stored as a plain string in `User.rolle`. Helper functions in `auth-helpers.ts`:

```typescript
canManageUsers(rolle)       // SUPER_ADMIN only
canManageApiKeys(rolle)     // SUPER_ADMIN only
canManageDomains(rolle)     // SUPER_ADMIN or DOMAIN_ADMIN
canManagePricelists(rolle)  // SUPER_ADMIN or DOMAIN_ADMIN
canUseConfigurator(rolle)   // All roles
```

The sidebar in `src/components/layout/sidebar.tsx` uses `item.roles` to hide menu items for lower-privileged users. **This is UI-only filtering** — all role checks are re-enforced server-side in page layouts and API routes.

---

## Login Rate Limiting

Implemented with database persistence in `src/lib/rate-limit.ts`.

- **Limit**: 5 failed attempts within 15 minutes per IP
- **Storage**: `LoginAttempt` table (indexed on `ip + zeitstempel`)
- **Reset**: Automatic on successful login (only new attempts are counted)
- **Cleanup**: Records older than 24 hours are deleted on each attempt

This is a simple persistence-based limiter — it works across server restarts and in multi-instance deployments (since it uses the shared DB).

---

## API Rate Limiting

`src/lib/api-rate-limit.ts` provides a lightweight **in-memory** rate limiter for the external API.

> Note: This is in-memory, meaning it resets on server restart and is not shared across multiple Node.js instances. For production multi-instance deployments, replace with a Redis-backed limiter.

---

## Password handling

- Passwords hashed with **bcrypt** at cost 12 (user creation/update)
- API keys hashed at cost 10 (slightly faster, since keys are longer)
- `UserService.update()` automatically re-hashes when a new `password` is provided and sets `muss_pw_aendern = false`
- Newly created users get `muss_pw_aendern = true` — the frontend should enforce a password change (the flag is in the JWT)

---

## Session lifetime

JWT sessions expire after **8 hours** (`maxAge: 8 * 60 * 60`). After expiry the user is redirected to `/login` on the next page load or API call.
