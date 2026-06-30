# Database & Prisma

## Overview

- **Database**: PostgreSQL 16
- **ORM**: Prisma 6 (with generated TypeScript client)
- **Schema file**: `prisma/schema.prisma`

Prisma acts as the only layer between the application code and PostgreSQL. You never write raw SQL. All table definitions, relationships, and indexes are declared in `schema.prisma`.

---

## Data Models

### `User`
Application users (employees who log in to the admin UI).

| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | Display name |
| `email` | String | Unique login email |
| `password` | String | bcrypt hash (cost 12) |
| `rolle` | String | Role: `SUPER_ADMIN`, `DOMAIN_ADMIN`, `SELLER` |
| `aktiv` | Boolean | Soft-disable without deleting |
| `muss_pw_aendern` | Boolean | Forces password change on next login |
| `erstellt_am` | DateTime | Created timestamp |
| `letzter_login` | DateTime? | Last successful login |

### `Account` / `Session` / `VerificationToken`
NextAuth adapter tables. Managed automatically by `@auth/prisma-adapter`. Do not modify manually.

### `Domain`
The core entity. Represents one product type that can be configured.

| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | Human-readable name |
| `slug` | String | URL-safe unique name, auto-generated |
| `config_json` | String | Full domain configuration as JSON |
| `erstellt_am` | DateTime | Created timestamp |
| `updated_at` | DateTime | Auto-updated on every save |

`config_json` default: `{"felder":[],"parameter":[],"validierungen":[],"regelwerk":[],"komponenten":[]}`

### `Pricelist`
A price list containing article prices. Multiple pricelists can be linked to one domain.

| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | Display name |
| `gueltig_ab` | DateTime? | Valid from date |
| `gueltig_bis` | DateTime? | Valid until date |
| `aktiv` | Boolean | Whether it's active |
| `items_json` | String | Array of price items as JSON |

`items_json` structure (array of `PreisItem`):
```json
[
  {
    "artikel_nr": "ART-001",
    "bezeichnung": "Solar Module 400W",
    "einheit": "Stk",
    "ek_preis": 150.00,
    "waehrung": "EUR",
    "steuer_prozent": 19
  }
]
```

### `DomainPricelist`
Many-to-many join table between `Domain` and `Pricelist`.

### `ApiKey`
API keys for external system access.

| Column | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `label` | String | Human-readable name |
| `key_hash` | String | bcrypt hash of the raw key |
| `key_prefix` | String | First 17 chars (for lookup optimization) |
| `aktiv` | Boolean | Revoked keys have `aktiv = false` |
| `letzter_zugriff` | DateTime? | Last time the key was used |

Raw keys are in format `eak_live_<48 hex chars>`. The raw key is shown **only once** at creation. After that, only the hash is stored.

### `ApiKeyLog`
Every request made with an API key is logged here.

### `ApiLog`
Full request/response log for all `/api/v1/*` calls. Stores method, path, status, duration, IP, headers (auth redacted), request/response bodies (truncated to 8 KB).

### `LoginAttempt`
Tracks login attempts per IP address. Used by the rate limiter to block brute-force attacks. Indexed on `(ip, zeitstempel)`. Records older than 24 hours are automatically cleaned up.

### `WebhookUrl`
Stores webhook endpoint URLs. The application does not fire them automatically yet — this is a configuration table for future webhook dispatch.

### `AppSetting`
Key-value store for application settings, editable via the Admin → Config page.

| Column | Type | Notes |
|---|---|---|
| `key` | String | Primary key, setting name |
| `value` | String | Setting value |
| `updated_at` | DateTime | Auto-updated |
| `updated_by` | String? | User ID of last editor |

---

## Working with Prisma

### Generating the client

Always run after changing `schema.prisma`:

```bash
npx prisma generate
```

This regenerates `node_modules/.prisma/client` with new types. The `postinstall` script does this automatically after `npm install`.

### Creating a migration

```bash
npx prisma migrate dev --name describe-what-changed
```

This:
1. Compares `schema.prisma` to the current DB state
2. Generates a new SQL migration file in `prisma/migrations/`
3. Applies it to your local dev DB
4. Runs `prisma generate` automatically

### Applying migrations (CI / production)

```bash
npx prisma migrate deploy
```

This applies all pending migrations from `prisma/migrations/` without generating new ones. Used in Docker entrypoint and CI.

### Resetting the database (dev only!)

```bash
npx prisma migrate reset
```

**Drops and recreates the database**, applies all migrations from scratch, and re-runs the seed. Use only in development.

### Inspecting the database

```bash
npx prisma studio        # Visual browser at localhost:5555
npx prisma db pull       # Reverse-engineer schema from existing DB (rarely needed)
```

---

## The Prisma Singleton Pattern

`src/lib/prisma.ts` uses a global singleton to prevent multiple `PrismaClient` instances during hot-reloads in development:

```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

In production, a new instance is always created (no `globalThis` caching), which is correct since there are no hot reloads.

**Important:** Always import Prisma from this file — never instantiate `new PrismaClient()` directly elsewhere:

```typescript
import { prisma } from "@/lib/prisma";
```

---

## Binary targets

`schema.prisma` declares three binary targets:

```prisma
binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]
```

- `native`: your local machine (macOS, Linux x64, etc.)
- `linux-musl-openssl-3.0.x`: Docker Alpine on x64 (production)
- `linux-musl-arm64-openssl-3.0.x`: Docker Alpine on ARM64 (e.g., Apple M-series hosting)

Without these, the Prisma binary for Linux Alpine would be missing and the Docker container would crash.
