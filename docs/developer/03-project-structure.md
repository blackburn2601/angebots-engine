# Project Structure

## Top-level layout

```
angebots-engine/
├── src/                    Application source code
│   ├── app/                Next.js App Router pages and API routes
│   ├── components/         Shared React components
│   ├── lib/                Core utilities, auth, engine, Prisma client
│   ├── services/           Data access service layer (one class per domain)
│   ├── types/              TypeScript type definitions
│   └── __tests__/          Vitest test files
├── prisma/
│   ├── schema.prisma       Database schema (source of truth)
│   ├── seed.ts             Database seeder (creates initial admin user)
│   └── migrations/         Auto-generated migration SQL files
├── public/                 Static assets served at /
├── docs/
│   ├── developer/          THIS documentation
│   └── OBSOLET/            Old migration planning docs (ignore)
├── .github/workflows/      GitHub Actions CI pipeline
├── Dockerfile              Multi-stage Docker build
├── docker-compose.yml      Local + production Docker setup
├── docker-entrypoint.sh    Runs prisma migrate deploy, then starts server
├── next.config.mjs         Next.js configuration
├── tsconfig.json           TypeScript configuration
├── vitest.config.ts        Test runner configuration
├── eslint.config.mjs       ESLint configuration
├── postcss.config.mjs      PostCSS/Tailwind configuration
├── package.json            NPM scripts and dependencies
└── .env / .env.example     Environment variables
```

---

## `src/app/` — Next.js App Router

All pages, layouts, and API routes live here. Next.js uses filesystem-based routing.

```
src/app/
├── layout.tsx              Root HTML layout (fonts, body)
├── page.tsx                Root / redirect to /dashboard
├── globals.css             Global CSS (Tailwind base + variables)
├── favicon.ico
│
├── login/
│   ├── page.tsx            Login page (Server Component, shows form)
│   └── login-form.tsx      Login form (Client Component, handles submit)
│
├── (app)/                  Route group — all authenticated pages
│   ├── layout.tsx          Auth guard + Sidebar + NavigationProgress
│   ├── loading.tsx         Suspense fallback shown during page loads
│   │
│   ├── dashboard/page.tsx  Dashboard with stats and recent activity
│   │
│   ├── domains/            Domain list + create + detail pages
│   │   ├── page.tsx        Domain list (Server Component)
│   │   ├── new/            Create domain form
│   │   ├── domain-card-actions.tsx  (Client: delete/duplicate buttons)
│   │   └── [id]/           Per-domain sub-pages (tabs)
│   │       ├── layout.tsx  Domain sub-nav layout
│   │       ├── domain-nav.tsx  Tab navigation
│   │       ├── dashboard/  Domain stats
│   │       ├── fields/     Field editor
│   │       ├── rules/      Rules editor
│   │       ├── form/       Form layout editor
│   │       ├── components/ Component/BOM editor
│   │       ├── validations/ Validation rule editor
│   │       └── simulator/  Live engine simulator
│   │
│   ├── pricelists/         Pricelist management
│   │   ├── page.tsx
│   │   ├── new/
│   │   ├── [id]/
│   │   └── pricelist-row.tsx
│   │
│   ├── configurator/       End-user configurator
│   │   ├── page.tsx        Domain picker
│   │   └── [domain_id]/    Configurator for a specific domain
│   │
│   ├── admin/              Admin-only pages
│   │   ├── users/          User management
│   │   ├── api-keys/       API key management
│   │   ├── logs/           API request log viewer
│   │   ├── webhooks/       Webhook URL management
│   │   └── config/         App settings viewer (AppSetting model)
│   │
│   ├── settings/
│   │   └── profile/        User profile / password change
│   │
│   └── docs/               In-app API documentation
│
└── api/                    All HTTP API routes
    ├── auth/[...nextauth]/  NextAuth handler (GET+POST) — issues the session cookie
    └── v1/                  REST API — session cookie (UI) OR Bearer token (external)
        ├── domains/
        │   └── [id]/
        │       ├── run/        POST — run the engine
        │       └── duplicate/  POST — duplicate a domain
        ├── pricelists/
        ├── users/
        ├── api-keys/
        ├── admin/
        └── dashboard/stats/
```

