<div align="center">

# Angebots-Engine

**Konfigurierbare Angebots- und Kalkulationsengine** — define fields, formulas, rules, and
priced components once per domain; a visual rules engine and a headless REST API do the rest.

[![CI](https://github.com/blackburn2601/angebots-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/blackburn2601/angebots-engine/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000000)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

</div>

---

## About

Pricing a configurable product — a carport, a solar install, a custom fit-out — usually means a
spreadsheet, a PDF, and a sales rep who is the only one who really understands the formula. This
engine turns that logic into data: a **domain** holds a set of **fields** (inputs, formulas,
outputs), a **rule engine** that resolves them, **validations**, and **components** that map the
result onto priced articles. Sales staff get a guided configurator; admins get a visual editor;
external systems get a REST endpoint that runs the exact same engine.

> **Note on provenance.** This is a sanitised, self-contained extract of a quoting/pricing
> platform built for both B2B and B2C clients across several trades. Client branding, real
> pricing data and production configuration have been removed and replaced with a neutral
> identity and a generated demo domain (a carport configurator). The architecture, the rules
> engine and the service layer are the real thing — one codebase, deployed as an isolated
> `docker compose` stack per customer.

## Screenshots

|  |  |
|:--:|:--:|
| ![Login](docs/screenshots/login.jpg) | ![Dashboard](docs/screenshots/dashboard.jpg) |
| **Login** | **Dashboard** — domains, price lists, and API activity at a glance |
| ![Fields](docs/screenshots/fields.jpg) | ![Rules](docs/screenshots/rules.jpg) |
| **Felder** — define input, formula, and output fields per domain | **Regelwerk** — visual if/then rules resolving an output field |
| ![Simulator](docs/screenshots/simulator.jpg) | ![Pricelist](docs/screenshots/pricelist.jpg) |
| **Live-Simulator** — test a configuration in the browser, no quote created | **Preisliste** — articles priced against engine components |

<div align="center">
<img src="docs/screenshots/configurator.jpg" alt="Sales configurator" width="70%">
<br><em><strong>Konfigurator</strong> — the sales-facing form, with a live offer preview as fields change</em>
</div>

## Features

- **Domains** — self-contained configuration areas (e.g. photovoltaics, carports, roofing)
- **Fields** — numbers, text, dropdowns, booleans, formula fields, and output fields
- **Rules engine** — condition-based value assignment with AND/OR logic, plus a full execution **trace** for every run
- **Validations** — field-level error and warning rules, including field-to-field comparisons
- **Components** — link calculation results to price list articles for automatic costing
- **Price lists** — manage articles with purchase prices; CSV import supported
- **Simulator** — test any configuration live without creating a real quote
- **Domain health check** — per-domain dashboard that flags incomplete configuration
- **Configurator** — sales-facing UI for creating quotes in a few clicks
- **REST API v1** — single headless API surface with CRUD and engine execution, used by both the UI and external integrations
- **API request log** — every `/api/v1` request is persisted and browsable in the admin panel
- **Webhooks** — configurable outbound webhook URLs
- **Role-based access** — Super Admin, Domain Admin, Seller
- **Documentation** — end-user guide at `/docs`, full developer documentation at `/docs/developer`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 18) |
| Language | TypeScript 5 |
| Auth | NextAuth v5 (beta) — credentials + JWT |
| Database | PostgreSQL 16 via Docker + Prisma 6 ORM |
| Styling | Tailwind CSS v4 + shadcn-style components (Radix UI) |
| Forms / validation | react-hook-form + zod v4 |
| Charts | Recharts |
| Tests | Vitest 4 (node environment) — 54 tests across the engine and service layer |

---

## Requirements

- Node.js 20+ (CI builds on Node 26)
- npm 9+
- Docker (for PostgreSQL — both the dev and the test database)

---

## Setup

### 1. Clone the repository

```bash
git clone git@github.com:blackburn2601/angebots-engine.git
cd angebots-engine
```

### 2. Install dependencies

```bash
npm install
```

`postinstall` runs `prisma generate` and `scripts/gen-developer-docs.mjs` (which bundles
`docs/developer/*.md` into `src/generated/developer-docs.ts` for the in-app viewer).

### 3. Configure environment variables

```bash
cp .env.example .env
```

The defaults work for local development as-is. `docker compose` **requires** `POSTGRES_PASSWORD`,
`NEXTAUTH_SECRET`, and `NEXTAUTH_URL` to be set — so create `.env` before starting the containers.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection — `postgresql://angebots:secret@localhost:5544/angebots_engine` for local Docker |
| `POSTGRES_PORT` | Host port Postgres is published on (default `5544`) — must match the port in `DATABASE_URL` |
| `NEXTAUTH_SECRET` | Random string, min 32 characters |
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Email for the initial Super Admin account |
| `SEED_ADMIN_PASSWORD` | Password for the initial Super Admin account |
| `SEED_ADMIN_NAME` | Display name for the initial Super Admin account |
| `ALLOWED_ORIGIN` | Allowed CORS origin for `/api/v1/` (default: `*`) |

> **Ports:** the dev database is published on **5544**, not the default 5432, to avoid clashing
> with other local Postgres instances and with the disposable test DB (which uses **5433**).

### 4. Start the database

```bash
docker compose up -d postgres
```

This starts only the PostgreSQL 16 container with persistent storage. (`docker compose up -d`
without a service name would also build and start the production app container — not what you
want for local development.)

### 5. Apply the schema and seed

```bash
npm run db:migrate   # prisma migrate dev
npm run db:seed      # creates the Super Admin from SEED_ADMIN_* in .env
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials from your `.env`.

> The dev server runs with `--webpack` on purpose. The bundled Turbopack version has a panic bug
> that causes infinite page reloads — see `docs/developer/12-debugging.md`.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (Webpack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once (auto-starts the test DB) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Coverage report (v8) |
| `npm run test:db:up` | Start the disposable test database |
| `npm run test:db:down` | Stop and remove the test database |
| `npm run db:push` | Push Prisma schema without migrations (prototype) |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:seed` | Seed the initial admin user |
| `npm run gen:dev-docs` | Regenerate the bundled developer docs module |
| `npm run build:seed` | Compile `prisma/seed.ts` to `dist/seed/seed.js` (used by the Docker image) |

`predev`, `prebuild`, and `postinstall` regenerate the developer docs automatically;
`pretest` hooks start the test database.

---

## Points of interest

If you are reading the code to judge it, these are the parts worth your time:

- **[`src/lib/engine.ts`](src/lib/engine.ts)** — the core engine. A pure function with zero
  framework imports: multi-pass fixed-point resolution of output fields, a formula evaluator
  sandboxed through `isSafeFormula` before it ever reaches `new Function()`, then validations,
  then component activation. It runs unchanged in the browser simulator, on the server, and in
  tests.
- **[`isSafeFormula` / `evaluateFormula`](src/lib/engine.ts)** — user-authored formulas are
  arbitrary strings from a config editor. Before evaluation they're checked against an allowlist
  (arithmetic and a fixed `Math.*` set) so `new Function()` never sees anything outside that
  grammar — the actual defence against injecting arbitrary JS through a rule.
- **Trace types** (top of `engine.ts`) — every rule, condition, formula, and component activation
  can be captured as structured trace data and persisted (`EngineLog`), so a support engineer can
  replay exactly why a quote came out the way it did instead of re-deriving it from the config.
- **[`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)** — IP-based login throttling backed by a
  `LoginAttempt` table rather than in-memory state, so it survives restarts and works across
  multiple instances.
- **[`src/lib/api-key-auth.ts`](src/lib/api-key-auth.ts)** — API keys are bcrypt-hashed at rest;
  only a display prefix (`eak_live_…`) is kept in plaintext.
- **[`src/services/`](src/services/)** — the only layer allowed to import Prisma. Worth reading
  as a set: the same service methods back both the authenticated UI and the external
  `/api/v1` routes, so the two surfaces can never drift apart.

---

## Testing

Vitest runs in the `node` environment; tests live in `src/__tests__/`.

| Test | Scope |
|---|---|
| `engine.test.ts` | Unit tests for `src/lib/engine.ts` — formulas, conditions, output rules, validations, freitext, components. No database needed. |
| `services/domain.service.test.ts` | Integration tests for `DomainService` against a real PostgreSQL database. |

```bash
npm test
```

The `pretest` hook (`scripts/ensure-test-db.mjs`) starts the disposable test database from
`docker-compose.test.yml` and applies migrations to it. That database runs on port **5433**,
stores its data in tmpfs (wiped on every stop), and its name must end in `_test` — a guard
(`src/__tests__/helpers/assert-test-db.ts`) aborts the suite otherwise, so tests can never
touch the dev database.

Coverage is configured for `src/lib/engine.ts` and `src/services/**/*.ts`.
CI (`.github/workflows/ci.yml`) runs tests and a production build on every push to `main` and
`feature/**`, and on pull requests to `main`.

---

## User Roles

| Role | Access |
|---|---|
| **Super Admin** | Full access — users, API keys, domains, price lists, configurator, admin panel, developer docs |
| **Domain Admin** | Domains, price lists, configurator |
| **Seller** | Configurator only |

Login is rate-limited to 5 failed attempts per IP per 15 minutes (tracked in the `LoginAttempt` table).

---

## REST API v1

All resource routes live under `/api/v1/` — a **single API surface** used by both the UI
(session cookie) and external clients (Bearer API key). The only non-versioned route is the
NextAuth handler at `/api/auth/**`.

```
Authorization: Bearer eak_live_<key>
```

API keys are created in the admin panel (Super Admin only) and carry full admin-level access.
If no `Authorization` header is present, the request falls back to the NextAuth session cookie.

**Response format**

```json
{ "data": ... }                                  // 200 / 201
{ "error": "message", "code": "OPTIONAL_CODE" }  // 4xx / 5xx
```

**Rate limiting & logging:** requests are limited to 60 per minute per IP (in-memory,
per instance) and answered with `429` plus `Retry-After` beyond that. Every request is written
to the `ApiLog` table (`Authorization` header masked, cookies stripped) and is browsable under
`/admin/logs`.

**CORS:** `/api/v1/**` sends `Access-Control-Allow-Origin: $ALLOWED_ORIGIN` (default `*`).

### Domains

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/domains` | List all domains |
| `POST` | `/api/v1/domains` | Create a domain |
| `GET` | `/api/v1/domains/:id` | Get domain details |
| `PATCH` | `/api/v1/domains/:id` | Update a domain |
| `DELETE` | `/api/v1/domains/:id` | Delete a domain |
| `POST` | `/api/v1/domains/:id/duplicate` | Duplicate a domain |
| `POST` | `/api/v1/domains/:id/run` | **Run the rules engine** |

#### Engine endpoint

`POST /api/v1/domains/:id/run`

```json
{
  "inputs": { "leistung_kwp": 10, "dachtyp": "satteldach" },
  "preis_items": [
    { "artikel_nr": "MOD-400W", "bezeichnung": "Modul 400W", "einheit": "Stk", "ek_preis": 120.00 }
  ]
}
```

Returns the full `EngineResult` — resolved `values`, `firedRules`, `activeFreitext`,
`activeKomponenten`, `validierungen`, plus a `trace` object documenting every formula,
rule group, validation, and component decision the engine made.

### Price Lists

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/pricelists` | List all price lists |
| `POST` | `/api/v1/pricelists` | Create a price list |
| `GET` | `/api/v1/pricelists/:id` | Get price list with items |
| `PATCH` | `/api/v1/pricelists/:id` | Update a price list |
| `DELETE` | `/api/v1/pricelists/:id` | Delete a price list |

### Users

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/users` | List all users (Super Admin) |
| `POST` | `/api/v1/users` | Create a user (Super Admin) |
| `PATCH` | `/api/v1/users/:id` | Update user (Super Admin) |

### API Keys

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/api-keys` | List API keys (Super Admin) |
| `POST` | `/api/v1/api-keys` | Create an API key (Super Admin) |
| `DELETE` | `/api/v1/api-keys/:id` | Revoke an API key (Super Admin) |

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/dashboard/stats` | Stats overview |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/logs` | API request log (Super Admin) |
| `DELETE` | `/api/v1/admin/logs` | Clear API log (Super Admin) |
| `GET` | `/api/v1/admin/webhooks` | List webhooks (Super Admin) |
| `POST` | `/api/v1/admin/webhooks` | Create webhook (Super Admin) |
| `PATCH` | `/api/v1/admin/webhooks/:id` | Update webhook (Super Admin) |
| `DELETE` | `/api/v1/admin/webhooks/:id` | Delete webhook (Super Admin) |

Full request/response examples: `docs/developer/07-api.md` (also in-app at `/docs/developer`).

---

## Production Deployment (Docker)

Each customer instance runs as its own isolated `docker compose` stack — one Next.js container
and one PostgreSQL container, exposed on a configurable port and routed by a reverse proxy
(nginx, Caddy, Traefik, etc.).

### Per-customer setup

```bash
# 1. Copy the project to a customer directory on the server
mkdir /opt/customer-a && cd /opt/customer-a
cp -r /path/to/project .

# 2. Create the environment file
cp .env.example .env
# Edit .env — set APP_PORT, POSTGRES_PASSWORD, NEXTAUTH_SECRET, NEXTAUTH_URL

# 3. Build and start
docker compose up -d --build

# 4. First-time only: seed the admin user
docker compose exec app node prisma/seed.js
```

The image ships a compiled `prisma/seed.js` (built from `prisma/seed.ts` via `npm run build:seed`)
because the runtime image contains no `ts-node` — do **not** use `prisma db seed` inside the container.

Migrations run automatically on every container start (`prisma migrate deploy` in the entrypoint).

### Environment variables (production)

| Variable | Description |
|---|---|
| `APP_PORT` | Host port the app is exposed on (change per customer, e.g. 3001, 3002 …) |
| `POSTGRES_USER` | PostgreSQL user (default: `angebots`) |
| `POSTGRES_PASSWORD` | PostgreSQL password — **required**, no default |
| `POSTGRES_DB` | Database name (default: `angebots_engine`) |
| `POSTGRES_PORT` | Host port Postgres is published on (default: `5544`) |
| `NEXTAUTH_SECRET` | Random string ≥ 32 chars — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of the instance, e.g. `https://customer.example.com` |
| `ALLOWED_ORIGIN` | CORS origin for `/api/v1/` (default: `*`, restrict in production) |

Full deployment guide including reverse-proxy config and backups: `docs/developer/10-deployment.md`.

---

## Project Structure

```
src/
├── app/
│   ├── (app)/               # Authenticated app routes (Server Components)
│   │   ├── admin/           # Users, API keys, webhooks, API log
│   │   ├── configurator/    # Sales configurator
│   │   ├── dashboard/       # Global stats overview
│   │   ├── docs/            # In-app docs — /docs (all roles), /docs/developer (Super Admin)
│   │   ├── domains/         # Domain configuration editor + health dashboard
│   │   ├── pricelists/      # Price list management
│   │   └── settings/        # User profile
│   ├── api/
│   │   ├── auth/            # NextAuth handler (the only non-versioned route)
│   │   └── v1/              # The API surface (versioned, CORS-enabled, logged)
│   │       ├── admin/       # logs, webhooks
│   │       ├── api-keys/
│   │       ├── dashboard/
│   │       ├── domains/     # incl. :id/run (engine) and :id/duplicate
│   │       ├── pricelists/
│   │       └── users/
│   └── login/               # Auth pages
├── components/
│   ├── layout/              # Sidebar, navigation progress
│   └── ui/                  # shadcn-style UI components
├── generated/
│   └── developer-docs.ts    # Build artifact — docs/developer/*.md bundled for /docs/developer
├── lib/
│   ├── engine.ts            # Core rules engine (pure function — no framework imports)
│   ├── api-response.ts      # Typed API response helpers (ok / created / apiError)
│   ├── api-logger.ts        # withLogging wrapper — ApiLog persistence + rate limit
│   ├── api-rate-limit.ts    # In-memory 60 req/min per IP
│   ├── api-key-auth.ts      # Bearer key verification (bcrypt)
│   ├── request-auth.ts      # Session-or-API-key resolution for /api/v1 routes
│   ├── auth.ts              # NextAuth configuration
│   ├── auth-helpers.ts      # requireAuth / requireRole for server components
│   ├── rate-limit.ts        # Login brute-force protection
│   ├── prisma.ts            # Prisma client singleton
│   └── validate-fields.ts   # Formula order validation
├── services/                # Service layer — all database access
│   ├── DomainService.ts
│   ├── PricelistService.ts
│   ├── UserService.ts
│   ├── ApiKeyService.ts
│   ├── EngineService.ts
│   ├── DashboardService.ts
│   └── WebhookService.ts
├── types/
│   └── domain.ts            # Core domain type definitions (engine contract)
└── __tests__/               # Vitest suites + DB helpers and test-DB guard
prisma/
├── schema.prisma            # PostgreSQL schema
├── migrations/              # Migration history
└── seed.ts                  # Database seeder
scripts/
├── gen-developer-docs.mjs   # Bundles docs/developer/*.md into src/generated
└── ensure-test-db.mjs       # Starts + migrates the disposable test DB before `npm test`
docs/
├── developer/               # Developer documentation (01 … 12)
├── screenshots/             # Screenshots used in this README
├── architecture-review.md   # Architecture review notes
└── OBSOLET/                 # Superseded planning documents
Dockerfile                   # Multi-stage production build (standalone output)
docker-compose.yml           # App + PostgreSQL 16 (one stack per customer)
docker-compose.test.yml      # Disposable test database (port 5433, tmpfs)
docker-entrypoint.sh         # Runs migrate deploy, then starts the server
```

**Key invariant:** neither pages nor API routes import Prisma directly — all database access
goes through a service class. The engine (`src/lib/engine.ts`) is a pure function whose only
dependency is `src/types/domain.ts`.

---

## Documentation

- **`docs/developer/`** — the full technical reference (architecture, getting started, project
  structure, database, auth, engine, API, frontend, services, deployment, testing, debugging).
  Rendered in-app at `/docs/developer` for Super Admins.
- **`/docs`** — end-user feature guide inside the app, available to all roles.
