# Implementation Plan: `wagner-rules-engine`

> Created: 2026-05-13 · Updated: 2026-05-14 · Status: **Ready to implement**  
> Parent plan: [`docs/migration-plan-php-symfony.md`](migration-plan-php-symfony.md) — Phase 1  
> Navigation index: [`PHASES.md`](PHASES.md)

---

## CLAUDE.md for this repo

When scaffolding `wagner-rules-engine/`, write this file first:

```markdown
# wagner-rules-engine

Shared TypeScript/Node.js microservice — one endpoint: POST /run. Wraps engine.ts from angebots-engine.

## Invariants — never violate
- src/engine/engine.ts and src/engine/types.ts are read-only copies from angebots-engine. Never edit them here.
- logExecution() must never receive raw config or inputs — counts only, never customer data.
- All DB access goes through Prisma. No raw SQL or prisma.$queryRaw.
- The esk_ prefix identifies service API keys. Never use it for any other purpose.
- Run cd ../angebots-engine && npm test before and after any engine file changes.
- Do not start the next task until the current task's Verify command passes.
```

---

## 1. Purpose & Scope

`wagner-rules-engine` is a **TypeScript/Node.js microservice** — a thin HTTP wrapper around the existing `engine.ts` computation core from `angebots-engine`. It exposes a single endpoint (`POST /run`), authenticates callers by per-customer service API key, and logs every execution to its own PostgreSQL database.

This is a **shared platform service**: a single deployment serves all customer instances. Each customer's `wagner-offer-studio-core` Symfony backend has its own service API key. The microservice never stores customer domain configs, user data, or session state — it receives everything in the request body and returns the result immediately.

**Engine source of truth:** `angebots-engine/src/lib/engine.ts` — the computation logic is not ported or rewritten. The engine files are copied into `src/engine/` and must be kept in sync with the reference repo whenever engine logic changes.

**Not in scope for this plan:** user-facing auth, domain CRUD, pricing data. Those live in each customer's `wagner-offer-studio-core`.

---

## 2. Prerequisites

- [ ] `angebots-engine` is cloned and `npm test` passes (confirms `engine.ts` baseline)
- [ ] Node.js 22 LTS is installed (`node -v`)
- [ ] Docker and Docker Compose are available
- [ ] PostgreSQL accessible at port 5432 (workspace `docker-compose.yml`)

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 22 LTS | Same runtime as `angebots-engine` |
| Framework | Fastify 5 | Fast, TypeScript-native, schema validation built-in |
| Engine | `engine.ts` (copied) | Zero porting — proven, fully tested |
| ORM | Prisma 6 | Consistent with `angebots-engine` |
| Database | PostgreSQL 16 | Own schema alongside workspace DB |
| Auth | Per-customer service API keys | `Bearer esk_…`, bcrypt-hashed in DB |
| Testing | Vitest 3 | Consistent with `angebots-engine` |

---

## 4. Project Structure

```
wagner-rules-engine/
├── prisma/
│   ├── schema.prisma          ← ServiceApiKey, ExecutionLog tables
│   └── seed.ts                ← Creates first service key for local dev
├── src/
│   ├── engine/                ← Copied from angebots-engine — treat as read-only
│   │   ├── engine.ts          ← runEngine() — the computation core
│   │   ├── types.ts           ← DomainConfig, Komponente, etc. (German-keyed)
│   │   ├── deserializer.ts    ← English JSON → German DomainConfig (for engine.ts)
│   │   └── result-mapper.ts   ← German SimulatorResult → English API response
│   ├── lib/
│   │   ├── db.ts              ← Prisma client singleton
│   │   └── auth.ts            ← Service API key lookup + bcrypt verify
│   ├── plugins/
│   │   └── authenticate.ts    ← Fastify preHandler hook
│   ├── routes/
│   │   └── run.ts             ← POST /run
│   └── server.ts              ← Fastify instance + plugin registration
├── src/__tests__/
│   ├── run.test.ts             ← Integration: POST /run end-to-end
│   └── auth.test.ts            ← Service key validation
├── .env.example
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 5. Database Schema

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model ServiceApiKey {
  id         String    @id @default(cuid())
  label      String                          // e.g. "customer-acme"
  keyHash    String    @unique               // bcrypt hash of raw key
  keyPrefix  String    @db.VarChar(17)       // first 17 chars for fast pre-filter lookup
  active     Boolean   @default(true)
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?

  executions ExecutionLog[]

  @@index([keyPrefix])
  @@map("service_api_keys")
}

model ExecutionLog {
  id              String        @id @default(cuid())
  serviceApiKey   ServiceApiKey @relation(fields: [serviceApiKeyId], references: [id])
  serviceApiKeyId String
  executionTimeMs Int
  fieldCount      Int
  inputCount      Int
  firedRuleCount  Int
  validationCount Int
  componentCount  Int
  createdAt       DateTime      @default(now())

  @@map("execution_logs")
}
```

