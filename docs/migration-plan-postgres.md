# Migration Plan: SQLite → PostgreSQL + Headless API-First

> Created: 2026-05-07  
> Status: Ready to execute

---

## Overview

This plan covers two sequential goals:

**Part 1 — PostgreSQL migration** (~20 min)
Swap SQLite for PostgreSQL via Docker. No application code changes.

**Part 2 — Headless API-first refactor** (~2–3 weeks)
Make the current Next.js app truly headless: all data flows through versioned API routes,
no direct Prisma calls from Server Components. The React frontend becomes just one of many
possible consumers of the API — preparing the ground for any future frontend (Vue.js, mobile, etc.).

---

## Part 1: PostgreSQL Migration

The current app uses **SQLite** (`prisma/dev.db`) via Prisma. Migrating to **PostgreSQL** requires:

1. Provision a PostgreSQL database
2. Update the Prisma schema (2 lines)
3. Update `.env`
4. Regenerate the Prisma client
5. Run migrations
6. Re-seed (dev) or migrate data (production)

No application code changes required — Prisma abstracts the database completely.

---

## Step 1 — Provision PostgreSQL (Docker)

Create a `docker-compose.yml` in the project root:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: angebots-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: angebots
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: angebots_engine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Start the container:

```bash
docker compose up -d
```

Stop it when not needed:

```bash
docker compose down
```

> Data persists in the `postgres_data` volume — stopping the container does not lose your data.
> To wipe everything and start fresh: `docker compose down -v`

Connection string:
```
postgresql://angebots:secret@localhost:5432/angebots_engine
```

---

## Step 2 — Update Prisma Schema

Change **2 lines** in `prisma/schema.prisma`:

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

Also update the two JSON fields from `String` to proper `Json` type — this is optional but recommended for PostgreSQL since it gains native JSON querying:

```diff
 model Domain {
   ...
-  config_json String @default("{\"felder\":[],\"parameter\":[],\"validierungen\":[],\"regelwerk\":[],\"komponenten\":[]}")
+  config_json Json   @default("{\"felder\":[],\"parameter\":[],\"validierungen\":[],\"regelwerk\":[],\"komponenten\":[]}")
   ...
 }

 model Pricelist {
   ...
-  items_json String @default("[]")
+  items_json Json   @default("[]")
   ...
 }

 model AppSetting {
   ...
-  value String
+  value Json
   ...
 }
```

> **Note:** If you change `String` → `Json` you also need to update any application code
> that does `JSON.parse(domain.config_json)` or `JSON.stringify(...)` before saving.
> With the `Json` type, Prisma handles serialization automatically — you pass/receive
> plain objects instead of strings. See the code changes section below.

---

## Step 3 — Update Environment Variables

### Development (`.env`)

```diff
-DATABASE_URL="file:./dev.db"
+DATABASE_URL="postgresql://angebots:secret@localhost:5432/angebots_engine"
```

### Production (`.env.production` or server environment variables)

```
DATABASE_URL="postgresql://angebots:secret@localhost:5432/angebots_engine"
```

> Never commit the production `DATABASE_URL` to git.
> Add `.env.production` to `.gitignore` if it doesn't exist there already.
> On the production server, the same `docker-compose.yml` can be used — just change the password.

---

## Step 4 — Regenerate Prisma Client & Run Migrations

```bash
# Regenerate the client for the new provider
npx prisma generate

# Create and apply the migration
npx prisma migrate dev --name switch-to-postgresql
```

This generates a new migration file under `prisma/migrations/` with PostgreSQL-compatible SQL and applies it to the new database.

---

## Step 5 — Re-seed the Database

For a fresh development database:

```bash
npx prisma db seed
```

This runs `prisma/seed.ts` and creates the admin user + carport demo domain.

---

## Step 6 — Code Changes (only if switching to Json type)

If you change `config_json` and `items_json` from `String` to `Json`, update these files:

### `src/app/(app)/admin/config/page.tsx`

The `items_json` parsing in pricelists:
```diff
-  try { itemCount = JSON.parse(pl.items_json).length; } catch {}
+  try { itemCount = (pl.items_json as any[]).length; } catch {}
```

### Any code that does `JSON.parse(domain.config_json)`

Search for all occurrences:
```bash
grep -rn "JSON.parse.*config_json\|JSON.parse.*items_json\|JSON.stringify.*config_json\|JSON.stringify.*items_json" src/
```

Replace `JSON.parse(x)` → `x` and `JSON.stringify(x)` → `x` for those fields.

