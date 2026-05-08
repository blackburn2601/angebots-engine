# Architecture Overview

## Principles

The application follows three design principles:

1. **API-first** — all business logic lives in the service layer and is reachable via the REST API. The UI is one consumer of that API, not the source of truth.
2. **Headless-ready** — `/api/v1/` routes expose the full capability surface with versioning and CORS so that external tools (n8n, custom frontends, etc.) can integrate without touching the UI.
3. **Rules engine isolation** — `src/lib/engine.ts` is a pure TypeScript function with zero framework dependencies. It is never modified by infrastructure or API changes.

---

## Layers

```
┌─────────────────────────────────────────────────────┐
│  UI Layer (Next.js Server Components + Client Components)
│  app/(app)/**                                        │
└────────────────────┬────────────────────────────────┘
                     │ calls directly (no HTTP)
┌────────────────────▼────────────────────────────────┐
│  Service Layer                                       │
│  src/services/                                       │
│  DomainService  PricelistService  UserService        │
│  ApiKeyService  EngineService  DashboardService      │
│  WebhookService                                      │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
┌──────────▼──────────┐  ┌───────▼──────────────────┐
│  Prisma ORM         │  │  Rules Engine             │
│  PostgreSQL 16      │  │  src/lib/engine.ts        │
└─────────────────────┘  └───────────────────────────┘

External clients (n8n, other systems):
┌─────────────────────────────────────────────────────┐
│  REST API v1                                         │
│  app/api/v1/**                                       │
│  CORS-enabled, versioned, Bearer token auth          │
└────────────────────┬────────────────────────────────┘
                     │ calls
         Service Layer (same as above)
```

---

## Service Layer

All Prisma queries are encapsulated in static service classes under `src/services/`. Neither Server Component pages nor API routes import Prisma directly — they go through a service.

This means:
- Business logic is tested and changed in one place
- API routes and pages always return consistent data
- Swapping the underlying database or ORM is isolated to the service layer

### Services

| Service | Responsibility |
|---|---|
| `DomainService` | CRUD for domains, parsing `config_json` |
| `PricelistService` | CRUD for price lists, parsing `items_json` |
| `UserService` | CRUD for users, password hashing |
| `ApiKeyService` | API key generation (raw), hashing, revocation |
| `EngineService` | Loads domain config, delegates to `engine.ts` |
| `DashboardService` | Role-aware aggregate stats |
| `WebhookService` | CRUD for webhook URLs |

---

## REST API v1

Routes live under `src/app/api/v1/`. All routes:

- Require authentication (session cookie **or** `Authorization: Bearer ae_live_<key>`)
- Return `{ data: ... }` on success or `{ error: "...", code?: "..." }` on failure
- Use the helpers in `src/lib/api-response.ts` (`ok`, `created`, `apiError`)

CORS headers for `/api/v1/` are configured in `next.config.mjs` via `ALLOWED_ORIGIN` env variable (default `*`).

### Engine endpoint

`POST /api/v1/domains/:id/run` is the primary integration point for external tools. It accepts field inputs and optional price items, runs the full rules engine, and returns the `SimulatorResult`.

Example use cases:
- n8n workflow triggers the engine after a customer fills a form
- External frontend embeds the configurator and posts inputs to get live pricing
- Automated testing of domain configurations

---

## Rules Engine

`src/lib/engine.ts` exports a single pure function:

```typescript
runEngine(
  config: DomainConfig,
  eingaben: FieldValues,
  preisItems: PreisItem[]
): SimulatorResult
```

### Four stages

1. **Output field resolution** — multi-pass evaluation of `RegelGruppe` conditions; each pass resolves output fields whose dependencies are already resolved. Continues until no new fields are resolved (fixed-point iteration).

2. **Formula evaluation** — `evaluateFormula` parses formulas from `Datenfeld.formel`. Uses an `isSafeFormula` allowlist to prevent arbitrary code execution, then evaluates via `new Function()` in a sandboxed scope.

3. **Validations** — evaluates `Validierung` entries (single `Bedingung`) and `BedingungsGruppe` (compound AND/OR). Returns typed `error` or `warning` messages.

4. **Component resolution** — evaluates `Komponente` activation rules (`AktivierungsRegel`), resolves the active `Variante`, and calculates pricing against `PreisItem` entries.

### Invariants

- `engine.ts` has zero imports from `prisma`, `next`, or any other framework
- `domain.ts` type definitions are the engine's only contract with the rest of the app
- Neither file is modified by API, database, or UI changes — ever

---

## Database

PostgreSQL 16 is used in all environments. The local development setup uses Docker:

```bash
docker compose up -d   # starts postgres:16-alpine on port 5432
```

The Prisma schema stores domain configurations and price list items as JSON strings (`config_json`, `items_json`). Keeping these as `String` rather than Prisma's `Json` type avoids runtime changes in the parsing layer and keeps `engine.ts` decoupled from the ORM.

---

## Deployment

The application is packaged as a Docker image using Next.js's `output: "standalone"` mode, which produces a minimal self-contained bundle (~200 MB) rather than copying the full `node_modules` tree.

### Per-customer isolation

Each customer runs an independent `docker compose` stack:

```
server
├── customer-a/
│   ├── docker-compose.yml   → next-app (port 3001) + postgres (internal)
│   └── .env                 → own NEXTAUTH_SECRET, POSTGRES_PASSWORD, NEXTAUTH_URL
├── customer-b/
│   ├── docker-compose.yml   → next-app (port 3002) + postgres (internal)
│   └── .env
└── reverse proxy            → routes *.domain.com → correct APP_PORT
```

This gives each customer full data isolation (separate PostgreSQL volume), independent restarts and upgrades, and straightforward per-customer backup/restore.

### Startup sequence

`docker-entrypoint.sh` runs on every container start:

1. `prisma migrate deploy` — applies any pending migrations (idempotent, safe on restart)
2. `node server.js` — starts the Next.js standalone server

### Build pipeline

```
deps stage    → npm ci
builder stage → prisma generate + next build
runner stage  → standalone output + prisma client binary + migrations folder
```

Prisma's native query engine binary (`.prisma/client/`) and the CLI (`prisma/build/index.js`) are copied explicitly into the runner stage because Next.js's file tracer does not pick up native `.node` binaries automatically.

---

## Authentication

NextAuth v5 (beta) with the Credentials provider. Session tokens are JWTs. Role (`SUPER_ADMIN`, `DOMAIN_ADMIN`, `SELLER`) is embedded in the JWT and checked server-side via `requireRole()` in `src/lib/auth-helpers.ts`.

API key authentication hashes keys with bcrypt before storage. Only the prefix (`eak_live_xxxx`) is stored in plaintext for display purposes.
