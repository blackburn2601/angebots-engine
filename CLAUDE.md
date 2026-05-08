@AGENTS.md

# Angebots-Engine

A Next.js 16 (App Router) application for building configurable pricing/offer domains with a visual rules engine, headless REST API, and multi-role access control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 18, TypeScript) |
| Database | PostgreSQL 16 via Prisma 5 ORM |
| Auth | NextAuth v5 (beta) — JWT sessions, Credentials provider |
| UI | Tailwind CSS v4, Radix UI, shadcn-style components |
| Forms | react-hook-form + zod v4 |
| Charts | Recharts |
| Tests | Vitest 4 (node environment) |
| Dev DB | Docker (`postgres:16-alpine` on port 5432) |

---

## Architecture

Three-layer design — see `docs/architecture.md` for the full diagram.

```
UI (app/(app)/**)  →  Service Layer (src/services/*)  →  Prisma / engine.ts
External clients   →  REST API v1 (app/api/v1/**)     →  Service Layer
```

**Key invariant:** Neither pages nor API routes import Prisma directly — all DB access goes through a service class.

### Services (`src/services/`)

| Service | Responsibility |
|---|---|
| `DomainService` | CRUD for domains; parses `config_json` |
| `PricelistService` | CRUD for price lists; parses `items_json` |
| `UserService` | CRUD for users; password hashing |
| `ApiKeyService` | Key generation (`eak_live_…`), bcrypt hashing, revocation |
| `EngineService` | Loads domain config, delegates to `engine.ts` |
| `DashboardService` | Role-aware aggregate stats |
| `WebhookService` | CRUD for webhook URLs |

### Rules Engine (`src/lib/engine.ts`)

Pure TypeScript function — zero framework imports, never touched by infra/API changes.

```typescript
runEngine(config: DomainConfig, eingaben: FieldValues, preisItems: PreisItem[]): SimulatorResult
```

Four stages in order:
1. **Output field resolution** — multi-pass fixed-point iteration over `RegelGruppe` entries
2. **Formula evaluation** — `evaluateFormula` with `isSafeFormula` allowlist (prevents code injection, uses `new Function()` in sandboxed scope). Allowed: arithmetic, `Math.{round,floor,ceil,min,max,abs,pow,sqrt}`
3. **Validations** — evaluates `Validierung` (single `Bedingung`) and `BedingungsGruppe` (AND/OR compound), runs after formulas
4. **Component resolution** — activates `Komponente` entries via `AktivierungsRegel`, resolves `Variante`, recurses into `abhaengigkeiten`

Types contract: `src/types/domain.ts` — the engine's only external dependency.

---

## REST API v1 (`src/app/api/v1/`)

All routes:
- Auth: session cookie **or** `Authorization: Bearer eak_live_<key>`
- Success: `{ data: ... }` — uses helpers from `src/lib/api-response.ts` (`ok`, `created`, `apiError`)
- Error: `{ error: "...", code?: "..." }`
- CORS: `/api/v1/**` — configurable via `ALLOWED_ORIGIN` env var (default `*`)

**Primary integration endpoint:** `POST /api/v1/domains/:id/run`
Accepts `{ inputs: Record<string,unknown>, preis_items?: PreisItem[] }`, returns `SimulatorResult`.

### Route Map

```
/api/v1/domains           GET, POST
/api/v1/domains/:id       GET, PATCH, DELETE
/api/v1/domains/:id/duplicate  POST
/api/v1/domains/:id/run   POST  ← engine endpoint

/api/v1/pricelists        GET, POST
/api/v1/pricelists/:id    GET, PATCH, DELETE

/api/v1/users             GET, POST
/api/v1/users/:id         GET, PATCH, DELETE

/api/v1/api-keys          GET, POST
/api/v1/api-keys/:id      DELETE

/api/v1/admin/logs        GET
/api/v1/admin/webhooks    GET, POST
/api/v1/admin/webhooks/:id  PATCH, DELETE

/api/v1/dashboard/stats   GET
```

Legacy routes without versioning exist under `/api/` (non-v1) — prefer v1 for new work.