> **Recommendation:** Keep `String` type for now to avoid these code changes.
> Switch to `Json` only when doing a larger refactor. The app works fine either way.

---

## Data Migration (existing production data only)

If you have real data in the SQLite `dev.db` that must be preserved:

### Option A — Prisma db pull + manual export

```bash
# Export from SQLite to JSON
npx ts-node scripts/export-sqlite.ts > backup.json

# Import into PostgreSQL
npx ts-node scripts/import-postgres.ts < backup.json
```

### Option B — pgloader (automatic SQLite → PostgreSQL)

```bash
brew install pgloader

pgloader sqlite:///prisma/dev.db postgresql://angebots:secret@localhost:5432/angebots_engine
```

pgloader handles type coercions automatically. Review the output for warnings.

### Option C — Manual via Prisma (for small datasets)

```typescript
// scripts/migrate-data.ts
// 1. Connect to SQLite source, read all records
// 2. Connect to PostgreSQL target, write all records
// Run: npx ts-node scripts/migrate-data.ts
```

---

## What Changes, What Stays the Same

| | Changes | Stays the same |
|---|---|---|
| `prisma/schema.prisma` | `provider` line (+ optional Json types) | All model definitions |
| `.env` | `DATABASE_URL` value | Everything else |
| Application code | Nothing (or minor JSON.parse cleanup) | All queries, all logic |
| Prisma client API | Nothing | `prisma.user.findMany()` etc. identical |
| Migrations | New migration generated | Existing migrations stay |
| Seed | Re-run on new DB | Script unchanged |

---

## PostgreSQL-specific Improvements Available After Migration

These are optional enhancements only possible with PostgreSQL:

| Feature | How |
|---|---|
| Native JSON querying | `WHERE config_json->>'slug' = 'foo'` via Prisma raw queries |
| Full-text search on logs | Add `@@index` with GIN index on `path` or `request_body` |
| Connection pooling | Use PgBouncer or Neon's built-in pooling for serverless |
| Row-level security | Useful if multi-tenancy is added later |

---

## Checklist

```
[ ] docker-compose.yml created in project root
[ ] docker compose up -d — container running
[ ] prisma/schema.prisma: provider changed to "postgresql"
[ ] .env: DATABASE_URL updated
[ ] npx prisma generate
[ ] npx prisma migrate dev --name switch-to-postgresql
[ ] npx prisma db seed
[ ] npm run dev — verify app starts and login works
[ ] npm run build — verify build passes
```

---

## Estimated Time (Part 1)

| Task | Time |
|---|---|
| Create docker-compose.yml + start container | 5 min |
| Schema + env changes | 5 min |
| Generate + migrate | 5 min |
| Seed + verify | 5 min |
| **Total** | **~20 minutes** |

---

---

## Part 2: Headless API-First Refactor

---

### The Problem

The current app is a **monolith**. 16 Server Component pages call Prisma directly,
bypassing the API entirely. This means:

- No other frontend (Vue.js, mobile app) can consume the data
- Business logic is scattered across pages and API routes
- There is no single, consistent API contract

```
Current (coupled):
  Page → Prisma → Database

Target (headless):
  Page → API → Service → Prisma → Database
  Vue.js → API → Service → Prisma → Database
  Mobile → API → Service → Prisma → Database
```

---

### What Is Missing Today

These GET routes **do not exist** — pages bypass the API and call Prisma directly:

| Data needed | Current (wrong) | Needed |
|---|---|---|
| List all domains | `prisma.domain.findMany()` in page | `GET /api/v1/domains` |
| Single domain + config | `prisma.domain.findUnique()` in page | `GET /api/v1/domains/:id` |
| List pricelists | `prisma.pricelist.findMany()` in page | `GET /api/v1/pricelists` |
| Single pricelist | `prisma.pricelist.findUnique()` in page | `GET /api/v1/pricelists/:id` |
| List users | `prisma.user.findMany()` in page | `GET /api/v1/users` |
| Dashboard stats | multiple `prisma.*.count()` in page | `GET /api/v1/dashboard/stats` |
| Run the engine | called inline in configurator page | `POST /api/v1/domains/:id/run` |

---

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Any Frontend (React / Vue / Mobile)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP JSON
┌──────────────────────────▼──────────────────────────────────┐
│  API Layer  /api/v1/...                                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Route Handlers  (auth check → service call → JSON) │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │  Service Layer  src/services/                        │   │
│  │  DomainService · PricelistService · EngineService    │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │  Prisma ORM                                          │   │
│  └──────────────────────────┬──────────────────────────┘   │
└─────────────────────────────┼────────────────────────────── ┘
                              │
                     PostgreSQL (Docker)
