# ── 1. Install dependencies ───────────────────────────────────────────────────
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall runs `prisma generate && node scripts/gen-developer-docs.mjs`,
# so the generator and its markdown sources must be present in this stage too.
COPY scripts ./scripts
COPY docs ./docs
RUN npm ci

# ── 2. Build ──────────────────────────────────────────────────────────────────
FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build
# Compile prisma/seed.ts -> dist/seed/seed.js. The runtime image has no ts-node,
# so the seed must ship as plain JavaScript (see docker-entrypoint / deployment docs).
RUN npm run build:seed

# ── 2b. Prisma CLI ────────────────────────────────────────────────────────────
# `prisma migrate deploy` runs on every container start (docker-entrypoint.sh),
# but the CLI's dependency closure reaches outside the @prisma scope (effect, …)
# and is NOT part of the traced standalone output. Install it into its own
# prefix so it can be copied whole, without clobbering the generated client.
FROM node:26-alpine AS prisma-cli
WORKDIR /cli
COPY package.json ./
RUN PRISMA_VERSION="$(node -p "require('./package.json').dependencies.prisma")" \
 && npm install --no-save --no-package-lock "prisma@${PRISMA_VERSION}"

# ── 3. Production image ───────────────────────────────────────────────────────
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone Next.js output (minimal server + traced node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma runtime: migration files + the generated client and its query engine.
# (The standalone output only traces regular JS imports, not native binaries.)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Prisma CLI in its own tree — kept out of ./node_modules so its @prisma/*
# packages cannot shadow the generated client above.
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./prisma-cli/node_modules

# Seeding: compiled seed script + its runtime deps. `prisma db seed` would need
# ts-node (not present here), so the seed runs directly as `node prisma/seed.js`.
# bcryptjs is copied explicitly — Next bundles it into the server chunks, so it
# is not part of the traced standalone node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/dist/seed/seed.js ./prisma/seed.js
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