---

## Authentication & Roles

NextAuth v5, JWT strategy, 8-hour session lifetime.  
`requireAuth()` / `requireRole(...roles)` in `src/lib/auth-helpers.ts` used in server components and API routes.

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | Everything — users, API keys, domains, pricelists, admin |
| `DOMAIN_ADMIN` | Domains and pricelists |
| `SELLER` | Configurator (read-only engine use) |

API keys: bcrypt-hashed, prefix `eak_live_` stored in plaintext for display. Auth via `src/lib/api-key-auth.ts`.

Login rate-limiting: 5 failed attempts per IP per 15 min (`src/lib/rate-limit.ts`, stored in `LoginAttempt` table).

---

## Database Models (PostgreSQL)

| Model | Purpose |
|---|---|
| `User` | App users with `rolle`, `aktiv`, `muss_pw_aendern` |
| `Account` / `Session` / `VerificationToken` | NextAuth adapter tables |
| `Domain` | Offer domains; `config_json` stores full `DomainConfig` as string |
| `Pricelist` | Price lists; `items_json` stores `PreisItem[]` as string |
| `DomainPricelist` | M:N join — domains ↔ pricelists |
| `ApiKey` | Hashed API keys with prefix and last-access tracking |
| `ApiKeyLog` | Per-request logs per API key |
| `ApiLog` | Full HTTP request/response log for v1 routes |
| `LoginAttempt` | IP-based brute-force tracking |
| `WebhookUrl` | Configurable webhook endpoints |
| `AppSetting` | Key-value store for runtime config |

`config_json` / `items_json` are stored as `String` (not Prisma `Json`) to keep the engine fully decoupled from the ORM.

---

## UI Pages (`src/app/(app)/`)

| Route | Purpose |
|---|---|
| `/dashboard` | Stats overview |
| `/domains` | List / create domains |
| `/domains/[id]/fields` | Field editor |
| `/domains/[id]/rules` | Rules editor |
| `/domains/[id]/validations` | Validation editor |
| `/domains/[id]/components` | Component editor |
| `/domains/[id]/form` | Form editor |
| `/domains/[id]/simulator` | Live engine simulator |
| `/pricelists` | List / create price lists |
| `/pricelists/[id]` | Pricelist editor |
| `/configurator` | Domain selector |
| `/configurator/[domain_id]` | Interactive configurator |
| `/admin/api-keys` | API key management |
| `/admin/users` | User management |
| `/admin/logs` | API log viewer |
| `/admin/webhooks` | Webhook URL management |
| `/admin/config` | App settings viewer |
| `/settings/profile` | User profile |
| `/docs` | API docs |

---

## Dev Setup

```bash
# 1. Start Postgres
docker compose up -d

# 2. Copy env and set DATABASE_URL to postgres (not SQLite)
cp .env.example .env
# DATABASE_URL="postgresql://angebots:secret@localhost:5432/angebots_engine"

# 3. Run migrations and seed
npm run db:migrate
npm run db:seed

# 4. Start dev server
npm run dev
```

### Scripts

| Script | Action |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (single run) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage (v8, targets `engine.ts` + services) |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Seed admin user from env vars |
| `npm run db:push` | Prisma db push (no migration file) |

---

## Testing

Vitest in node environment. Tests live in `src/__tests__/`.

- `engine.test.ts` — comprehensive unit tests for all engine stages (formula, conditions, output rules, validations, freitext, components)
- `services/domain.service.test.ts` — DomainService integration tests
- `helpers/db.ts` — shared DB helpers for tests

Coverage is configured for `src/lib/engine.ts` and `src/services/**/*.ts`.

CI runs on GitHub Actions (`.github/workflows/ci.yml`).

---

## Security Headers

Set globally in `next.config.mjs`:
`X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS`, `Permissions-Policy`.

---

## Docs

- `docs/architecture.md` — full layer diagram and design principles
- `docs/migration-plan-postgres.md` — SQLite → PostgreSQL migration notes
- `docs/migration-plan-php-symfony.md` — future PHP/Symfony migration planning