Key format: `esk_` + 48 hex chars. The `esk_` prefix distinguishes service keys from user API keys (`eak_live_`).

---

## 6. Engine Files

`engine.ts` uses German-keyed TypeScript types internally (`felder`, `regelwerk`, `validierungen`, etc. — see `src/types/domain.ts`). `wagner-offer-studio-core` stores configs with **English** keys. The microservice therefore needs two thin adapters:

1. **`deserializer.ts`** — converts the English-keyed JSON payload from Symfony into the German-keyed `DomainConfig` type that `engine.ts` expects.
2. **`result-mapper.ts`** — converts the German-keyed `SimulatorResult` returned by `runEngine()` into the English API contract.

### 6.1 Copy Engine Files

```bash
cp ../angebots-engine/src/lib/engine.ts   src/engine/engine.ts
cp ../angebots-engine/src/types/domain.ts src/engine/types.ts
```

Add this comment at the top of both copied files:
```typescript
// SOURCE: angebots-engine/src/lib/engine.ts — keep in sync with the reference repo
```

Run `angebots-engine` tests to confirm baseline before writing any microservice code:
```bash
cd ../angebots-engine && npm test   # must be all green
```

### 6.2 `src/engine/deserializer.ts`

```typescript
// SOURCE: angebots-engine/src/lib/engine.ts — keep in sync with the reference repo
import type {
  DomainConfig, Datenfeld, RegelGruppe, FreitextRegel,
  Validierung, Bedingung, BedingungsGruppe, Komponente, PreisItem,
} from './types'

export function deserializeConfig(config: Record<string, unknown>): DomainConfig {
  return {
    felder:        (config.fields        as any[] ?? []).map(deserializeField),
    parameter:     [],
    validierungen: (config.validations   as any[] ?? []).map(deserializeValidation),
    regelwerk: [
      ...(config.ruleGroups   as any[] ?? []).map(deserializeRuleGroup),
      ...(config.freeTextRules as any[] ?? []).map(deserializeFreeTextRule),
    ],
    komponenten:   (config.components    as any[] ?? []).map(deserializeComponent),
  }
}

export function deserializePreisItems(items: unknown[]): PreisItem[] {
  return (items ?? []).map((i: any) => ({
    artikel_nr:   i.articleNumber,
    bezeichnung:  i.name,
    einheit:      i.unit ?? '',
    ek_preis:     i.purchasePrice ?? 0,
    waehrung:     i.currency,
    steuer_prozent: i.taxPercent,
  }))
}

function deserializeField(f: any): Datenfeld {
  return {
    key:      f.key,
    label:    f.label ?? '',
    typ:      f.type,
    standard: f.default ?? null,
    formel:   f.formula ?? undefined,
    optionen: f.options ?? [],
  }
}

function normaliseOp(op: string): string {
  return op === 'contains' ? 'enthält' : op
}

function deserializeCondition(c: any): Bedingung {
  return {
    feld:          c.field ?? '',
    op:            normaliseOp(c.operator),
    wert:          c.value ?? undefined,
    vergleich_feld: c.compareField ?? undefined,
  }
}

function deserializeRuleGroup(g: any): RegelGruppe {
  return {
    ziel_feld:  g.targetField,
    auswertung: 'erste_zutreffende',
    regeln: (g.rules ?? []).map((r: any) => ({
      verknuepfung: r.logic ?? 'AND',
      bedingungen:  (r.conditions ?? []).map(deserializeCondition),
      dann:         r.value,
    })),
  }
}

function deserializeFreeTextRule(r: any): FreitextRegel {
  return {
    typ:       'freitext',
    text:      r.text,
    aktiv_wenn: r.activeWhen
      ? { feld: r.activeWhen.field, op: normaliseOp(r.activeWhen.operator), wert: r.activeWhen.value }
      : null,
  }
}

function deserializeValidation(v: any): Validierung {
  const cond = v.condition
  if (cond?.logic) {
    const group: BedingungsGruppe = {
      verknuepfung: cond.logic,
      regeln:       (cond.conditions ?? []).map(deserializeCondition),
    }
    return { typ: v.type, meldung: v.message, bedingung: group }
  }
  return { typ: v.type, meldung: v.message, bedingung: deserializeCondition(cond ?? {}) }
}

function deserializeComponent(c: any): Komponente {
  return {
    id:         c.id,
    name:       c.name,
    menge_feld: c.quantityField,
    aktivierung: (c.activationRules ?? []).map((r: any) => ({
      feld:          r.field,
      op:            normaliseOp(r.operator),
      wert:          r.value,
      verknuepfung:  r.logic ?? 'AND',
    })),
    varianten: (c.variants ?? []).map((v: any) => ({
      artikel_nr: v.articleNumber,
      standard:   v.default ?? false,
      wenn_feld:  v.whenField ?? undefined,
      op:         v.operator ? normaliseOp(v.operator) : undefined,
      wert:       v.value ?? undefined,
    })),
    abhaengigkeiten: (c.dependencies ?? []).map((d: any) => ({
      komponente_id: d.componentId,
    })),
    konflikte: [],
  }
}
```

