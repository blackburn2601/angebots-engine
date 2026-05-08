# Angebots-Engine

A configurable quoting and calculation engine built with Next.js. Define fields, formulas, rules, and components once — let the configurator handle the rest.

---

## Features

- **Domains** — self-contained configuration areas (e.g. photovoltaics, windows, roofing)
- **Fields** — numbers, text, dropdowns, booleans, formula fields, and output fields
- **Rules engine** — condition-based value assignment with AND/OR logic
- **Validations** — field-level error and warning rules, including field-to-field comparisons
- **Components** — link calculation results to price list articles for automatic costing
- **Price lists** — manage articles with purchase prices; CSV import supported
- **Simulator** — test any configuration live without creating a real quote
- **Configurator** — sales-facing UI for creating quotes in a few clicks
- **REST API v1** — full headless API with CRUD and engine execution for external integration
- **Role-based access** — Super Admin, Domain Admin, Seller

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Auth | NextAuth v5 (beta) — credentials + JWT |
| Database | PostgreSQL 16 via Docker + Prisma ORM |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| Language | TypeScript |

---

## Requirements

- Node.js 20+
- npm 9+
- Docker (for PostgreSQL)

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd angebots-engine
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on port 5432 with persistent storage.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection — `postgresql://angebots:secret@localhost:5432/angebots_engine` for local Docker |
| `NEXTAUTH_SECRET` | Random string, min 32 characters |
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Email for the initial Super Admin account |
| `SEED_ADMIN_PASSWORD` | Password for the initial Super Admin account |
| `SEED_ADMIN_NAME` | Display name for the initial Super Admin account |
| `ALLOWED_ORIGIN` | Allowed CORS origin for `/api/v1/` (default: `*`) |

### 5. Apply the schema and seed

```bash
# Run migrations
npx prisma migrate deploy

# Seed the initial admin user
npm run db:seed
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials from your `.env`.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema without migrations (prototype) |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:seed` | Seed the initial admin user |

---

## User Roles

| Role | Access |
|---|---|
| **Super Admin** | Full access — users, API keys, domains, price lists, configurator, admin panel |
| **Domain Admin** | Domains, price lists, configurator |
| **Seller** | Configurator only |

---

## REST API v1

The `/api/v1/` routes provide a versioned, headless API with CORS support. All requests require a valid session cookie **or** an `Authorization` header with a Bearer API key.

```
Authorization: Bearer eak_live_<key>
```

API keys are created in the admin panel (Super Admin only).

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

Returns the full `SimulatorResult` — resolved output fields, activated components, and validation messages.

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

---

## Production Deployment (Docker)

Each customer instance runs as its own isolated `docker compose` stack — one Next.js container and one PostgreSQL container, exposed on a configurable port and routed by a reverse proxy (nginx, Caddy, Traefik, etc.).

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
docker compose exec app node node_modules/prisma/build/index.js db seed
```

Migrations run automatically on every container start (`prisma migrate deploy` in the entrypoint).

### Environment variables (production)

| Variable | Description |
|---|---|
| `APP_PORT` | Host port the app is exposed on (change per customer, e.g. 3001, 3002 …) |
| `POSTGRES_USER` | PostgreSQL user (default: `angebots`) |
| `POSTGRES_PASSWORD` | PostgreSQL password — **required**, no default |
| `POSTGRES_DB` | Database name (default: `angebots_engine`) |
| `NEXTAUTH_SECRET` | Random string ≥ 32 chars — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of the instance, e.g. `https://customer.example.com` |
| `ALLOWED_ORIGIN` | CORS origin for `/api/v1/` (default: `*`, restrict in production) |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/               # Authenticated app routes (Server Components)
│   │   ├── admin/           # User, API key, webhook, config management
│   │   ├── configurator/    # Sales configurator
│   │   ├── docs/            # In-app documentation
│   │   ├── domains/         # Domain configuration editor
│   │   ├── pricelists/      # Price list management
│   │   └── settings/        # User profile
│   ├── api/
│   │   ├── v1/              # Headless REST API (versioned, CORS-enabled)
│   │   │   ├── domains/
│   │   │   ├── pricelists/
│   │   │   ├── users/
│   │   │   ├── api-keys/
│   │   │   ├── dashboard/
│   │   │   └── admin/
│   │   └── ...              # Legacy internal API routes (for Client Components)
│   └── login/               # Auth pages
├── components/
│   ├── layout/              # Sidebar, navigation
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── engine.ts            # Core rules engine (pure function — not modified)
│   ├── api-response.ts      # Typed API response helpers
│   ├── auth.ts              # NextAuth configuration
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
│   └── domain.ts            # Core domain type definitions (not modified)
prisma/
├── schema.prisma            # PostgreSQL schema
├── migrations/              # Migration history
└── seed.ts                  # Database seeder
Dockerfile                   # Multi-stage production build (standalone output)
docker-compose.yml           # App + PostgreSQL 16 (one stack per customer)
docker-entrypoint.sh         # Runs migrate deploy, then starts the server
docs/
└── architecture.md          # System architecture overview
```

---

## Architecture Overview

See [docs/architecture.md](docs/architecture.md) for a detailed description of the service layer, headless API design, and the rules engine.

---

## In-App Documentation

A full feature guide is available inside the app at `/docs` — accessible to all roles.