```

---

### Phase A — Service Layer (Week 1)

Extract all Prisma calls from pages and API routes into dedicated service files.

**New directory: `src/services/`**

```
src/services/
├── DomainService.ts        ← findAll, findById, create, update, delete, duplicate
├── PricelistService.ts     ← findAll, findById, create, update, delete
├── UserService.ts          ← findAll, findById, create, update, delete
├── ApiKeyService.ts        ← findAll, create, revoke
├── EngineService.ts        ← run(domainId, inputs) — wraps engine.ts
├── DashboardService.ts     ← getStats()
└── WebhookService.ts       ← findAll, create, update, delete, dispatch
```

**Example — DomainService:**

```typescript
// src/services/DomainService.ts
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export class DomainService {
  static async findAll() {
    return prisma.domain.findMany({ orderBy: { updated_at: "desc" } });
  }

  static async findById(id: string) {
    return prisma.domain.findUnique({
      where: { id },
      include: { pricelists: { select: { pricelistId: true } } },
    });
  }

  static async create(name: string) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.domain.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    return prisma.domain.create({ data: { name, slug } });
  }

  static async update(id: string, data: { name?: string; config_json?: string }) {
    return prisma.domain.update({ where: { id }, data });
  }

  static async delete(id: string) {
    return prisma.domain.delete({ where: { id } });
  }

  static async duplicate(id: string) {
    const source = await prisma.domain.findUniqueOrThrow({ where: { id } });
    const baseSlug = slugify(`${source.name} Kopie`);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.domain.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    return prisma.domain.create({
      data: { name: `${source.name} (Kopie)`, slug, config_json: source.config_json },
    });
  }
}
```

**Example — EngineService:**

```typescript
// src/services/EngineService.ts
import { prisma } from "@/lib/prisma";
import { runEngine } from "@/lib/engine";

export class EngineService {
  static async run(domainId: string, inputs: Record<string, unknown>) {
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id: domainId } });
    const config = JSON.parse(domain.config_json);
    return runEngine(config, inputs);
  }
}
```

---

### Phase B — Complete the API Routes (Week 1–2)

Add all missing routes and move to `/api/v1/`. Full route map after refactor:

```
# Auth
POST   /api/v1/auth/login       (NextAuth — keep as-is)

# Domains
GET    /api/v1/domains           ← NEW
POST   /api/v1/domains
GET    /api/v1/domains/:id       ← NEW
PATCH  /api/v1/domains/:id
DELETE /api/v1/domains/:id
POST   /api/v1/domains/:id/duplicate
POST   /api/v1/domains/:id/run   ← NEW (rules engine endpoint)

# Pricelists
GET    /api/v1/pricelists        ← NEW
POST   /api/v1/pricelists
GET    /api/v1/pricelists/:id    ← NEW
PATCH  /api/v1/pricelists/:id
DELETE /api/v1/pricelists/:id

# Users
GET    /api/v1/users             ← NEW
POST   /api/v1/users
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

# API Keys
GET    /api/v1/api-keys          ← NEW
POST   /api/v1/api-keys
DELETE /api/v1/api-keys/:id

# Dashboard
GET    /api/v1/dashboard/stats   ← NEW

# Admin
GET    /api/v1/admin/logs
DELETE /api/v1/admin/logs
GET    /api/v1/admin/webhooks
POST   /api/v1/admin/webhooks
PATCH  /api/v1/admin/webhooks/:id
DELETE /api/v1/admin/webhooks/:id

# External (API key auth — unchanged)
GET    /api/v1/external/domains
GET    /api/v1/external/domains/:id
GET    /api/v1/external/pricelists
GET    /api/v1/external/pricelists/:id
```

**Every route follows the same pattern:**

```typescript
// src/app/api/v1/domains/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DomainService } from "@/services/DomainService";
import { canManageDomains } from "@/lib/auth-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const domains = await DomainService.findAll();
  return NextResponse.json({ data: domains });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!canManageDomains(session.user.rolle)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  // validation ...
  const domain = await DomainService.create(body.name);
  return NextResponse.json({ data: domain }, { status: 201 });
}
```

**Engine endpoint:**

```typescript
// src/app/api/v1/domains/[id]/run/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EngineService } from "@/services/EngineService";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { id } = await params;
  const { inputs } = await req.json();

  const result = await EngineService.run(id, inputs);
  return NextResponse.json({ data: result });
}
```

---

### Phase C — Standardize Response Format (Week 2)

All API responses follow a consistent envelope:

```typescript
// Success (single resource)
{ "data": { "id": "...", "name": "..." } }