### 6.3 `src/engine/result-mapper.ts`

```typescript
import type { SimulatorResult } from './engine'

export function mapResult(result: SimulatorResult) {
  return {
    values: result.values,
    firedRules: result.firedRules.map((r) => ({
      targetField: r.ziel_feld,
      value:       r.dann,
      ruleIndex:   r.regelIndex,
    })),
    activeFreeText: result.activeFreitext.map((f) => ({
      text: f.text,
    })),
    activeComponents: result.activeKomponenten.map((c) => ({
      id:            c.komp.id,
      name:          c.komp.name,
      quantity:      c.menge,
      articleNumber: c.artikel_nr ?? null,  // Variante.artikel_nr is optional
    })),
    validations: result.validierungen.map((v) => ({
      type:    v.typ === 'fehler' ? 'error' : 'warning',
      message: v.meldung,
    })),
  }
}
```

---

## 7. Implementation Tasks

Tasks are strictly ordered. **Do not start a task until all prior tasks pass.**

---

### Task 0 — Scaffold

> **Depends on:** Prerequisites in [§ 2](#2-prerequisites) met  
> **Creates:** `package.json`, `tsconfig.json`, `.env.example`  
> **Modifies:** —  
> **Verify:** `npm run build`  
> **Done when:** Build succeeds; `npm run dev` starts Fastify on port 8000 without error.

```bash
cd angebots-engine-migration
mkdir wagner-rules-engine && cd wagner-rules-engine
npm init -y
npm install fastify @fastify/sensible @fastify/rate-limit prisma @prisma/client bcryptjs dotenv
npm install -D typescript @types/node @types/bcryptjs vitest tsx tsup
npx tsc --init
npx prisma init
```

**`package.json` scripts:**
```json
{
  "scripts": {
    "dev":        "tsx watch src/server.ts",
    "build":      "tsup src/server.ts --format esm --dts",
    "start":      "node dist/server.js",
    "test":       "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:seed":    "tsx prisma/seed.ts"
  }
}
```

**`.env.example`**
```dotenv
DATABASE_URL=postgresql://engine:secret@localhost:5432/rules_engine
PORT=8000
```

---

### Task 1 — Copy Engine Files

> **Depends on:** Task 0  
> **Creates:** `src/engine/engine.ts`, `src/engine/types.ts`  
> **Modifies:** —  
> **Verify:** `cd ../angebots-engine && npm test`  
> **Done when:** Both files present with `// SOURCE:` comment at top; `angebots-engine` test suite green.

```bash
cp ../angebots-engine/src/lib/engine.ts   src/engine/engine.ts
cp ../angebots-engine/src/types/domain.ts src/engine/types.ts
```

Add `// SOURCE: angebots-engine` comment at top of both files.

Verify baseline: `cd ../angebots-engine && npm test` — all green.

---

### Task 2 — Prisma Schema + DB

> **Depends on:** Task 0; PostgreSQL running  
> **Creates:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db.ts`  
> **Modifies:** —  
> **Verify:** `npx prisma migrate dev --name init`; `npm run db:seed`  
> **Done when:** Tables `service_api_keys` and `execution_logs` exist in DB; seed prints a key starting with `esk_`.

Create `prisma/schema.prisma` (see [§ 5](#5-database-schema)). Run:
```bash
npx prisma migrate dev --name init
```

**`src/lib/db.ts`**
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**`prisma/seed.ts`** — creates the first service key for local development:
```typescript
import { prisma } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const raw  = 'esk_' + Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex')
  const hash = await bcrypt.hash(raw, 10)

  await prisma.serviceApiKey.create({
    data: { label: 'local-dev', keyHash: hash, keyPrefix: raw.slice(0, 17) },
  })

  console.log('\nService API key (copy this to ENGINE_SERVICE_KEY in offer-studio-core):')
  console.log(raw, '\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

### Task 3 — Service API Key Auth

> **Depends on:** Task 2  
> **Creates:** `src/lib/auth.ts`, `src/plugins/authenticate.ts`, `src/__tests__/auth.test.ts`  
> **Modifies:** —  
> **Verify:** `npm test -- auth`  
> **Done when:** All 4 auth test cases pass (valid key / invalid key / absent header / revoked key).

**`src/lib/auth.ts`**
```typescript
import { prisma } from './db'
import bcrypt from 'bcryptjs'

export async function resolveServiceKey(
  authHeader: string | undefined
): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer esk_')) return null

  const rawKey = authHeader.slice(7)
  const prefix = rawKey.slice(0, 17)

  const candidates = await prisma.serviceApiKey.findMany({
    where: { keyPrefix: prefix, active: true },
  })

  for (const key of candidates) {
    if (await bcrypt.compare(rawKey, key.keyHash)) {
      await prisma.serviceApiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
      return key.id
    }
  }
  return null
}
```

**`src/plugins/authenticate.ts`**
```typescript
import type { FastifyRequest, FastifyReply } from 'fastify'
import { resolveServiceKey } from '../lib/auth'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const keyId = await resolveServiceKey(request.headers.authorization)
  if (!keyId) {
    reply.code(401).send({ error: 'Invalid or missing service API key' })
    return
  }
  // Attach resolved key ID for use in route handlers
  ;(request as any).serviceApiKeyId = keyId
}
```

Write `src/__tests__/auth.test.ts`:
- Valid key → returns key ID
- Invalid key → returns null
- Absent header → returns null
- Revoked key (`active: false`) → returns null

---

### Task 4 — Adapters: Deserializer + Result Mapper

> **Depends on:** Task 1  
> **Creates:** `src/engine/deserializer.ts`, `src/engine/result-mapper.ts`, `src/__tests__/deserializer.test.ts`  
> **Modifies:** —  
> **Verify:** `npm test -- deserializer`  
> **Done when:** All 6 deserializer assertions pass; `contains` operator correctly normalised to `enthält`.

Create `src/engine/deserializer.ts` and `src/engine/result-mapper.ts` as shown in [§ 6.2](#62-srcenginedeserializerts) and [§ 6.3](#63-srcengineresult-mapperts).

Write tests in `src/__tests__/deserializer.test.ts`:
- Empty arrays in → empty `DomainConfig` out (all German-key arrays present)
- `fields[].type` → `felder[].typ`
- `ruleGroups[].targetField` → `regelwerk[].ziel_feld`
- `freeTextRules[]` appear in `regelwerk[]` as entries with `typ: 'freitext'`
- `contains` operator → `enthält`
- `components[].quantityField` → `komponenten[].menge_feld`

---

### Task 5 — POST /run Route

> **Depends on:** Task 3, Task 4  
> **Creates:** `src/routes/run.ts`, `src/__tests__/run.test.ts`  
> **Modifies:** —  
> **Verify:** `npm test -- run`  
> **Done when:** All 5 run test cases pass (valid payload → 200; missing `config` → 422; missing auth → 401).

**`src/routes/run.ts`**
```typescript
import type { FastifyInstance } from 'fastify'
import { runEngine } from '../engine/engine'
import { deserializeConfig, deserializePreisItems } from '../engine/deserializer'
import { mapResult } from '../engine/result-mapper'
import { authenticate } from '../plugins/authenticate'
import { logExecution } from '../lib/logger'

export async function runRoute(fastify: FastifyInstance) {
  fastify.post('/run', { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const { config, inputs, preisItems } = body as {
      config:     Record<string, unknown>
      inputs:     Record<string, unknown>
      preisItems?: unknown[]
    }

    if (!config || typeof inputs !== 'object' || inputs === null) {
      return reply.code(422).send({
        error:      'Invalid request body',
        violations: ['config is required', 'inputs must be an object'],
      })
    }

    const start = Date.now()

    try {
      const domainConfig  = deserializeConfig(config)
      const priceItemList = deserializePreisItems(preisItems ?? [])
      const result        = runEngine(domainConfig, inputs, priceItemList)
      const ms            = Date.now() - start
      const keyId         = (request as any).serviceApiKeyId as string

      // Extract counts at call site — never pass raw config/inputs to logger
      await logExecution(keyId, ms, {
        fieldCount:      (config.fields as unknown[] | undefined)?.length ?? 0,
        inputCount:      Object.keys(inputs).length,
        firedRuleCount:  result.firedRules.length,
        validationCount: result.validierungen.length,
        componentCount:  result.activeKomponenten.length,
      })

      fastify.log.debug({ ms, fieldCount: config.fields?.length ?? 0 }, 'engine.run')

      return reply.send(mapResult(result))
    } catch (err: any) {
      fastify.log.error({ err: err.message, config, inputs }, 'engine.error')
      return reply.code(500).send({ error: 'Engine execution failed' })
    }
  })
}
```

Write `src/__tests__/run.test.ts`:
- Valid payload with service key → 200 + correct result shape
- Missing `config` key → 422
- `inputs` not an object → 422
- No `Authorization` header → 401
- Invalid service key → 401

---

### Task 6 — Execution Logging

> **Depends on:** Task 2, Task 5  
> **Creates:** `src/lib/logger.ts`  
> **Modifies:** `src/routes/run.ts` (add `logExecution` call)  
> **Verify:** `npm test`  
> **Done when:** `execution_logs` row written after every successful `/run` call; logger errors do not affect the response.

**`src/lib/logger.ts`**
```typescript
import { prisma } from './db'

interface ExecutionCounts {
  fieldCount:      number
  inputCount:      number
  firedRuleCount:  number
  validationCount: number
  componentCount:  number
}

// Never accept raw config or inputs — only counts, never customer data
export async function logExecution(
  serviceApiKeyId: string,
  executionTimeMs: number,
  counts: ExecutionCounts,
): Promise<void> {
  try {
    await prisma.executionLog.create({
      data: { serviceApiKeyId, executionTimeMs, ...counts },
    })
  } catch {
    // Never let logging break the response
  }
}
```

---

### Task 7 — Server Entry Point

> **Depends on:** Task 5, Task 6  
> **Creates:** `src/server.ts`  
> **Modifies:** —  
> **Verify:** `npm run dev`; `curl localhost:8000/health`  
> **Done when:** Health check returns `{"status":"ok"}`; `POST /run` without auth returns 401; body >1 MiB returns 413.

**`src/server.ts`**
```typescript
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { runRoute } from './routes/run'

const fastify = Fastify({
  logger: true,
  bodyLimit: 1_048_576,   // 1 MiB — reject oversized payloads before auth
})

// Per-IP rate limit: 120 req/min (generous for legit automation, blocks hammering)
await fastify.register(rateLimit, { max: 120, timeWindow: '1 minute' })

await fastify.register(runRoute)

fastify.get('/health', async () => ({ status: 'ok' }))

const port = parseInt(process.env.PORT ?? '8000', 10)
await fastify.listen({ port, host: '0.0.0.0' })
```

---

### Task 8 — Dockerfile

> **Depends on:** Task 7  
> **Creates:** `Dockerfile`  
> **Modifies:** —  
> **Verify:** `docker build -t wagner-rules-engine .`  
> **Done when:** Image builds without error; `docker run -p 8000:8000 wagner-rules-engine` starts the service.

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM base AS runtime
COPY --from=deps  /app/node_modules            ./node_modules
COPY --from=build /app/dist                    ./dist
COPY --from=build /app/prisma                  ./prisma
COPY --from=build /app/node_modules/.prisma    ./node_modules/.prisma

EXPOSE 8000
CMD ["node", "dist/server.js"]
```

---

### Task 9 — CI Pipeline

> **Depends on:** Task 8  
> **Creates:** `.github/workflows/ci.yml`  
> **Modifies:** —  
> **Verify:** Push to branch → GitHub Actions run green  
> **Done when:** All CI steps pass including the `engine.ts` drift check against `angebots-engine`.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: rules_engine_test
          POSTGRES_USER: engine
          POSTGRES_PASSWORD: secret
        ports: ['5432:5432']
    env:
      DATABASE_URL: postgresql://engine:secret@localhost:5432/rules_engine_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm test
      - run: npm run build
      - name: Check engine.ts in sync with angebots-engine
        run: |
          git clone --depth=1 https://github.com/<org>/angebots-engine.git /tmp/angebots-engine
          diff src/engine/engine.ts /tmp/angebots-engine/src/lib/engine.ts \
            || (echo "engine.ts drift detected — copy from angebots-engine and commit" && exit 1)
          diff src/engine/types.ts /tmp/angebots-engine/src/types/domain.ts \
            || (echo "types.ts drift detected — copy from angebots-engine and commit" && exit 1)
```

---

## 8. API Contract

```
POST /run
Authorization: Bearer esk_<48-hex-chars>
Content-Type: application/json

Request body:
{
  "config": {
    "fields":        [...],    // English-keyed — deserialized to DomainConfig internally
    "ruleGroups":    [...],
    "freeTextRules": [...],
    "validations":   [...],
    "components":    [...]
  },
  "inputs": {
    "roofArea": 48,
    "tilt": 30
  },
  "preisItems": []             // optional
}

Response 200:
{
  "values":           { "moduleCount": 16, "systemPower": 6.4 },
  "firedRules":       [{ "targetField": "moduleCount", "value": 16, "ruleIndex": 2 }],
  "activeFreeText":   [{ "text": "..." }],
  "activeComponents": [{ "id": "...", "name": "...", "quantity": 1, "articleNumber": "INV-6000" }],
  "validations":      [{ "type": "error", "message": "..." }]
}

Response 401: { "error": "Invalid or missing service API key" }
Response 422: { "error": "Invalid request body", "violations": [...] }
Response 500: { "error": "Engine execution failed" }
```

`GET /health` — no auth, returns `{ "status": "ok" }`.

---

## 9. Service Key Management

Phase 1 — keys are managed via Prisma directly (no admin UI):

```bash
# Create a key for a new customer deployment
npm run db:seed   # or: tsx prisma/seed.ts --label customer-acme

# Revoke a key
npx prisma studio  # or: UPDATE service_api_keys SET active=false WHERE label='...'
```

Each `wagner-offer-studio-core` instance stores its key as `ENGINE_SERVICE_KEY=esk_<...>` in `.env`.

---

## 10. Definition of Done

- [ ] `npm test` passes — zero failures
- [ ] `POST /run` with valid service key + solar fixture config returns correct result shape
- [ ] `POST /run` without auth header → 401
- [ ] `POST /run` with invalid key → 401
- [ ] `POST /run` with revoked key (`active: false`) → 401
- [ ] `POST /run` with missing `config` → 422
- [ ] Execution log row written for every successful run
- [ ] `GET /health` returns 200 without auth
- [ ] `deserializer.test.ts` covers all English→German key mappings
- [ ] `docker build -t wagner-rules-engine .` succeeds
- [ ] Service starts and responds in the workspace `docker-compose` environment
- [ ] `angebots-engine` TS tests still pass unchanged (`npm test` in `angebots-engine/`)
- [ ] CI pipeline passes on `main`

Only after all items above are checked off does Phase 2 (`wagner-offer-studio-core`) begin.
