# Getting Started — Local Development

## Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Node.js | 26.x (CI builds on Node 26) | `node --version` |
| npm | 11.x | `npm --version` |
| Docker + Docker Compose | Docker 24+ | `docker --version` |
| Git | any | `git --version` |

> PostgreSQL does NOT need to be installed locally — Docker runs it.

---

## Step 1 — Clone and install

```bash
git clone <repo-url>
cd angebots-engine
npm install
```

`npm install` automatically runs the `postinstall` script (`prisma generate && node scripts/gen-developer-docs.mjs`), which generates the typed Prisma client from `prisma/schema.prisma` and bundles these developer docs for the in-app `/docs/developer` viewer.

---

## Step 2 — Environment variables

Copy the example file:

```bash
cp .env.example .env
```

The defaults in `.env.example` work for local development as-is. Key variables:

```env
DATABASE_URL="postgresql://angebots:secret@localhost:5544/angebots_engine"
NEXTAUTH_SECRET="change-me-min-32-chars-random-string"
NEXTAUTH_URL="http://localhost:3000"
POSTGRES_PORT=5544
```

> The dev database is published on host port **5544** (not the default 5432) to avoid clashing
> with other local Postgres instances and the test DB (which uses 5433). `POSTGRES_PORT` sets the
> host port `docker-compose.yml` maps to the container's 5432 — keep it in sync with `DATABASE_URL`.

`NEXTAUTH_SECRET` must be at least 32 characters. In dev any string works; in production generate a real one:

```bash
openssl rand -base64 32
```

---

## Step 3 — Start the database

```bash
docker compose up -d postgres
```

This starts only the Postgres container (not the app container). Wait a few seconds for it to become healthy.

Verify it's running:

```bash
docker compose ps
```

Expected output shows `postgres` with state `healthy`.

---

## Step 4 — Apply migrations and seed

```bash
npx prisma migrate dev    # creates tables and applies all migrations
npm run db:seed           # inserts a default super-admin user
```

The seed creates the admin user defined in `.env`:

```env
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="Admin123!"
SEED_ADMIN_NAME="Super Admin"
```

Change these in `.env` before seeding if you want different credentials.

---

## Step 5 — Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000`. You will be redirected to `/login`. Log in with the seed credentials.

> **Note:** The dev script uses `--webpack` flag. This is intentional. The bundled Turbopack version has a fatal panic bug that causes infinite page reloads. See [12 · Debugging Guide](./12-debugging.md) for details.

---

## Daily workflow

```bash
# Start DB if not running
docker compose up -d postgres

# Start dev server
npm run dev

# Run tests (in a separate terminal)
npm test

# Open Prisma Studio (visual DB browser)
npx prisma studio
```

---

## Useful npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with Webpack (localhost:3000) |
| `npm run build` | Production build |
| `npm start` | Production server (requires build first) |
| `npm test` | Run Vitest tests once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Test coverage report |
| `npm run lint` | ESLint check |
| `npm run db:migrate` | `prisma migrate dev` — create new migration |
| `npm run db:seed` | Seed initial admin user |
| `npm run db:push` | `prisma db push` — sync schema without migration (dev only) |

---

## Prisma Studio

Prisma Studio is a visual database browser. Start it with:

```bash
npx prisma studio
```

Opens at `http://localhost:5555`. Shows all tables, lets you view/edit/delete rows. Useful for debugging data issues.

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret, min 32 chars |
| `NEXTAUTH_URL` | Yes | Base URL of the app (used for redirects) |
| `ALLOWED_ORIGIN` | No | CORS origin for `/api/v1/*`. Defaults to `*` |
| `SEED_ADMIN_EMAIL` | Seed only | Email for the seeded admin user |
| `SEED_ADMIN_PASSWORD` | Seed only | Password for the seeded admin user |
| `SEED_ADMIN_NAME` | Seed only | Display name for the seeded admin user |
| `POSTGRES_PORT` | No | Host port Postgres is published on (default `5544`); must match `DATABASE_URL` |
| `APP_PORT` | Docker only | Port exposed by the Docker container |
| `POSTGRES_USER` | Docker only | Postgres username |
| `POSTGRES_PASSWORD` | Docker only | Postgres password |
| `POSTGRES_DB` | Docker only | Postgres database name |