// Success (collection)
{ "data": [...], "meta": { "total": 42 } }

// Error
{ "error": "Ungültige Eingabe", "code": "VALIDATION_ERROR" }
```

Create a helper to keep this consistent:

```typescript
// src/lib/api-response.ts
import { NextResponse } from "next/server";

export const ok = (data: unknown, status = 200) =>
  NextResponse.json({ data }, { status });

export const created = (data: unknown) =>
  NextResponse.json({ data }, { status: 201 });

export const error = (message: string, status: number, code?: string) =>
  NextResponse.json({ error: message, ...(code && { code }) }, { status });
```

---

### Phase D — Refactor Server Components (Week 2–3)

Replace all direct Prisma calls in Server Component pages with service calls.
This keeps SSR performance while decoupling pages from the database.

**Before:**
```typescript
// src/app/(app)/domains/page.tsx
const domains = await prisma.domain.findMany({ orderBy: { updated_at: "desc" } });
```

**After:**
```typescript
// src/app/(app)/domains/page.tsx
import { DomainService } from "@/services/DomainService";
const domains = await DomainService.findAll();
```

The page now has no knowledge of Prisma. It only depends on the service interface.

> **Note:** Server Components call services directly (same Node.js process, no HTTP overhead).
> External clients (Vue.js, mobile) call the API routes which call the same services.
> The service layer is the single source of truth.

---

### Phase E — CORS + API Documentation (Week 3)

**CORS** — allow external frontends to call the API:

```typescript
// next.config.mjs — add to headers()
{
  source: "/api/v1/:path*",
  headers: [
    { key: "Access-Control-Allow-Origin", value: process.env.ALLOWED_ORIGIN ?? "*" },
    { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
    { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
  ],
}
```

**API Documentation** — add Swagger UI via `next-swagger-doc`:

```bash
npm install next-swagger-doc swagger-ui-react
```

Accessible at `/api/docs` — auto-generated from JSDoc comments on route handlers.

---

### Summary: What Changes Per Phase

| Phase | What changes | Effort |
|---|---|---|
| A — Service layer | New `src/services/` files | 3–4 days |
| B — Complete API routes | New GET routes + engine endpoint + `/api/v1/` prefix | 4–5 days |
| C — Response format | `api-response.ts` helper + update all routes | 1 day |
| D — Refactor pages | Replace `prisma.*` in 16 page files with service calls | 2–3 days |
| E — CORS + Docs | Config + Swagger setup | 1 day |
| **Total** | | **~2–3 weeks** |

---

### Full Checklist (Part 2)

**Phase A — Service Layer**
```
[ ] src/services/DomainService.ts
[ ] src/services/PricelistService.ts
[ ] src/services/UserService.ts
[ ] src/services/ApiKeyService.ts
[ ] src/services/EngineService.ts
[ ] src/services/DashboardService.ts
[ ] src/services/WebhookService.ts
```

**Phase B — API Routes**
```
[ ] GET  /api/v1/domains
[ ] GET  /api/v1/domains/:id
[ ] POST /api/v1/domains/:id/run
[ ] GET  /api/v1/pricelists
[ ] GET  /api/v1/pricelists/:id
[ ] GET  /api/v1/users
[ ] GET  /api/v1/api-keys
[ ] GET  /api/v1/dashboard/stats
[ ] All existing routes moved to /api/v1/
```

**Phase C — Response Format**
```
[ ] src/lib/api-response.ts helper created
[ ] All route handlers updated to use helper
```

**Phase D — Refactor Pages**
```
[ ] src/app/(app)/dashboard/page.tsx
[ ] src/app/(app)/domains/page.tsx
[ ] src/app/(app)/domains/[id]/*/page.tsx  (8 pages)
[ ] src/app/(app)/pricelists/page.tsx
[ ] src/app/(app)/pricelists/[id]/page.tsx
[ ] src/app/(app)/configurator/page.tsx
[ ] src/app/(app)/configurator/[domain_id]/page.tsx
[ ] src/app/(app)/admin/*/page.tsx  (3 pages)
```

**Phase E — CORS + Docs**
```
[ ] CORS headers in next.config.mjs
[ ] Swagger/OpenAPI setup
[ ] /api/docs route working
```
