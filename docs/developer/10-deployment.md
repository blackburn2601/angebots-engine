# Deployment

## Production Architecture

The application runs as two Docker containers orchestrated by `docker-compose.yml`:

```
┌─────────────────────────────────────────┐
│  docker-compose                          │
│                                          │
│  ┌──────────────────────┐               │
│  │  app (Next.js)        │ port 3000     │
│  │  node:20-alpine       │               │
│  └───────────┬──────────┘               │
│              │ internal network          │
│  ┌───────────▼──────────┐               │
│  │  postgres:16-alpine   │               │
│  │  volume: postgres_data│               │
│  └──────────────────────┘               │
└─────────────────────────────────────────┘
```

Both containers are on a private Docker network. Only the app container's port is exposed to the host.

---

## Dockerfile

Multi-stage build with three stages:

### Stage 1: `deps`
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma          # needed for prisma generate in postinstall
RUN npm ci
```

Installs exact versions from `package-lock.json`. `prisma generate` runs automatically via `postinstall`.

### Stage 2: `builder`
```dockerfile
FROM node:20-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build
RUN npm run build:seed        # compiles prisma/seed.ts -> dist/seed/seed.js
```

Builds the Next.js app. Output goes to `.next/standalone/` (because `output: "standalone"` is set in `next.config.mjs`).

Standalone output bundles only the required files + a minimal `server.js` — no need to copy all of `node_modules`.

### Stage 3: `runner`
```dockerfile
FROM node:20-alpine AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl        # Required by Prisma on Alpine
RUN addgroup/adduser nextjs           # Non-root user for security
COPY --from=builder .next/standalone ./
COPY --from=builder .next/static ./.next/static
COPY --from=builder public ./public
COPY --from=builder prisma ./prisma             # Migration files
COPY --from=builder node_modules/.prisma ./node_modules/.prisma     # Prisma binary
COPY --from=builder node_modules/@prisma ./node_modules/@prisma
COPY --from=builder node_modules/prisma ./node_modules/prisma
COPY --from=builder dist/seed/seed.js ./prisma/seed.js            # compiled seeder
COPY --from=builder node_modules/bcryptjs ./node_modules/bcryptjs # seeder dependency
```

The Prisma packages are copied explicitly because the standalone output doesn't bundle them automatically — it only traces regular Node.js imports, not native binary modules. The compiled seeder and `bcryptjs` are copied so the admin user can be created inside the container without `ts-node` (see [First Deployment](#first-deployment--step-by-step)).

---

## Docker Entrypoint

`docker-entrypoint.sh`:
```sh
#!/bin/sh
set -e
node node_modules/prisma/build/index.js migrate deploy
exec node server.js
```

On every container start:
1. Applies any pending DB migrations (`prisma migrate deploy`)
2. Starts the Next.js server

This ensures the DB schema is always up to date before the app accepts traffic. Safe to run repeatedly — `migrate deploy` is idempotent.

---

## First Deployment — Step by Step

### Prerequisites on the server

- Docker Engine 24+
- Docker Compose v2+
- Ports: one port free for the app (default 3000)

### 1. Copy files to server

```bash
scp -r . user@server:/opt/angebots-engine/
```

Or clone the repo directly:
```bash
git clone <repo-url> /opt/angebots-engine
cd /opt/angebots-engine
```

### 2. Create the `.env` file

```bash
cp .env.example .env
nano .env  # or your preferred editor
```

Fill in all required values:

```env
APP_PORT=3000
POSTGRES_USER=angebots
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=angebots_engine
NEXTAUTH_SECRET=<output-of-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-domain.com
ALLOWED_ORIGIN=https://your-frontend.com

# Seed admin (only needed for first run)
SEED_ADMIN_EMAIL=admin@your-company.com
SEED_ADMIN_PASSWORD=<initial-password>
SEED_ADMIN_NAME=Admin
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Build and start

```bash
docker compose up --build -d
```

This builds the Docker image, starts both containers, waits for Postgres to be healthy, then starts the app.

### 4. Seed the initial admin user

```bash
docker compose exec app node prisma/seed.js
```

> Wait ~30 seconds after first start before seeding so the DB is ready.

**Why not `prisma db seed`?** The `prisma.seed` entry in `package.json` runs `prisma/seed.ts`
through `ts-node`, and neither `ts-node` nor `typescript` exists in the runtime image. The
builder stage therefore compiles the seed to plain JavaScript (`npm run build:seed` →
`dist/seed/seed.js`), which the runner copies to `prisma/seed.js`. `bcryptjs` is copied
explicitly for the same reason — Next.js bundles it into the server chunks, so it is not part
of the traced standalone `node_modules`.

### 5. Verify

```bash
docker compose ps          # both containers should show "running" / "healthy"
docker compose logs app    # check for errors
curl http://localhost:3000  # should redirect to /login
```

---

## Updates and Redeployment

```bash
git pull                           # get latest code
docker compose up --build -d       # rebuild image + restart containers
```

The entrypoint runs `prisma migrate deploy` automatically on restart, applying any new migrations.

**Zero-downtime note:** Docker Compose stops and restarts containers, causing a brief downtime. For zero-downtime, put a reverse proxy (nginx/Caddy) in front and use rolling restarts or blue-green deployment.

---

## Reverse Proxy (Recommended)

In production, place nginx or Caddy in front of the app:

### Caddy example (`/etc/caddy/Caddyfile`)

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy handles HTTPS automatically via Let's Encrypt.

### nginx example

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Setting `X-Forwarded-For` is important — the app uses it for rate limiting and API logging.

---

## Multi-Instance Deployment

Running multiple app containers in parallel works for the Next.js server itself, but note:

- **API rate limiter** (`src/lib/api-rate-limit.ts`) is **in-memory** — not shared across instances. Replace with Redis if needed.
- **Prisma** uses a connection pool per instance. The default pool size is safe for most setups.

---

## Environment Variables for Production

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Built automatically by docker-compose from POSTGRES_* vars |
| `NEXTAUTH_SECRET` | Yes | Min 32 chars, random, keep secret |
| `NEXTAUTH_URL` | Yes | Public HTTPS URL of the app |
| `ALLOWED_ORIGIN` | Recommended | Restrict CORS to your frontend domain |
| `APP_PORT` | No | Defaults to 3000 |
| `POSTGRES_PORT` | No | Host port Postgres is published on; defaults to `5544` |

---

## Backup

The only stateful resource is the PostgreSQL volume.

```bash
# Backup
docker compose exec postgres pg_dump -U angebots angebots_engine > backup.sql

# Restore
docker compose exec -T postgres psql -U angebots angebots_engine < backup.sql
```

Set up automated daily backups with a cron job on the host.

---

## Go-Live Checklist

- [ ] `NEXTAUTH_SECRET` is a strong random 32+ char string
- [ ] `NEXTAUTH_URL` is the correct HTTPS public URL
- [ ] `ALLOWED_ORIGIN` is restricted to your frontend domain
- [ ] `POSTGRES_PASSWORD` is strong and not the default
- [ ] SSL/TLS configured on the reverse proxy
- [ ] `docker compose ps` shows both services healthy
- [ ] Admin user created (via seed or manually)
- [ ] Login works at `https://your-domain.com/login`
- [ ] At least one Domain created and Engine test with `/api/v1/domains/{id}/run` succeeds
- [ ] Automated DB backup scheduled
- [ ] Server firewall blocks the published Postgres port (`POSTGRES_PORT`, default 5544) from outside access — or unpublish it in production if external DB access isn't needed
