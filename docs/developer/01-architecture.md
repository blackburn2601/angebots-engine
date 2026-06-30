# Architecture Overview

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | **Next.js** | 16.2.5 | Full-stack React framework (App Router) |
| Language | **TypeScript** | 5.x | Strictly typed throughout |
| Database | **PostgreSQL** | 16 | Primary data store |
| ORM | **Prisma** | 6.x | Type-safe DB access, migrations |
| Auth | **NextAuth v5** (beta) | 5.0.0-beta.31 | Session management, credentials provider |
| Styling | **Tailwind CSS** | 4.x | Utility-first CSS |
| UI Components | **Radix UI** + custom | various | Accessible headless components |
| Icons | **Lucide React** | 1.x | SVG icon set |
| Forms | **React Hook Form** + **Zod** | 7.x / 4.x | Form state and validation |
| Charts | **Recharts** | 3.x | Dashboard statistics |
| Testing | **Vitest** | 4.x | Unit + integration tests |
| Bundler (dev) | **Webpack** | via Next.js | Development bundler (Turbopack disabled) |
| Bundler (prod) | **Next.js build** | via Next.js | Production bundler |
| Container | **Docker** + **docker-compose** | — | Deployment |
| CI | **GitHub Actions** | — | Test + build on every push |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Client                      │
│                                                          │
│  React Server Components (read-only, server-rendered)    │
│  React Client Components ("use client" — interactive)    │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP
┌──────────────────────▼──────────────────────────────────┐
│              Next.js Server  (port 3000)                 │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  App Router │  │  API Routes  │  │  Auth Handler  │  │
│  │  /app/*     │  │  /api/v1/*   │  │  /api/auth/*   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                  │            │
│  ┌──────▼────────────────▼──────────────────▼────────┐  │
│  │              Service Layer                         │  │
│  │  DomainService  UserService  ApiKeyService  etc.   │  │
│  └───────────────────────┬────────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────▼────────────────────────────┐  │
│  │              Prisma Client                         │  │
│  └───────────────────────┬────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                           │  TCP
┌──────────────────────────▼──────────────────────────────┐
│                 PostgreSQL 16                            │
└─────────────────────────────────────────────────────────┘
```

---

## Single API Surface

All application data is served by **one versioned REST API: `/api/v1/...`**. The same
routes back both the built-in UI and any external integration — there is no separate
"internal" API. (The only non-versioned route is the NextAuth handler at `/api/auth/...`,
which issues and clears the session cookie.)

Every `/api/v1` request accepts **either** authentication method:

- **Session cookie** (NextAuth JWT) — sent automatically by the browser, so the frontend's
  client-side `fetch` calls are authenticated with no extra headers. (Server Components don't
  call the API at all — they read from the database directly via the service layer.)
- **Bearer token** (`Authorization: Bearer eak_live_…`) — an API key (bcrypt-hashed in DB),
  used by third-party systems (ERP, CRM, external frontends).

Each request is checked for a valid session first, then falls back to the Bearer key.
Additional `/api/v1` behaviour:

- CORS configured via the `ALLOWED_ORIGIN` environment variable
- Fully logged to the `ApiLog` table
- Examples: `/api/v1/domains`, `/api/v1/domains/[id]/run`

> **History:** earlier versions exposed a second, unversioned "internal" API
> (`/api/domains`, `/api/users`, …) for the UI. Those routes were removed and consolidated
> into `/api/v1` — one source of truth per resource.

---

## Core Concept: Domains

Everything revolves around the concept of a **Domain**. A domain represents one *type of configurable product* (e.g., "Solar installation", "Carport", "Window").

Each domain stores its entire configuration as a single JSON blob in the `config_json` column. The `DomainConfig` TypeScript type defines the exact schema (see `src/types/domain.ts`).

```
Domain
 ├── felder[]        Input and output fields (number, text, select, boolean, formula, output)
 ├── parameter[]     Which fields are shown as user inputs in the configurator
 ├── validierungen[] Validation rules (errors/warnings shown to the user)
 ├── regelwerk[]     Rule groups (IF/THEN logic that sets output fields) + Freitext hints
 └── komponenten[]   Product components that get activated based on field values
```

---

## Request Flow for a Page Load

```
Browser → GET /domains
  → Next.js App Router
  → src/app/(app)/domains/page.tsx  (Server Component)
    → requireAuth()                  ← check JWT session, redirect to /login if invalid
    → DomainService.findAllWithCount() ← Prisma query to PostgreSQL
    → return JSX with data
  → HTML streamed to browser
  → Client components hydrate (sidebar, interactive buttons, etc.)
```

---

## Request Flow for the Engine

```
Browser (SimulatorClient) → user changes an input
  → useState update (local, no server call)
  → useMemo re-runs runEngine(config, values, preisItems)
    → evaluates rules, formulas, components (pure function, no I/O)
  → React re-renders result panel with new values

OR via API:
Browser/ERP → POST /api/v1/domains/[id]/run  { inputs: {...} }
  → authenticate Bearer token
  → EngineService.run(domainId, inputs)
    → load domain from DB
    → JSON.parse(config_json)
    → runEngine(config, inputs)
  → return SimulatorResult as JSON
```

---

## Key Architectural Decisions

### Config stored as JSON, not relational tables
`Domain.config_json` is a single JSON string. This makes the schema stable regardless of how complex domain configurations get — no migrations needed when adding new field types. The trade-off is that querying inside the config (e.g., searching by field name) is not directly SQL-queryable.

### Engine is a pure function
`runEngine()` in `src/lib/engine.ts` takes config + inputs, returns results — no database access, no side effects. This makes it safe to call in the browser (simulator) and on the server (API) from the same code.

### NextAuth with Credentials provider only
No OAuth/SSO. Users authenticate with email + bcrypt password. Sessions are JWT-based (not database sessions), with an 8-hour lifetime.

### Webpack dev, Next.js build prod
The dev script uses `--webpack` because the bundled Turbopack version (commit `2d08397b`) has a FATAL panic bug when processing server components that import `"use client"` modules. This does **not** affect production builds.