### Route Groups

`(app)` is a **Route Group** in Next.js. The parentheses mean it is NOT part of the URL — it's just a way to share a layout. All pages inside `(app)/` use the authenticated layout (sidebar, session check) without having `/app/` in the URL.

---

## `src/components/`

```
src/components/
├── layout/
│   ├── sidebar.tsx         Main navigation sidebar (responsive, collapsible)
│   └── navigation-progress.tsx  Top progress bar shown during navigation
└── ui/                     Radix UI-based UI primitives
    ├── button.tsx
    ├── input.tsx
    ├── select.tsx
    ├── dialog.tsx
    ├── badge.tsx
    ├── card.tsx
    ├── tabs.tsx
    ├── tooltip.tsx
    ├── switch.tsx
    ├── textarea.tsx
    ├── label.tsx
    ├── separator.tsx
    ├── collapsible.tsx
    ├── dropdown-menu.tsx
    ├── alert.tsx
    └── formula-input.tsx   Custom formula editor with field autocomplete
```

All `src/components/ui/` components are **Client Components** — they wrap interactive Radix UI primitives. They can be imported from both server and client components.

---

## `src/lib/`

Core utilities that are used across the application.

```
src/lib/
├── prisma.ts           Singleton PrismaClient (prevents connection pool exhaustion in dev)
├── auth.ts             NextAuth configuration (providers, JWT callbacks)
├── auth-helpers.ts     requireAuth(), requireRole(), canManage*() helpers
├── engine.ts           THE ENGINE — pure function, evaluates domain configs
├── api-key-auth.ts     Validates Bearer tokens for /api/v1/*
├── api-logger.ts       Logs API requests to ApiLog table, withLogging() wrapper
├── api-rate-limit.ts   In-memory rate limiting for /api/v1/*
├── api-response.ts     Helper functions: ok(), created(), apiError()
├── rate-limit.ts       Login rate limiting (persisted in LoginAttempt table)
├── utils.ts            cn() for className merging, slugify() for URL slugs
└── validate-fields.ts  Detects and fixes formula field order issues
```

---

## `src/services/`

One service class per data entity. Services encapsulate all Prisma calls so that routes and pages never call Prisma directly.

```
src/services/
├── DomainService.ts     CRUD + duplicate + parseConfig()
├── PricelistService.ts  CRUD for pricelists + their items_json
├── UserService.ts       CRUD + bcrypt password hashing
├── ApiKeyService.ts     create (returns raw key once) + revoke
├── WebhookService.ts    CRUD for webhook URLs
├── DashboardService.ts  getStats(), getRecentDomains(), getRecentLogs()
└── EngineService.ts     run() — loads domain from DB, calls runEngine()
```

---

## `src/types/`

```
src/types/
└── domain.ts       All TypeScript interfaces for DomainConfig and its parts
```

This file is the **single source of truth** for the data structure stored in `Domain.config_json`. When adding new domain features, start here.

---

## `src/__tests__/`

```
src/__tests__/
├── engine.test.ts              Unit tests for the rule engine (no DB)
├── helpers/
│   └── db.ts                   Test DB helper (truncateDomains)
└── services/
    └── domain.service.test.ts  Integration tests for DomainService (needs DB)
```

---

## `prisma/`

```
prisma/
├── schema.prisma           DB schema — generator config, datasource, all models
├── seed.ts                 Creates the initial SUPER_ADMIN user
├── dev.db                  SQLite dev DB (leftover — not used, Postgres is used)
└── migrations/             Numbered migration directories with SQL files
```

> Note: `dev.db` is an old SQLite artefact. The app uses PostgreSQL exclusively — `dev.db` can be ignored.
