# Testing

## Test runner: Vitest

The project uses **Vitest** — a fast, Jest-compatible test runner built on Vite.

Config: `vitest.config.ts`

```typescript
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/engine.ts", "src/services/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
```

The `@/` path alias is replicated here so tests can import from `@/lib/engine` etc. The
`setupFiles` entry runs `src/__tests__/setup.ts` once per worker **before any test module** —
it loads the test `DATABASE_URL` from `.env.test` (unless one is already set) and runs the
test-DB guard, so tests can never accidentally open the dev database.

---

## Running tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Test types

### Unit tests: `src/__tests__/engine.test.ts`

Tests for `src/lib/engine.ts` — the pure rule engine function. No database required.

These run fast (milliseconds) and test every operator, formula, validation type, and component activation scenario.

Example:
```typescript
it("evaluates basic arithmetic", () => {
  const config = emptyConfig({
    felder: [{ key: "flaeche", label: "Fläche", typ: "formula", formel: "laenge * breite" }],
  });
  const { values } = runEngine(config, { laenge: 5, breite: 4 });
  expect(values.flaeche).toBe(20);
});
```

### Integration tests: `src/__tests__/services/domain.service.test.ts`

Tests for `DomainService` — these hit a real PostgreSQL database (the disposable test DB,
see below).

Setup/teardown:
```typescript
beforeEach(async () => {
  await truncateDomains();  // Clean state before each test
});
afterAll(async () => {
  await db.$disconnect();
});
```

Helpers live in `src/__tests__/helpers/db.ts`:
- `truncateDomains()` — deletes `DomainPricelist` then `Domain` (via Prisma `deleteMany`).
- `truncateAll()` — wipes every table, for tests that touch more than domains.

Both re-invoke the `assertTestDatabase` guard before deleting anything.

---

## Running integration tests locally

You don't need to set anything up by hand — `npm test` runs a `pretest` hook
(`scripts/ensure-test-db.mjs`) that starts the disposable test database and applies migrations
to it automatically:

```bash
npm test          # pretest auto-starts the test DB, then runs the suite
```

The test database is defined in `docker-compose.test.yml` — a throwaway Postgres on host port
**5433** whose data lives in `tmpfs` (RAM, wiped on stop), with the DB name `angebots_engine_test`.
Its connection string lives in the committed **`.env.test`**:

```env
DATABASE_URL="postgresql://angebots:secret@localhost:5433/angebots_engine_test"
```

To control the container manually:
```bash
npm run test:db:up     # docker compose -f docker-compose.test.yml up -d --wait
npm run test:db:down   # stop and remove it
```

**Safety guard:** `src/__tests__/helpers/assert-test-db.ts` aborts the run if `DATABASE_URL`'s
database name does not end in `_test` — the integration tests truncate tables, so they must
only ever target a disposable test DB. Never point tests at the dev or prod database.

---

## CI — GitHub Actions

Workflow: `.github/workflows/ci.yml`

Runs on every push to `main` and `feature/**` branches, and on all pull requests to `main`.

Steps:
1. **Checkout** source
2. **Setup Node.js 26** with npm cache
3. **`npm ci`** — install dependencies
4. **`npx prisma migrate deploy`** — create test DB schema
5. **`npm test`** — run all tests
6. **`npm run build`** — verify production build works

The CI environment spins up a Postgres 16 service container (DB `angebots_engine_test`) and sets
`DATABASE_URL` automatically. The `pretest` hook detects CI (`$CI`) and skips the local
docker-compose test DB, since CI provisions its own `_test` service and runs migrations as a
separate step.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: angebots
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: angebots_engine_test
```

---

## Test database vs dev database

Tests run against a **completely separate, disposable** database — never the dev DB:

| Environment | Database | Host port | Source |
|---|---|---|---|
| Local dev | `angebots_engine` | 5544 | `docker-compose.yml` |
| Local tests | `angebots_engine_test` | 5433 (tmpfs) | `docker-compose.test.yml` + `.env.test` |
| CI tests | `angebots_engine_test` | 5432 (service) | `.github/workflows/ci.yml` |
| Production | `angebots_engine` (or customer-named) | — | deployment env |

You normally don't manage the test DB by hand — the `pretest` hook does it. The old manual
`CREATE DATABASE` step is no longer needed: the test DB is a dedicated container, its URL is in
`.env.test`, and the `assertTestDatabase` guard enforces that any test run targets a `*_test`
database.

---

## What is tested, what is not

| Tested | Not tested |
|---|---|
| All engine operators and edge cases | API route handlers |
| Formula evaluation + security guard | Next.js pages |
| Component activation + dependencies | React components |
| DomainService CRUD + slug logic | Authentication flows |
| DomainService.parseConfig() | UI interactions |

API routes and pages are not covered by tests — they rely on TypeScript type safety and manual testing. Consider adding more integration tests for API routes if the project grows.

---

## Adding new tests

Engine tests (no DB):
```typescript
// src/__tests__/engine.test.ts
it("your test description", () => {
  const config = emptyConfig({ felder: [...], regelwerk: [...] });
  const { values } = runEngine(config, { input_field: 42 });
  expect(values.output_field).toBe(expectedValue);
});
```

Service integration tests:
```typescript
// src/__tests__/services/my.service.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { MyService } from "@/services/MyService";
import { db, truncateMyTable } from "../helpers/db";

beforeEach(async () => { await truncateMyTable(); });
afterAll(async () => { await db.$disconnect(); });

describe("MyService", () => {
  it("does something", async () => {
    const result = await MyService.create({ name: "Test" });
    expect(result.name).toBe("Test");
  });
});
```
