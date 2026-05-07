# Angebots-Engine

A configurable quoting and calculation engine built with Next.js 14. Define fields, formulas, rules, and components once — let the configurator handle the rest.

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
- **REST API** — read domains and price lists from external systems via API keys
- **Role-based access** — Super Admin, Domain Admin, Seller

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth v5 (beta) — credentials + JWT |
| Database | SQLite via Prisma ORM |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| Language | TypeScript |

---

## Requirements

- Node.js 20+
- npm 9+

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

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path — `file:./dev.db` works for local dev |
| `NEXTAUTH_SECRET` | Random string, min 32 characters |
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Email for the initial Super Admin account |
| `SEED_ADMIN_PASSWORD` | Password for the initial Super Admin account |
| `SEED_ADMIN_NAME` | Display name for the initial Super Admin account |

### 4. Set up the database

```bash
# Apply the schema and generate the Prisma client
npm run db:push

# Seed the initial admin user
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials from your `.env`.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to the database |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed the initial admin user |

---

## User Roles

| Role | Access |
|---|---|
| **Super Admin** | Full access — users, API keys, domains, price lists, configurator |
| **Domain Admin** | Domains, price lists, configurator |
| **Seller** | Configurator only |

---

## REST API

External systems can access domains and price lists via API keys (created in the admin panel).

All requests require an `Authorization` header:

```
Authorization: Bearer ae_live_<key>
```

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/external/domains` | List all active domains |
| `GET` | `/api/external/domains/:id` | Get domain configuration |
| `GET` | `/api/external/pricelists` | List all active price lists |
| `GET` | `/api/external/pricelists/:id` | Get price list articles |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/               # Authenticated app routes
│   │   ├── admin/           # User and API key management (Super Admin)
│   │   ├── configurator/    # Sales configurator
│   │   ├── docs/            # In-app documentation
│   │   ├── domains/         # Domain configuration
│   │   ├── pricelists/      # Price list management
│   │   └── settings/        # User profile
│   ├── api/                 # API routes (internal + external)
│   └── login/               # Auth pages
├── components/
│   ├── layout/              # Sidebar, navigation
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── engine.ts            # Core calculation engine
│   ├── auth.ts              # NextAuth configuration
│   ├── prisma.ts            # Prisma client singleton
│   └── validate-fields.ts   # Formula order validation
├── types/
│   └── domain.ts            # Core domain type definitions
prisma/
├── schema.prisma            # Database schema
└── seed.ts                  # Database seeder
```

---

## In-App Documentation

A full feature guide is available inside the app at `/docs` — accessible to all roles.
