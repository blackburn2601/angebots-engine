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
    coverage: {
      provider: "v8",
      include: ["src/lib/engine.ts", "src/services/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
```

The `@/` path alias is replicated here so tests can import from `@/lib/engine` etc.

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

Tests for `DomainService` — these hit a real PostgreSQL database.

They require `DATABASE_URL` to point to a running test database.

Setup/teardown:
```typescript
beforeEach(async () => {
  await truncateDomains();  // Clean state before each test
});
afterAll(async () => {
  await db.$disconnect();
});
```

`truncateDomains()` is in `src/__tests__/helpers/db.ts` — it runs `DELETE FROM "Domain"`.

---

## Running integration tests locally

Start the local Postgres DB (from docker-compose):

```bash
docker compose up -d postgres
```

Ensure `DATABASE_URL` in `.env` points to it:
```env
DATABASE_URL="postgresql://angebots:secret@localhost:5432/angebots_engine"
```

Then run tests normally:
```bash
npm test
```

---

## CI — GitHub Actions

Workflow: `.github/workflows/ci.yml`

Runs on every push to `main` and `feature/**` branches, and on all pull requests to `main`.

Steps:
1. **Checkout** source
2. **Setup Node.js 20** with npm cache
3. **`npm ci`** — install dependencies
4. **`npx prisma migrate deploy`** — create test DB schema
5. **`npm test`** — run all tests
6. **`npm run build`** — verify production build works

The CI environment spins up a Postgres 16 service container and sets `DATABASE_URL` automatically.

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

The tests use a **separate** database from development:

| Environment | Database |
|---|---|
| Local dev | `angebots_engine` |
| CI tests | `angebots_engine_test` |
| Production | `angebots_engine` (or customer-named) |

You can also create a separate local test DB:

```bash
# In docker-compose, the default DB is angebots_engine
# For tests, you can use it directly (the beforeEach truncates data)
# Or create a separate DB:
docker compose exec postgres psql -U angebots -c "CREATE DATABASE angebots_engine_test;"
```

Then set `DATABASE_URL` to the test DB when running tests:
```bash
DATABASE_URL="postgresql://angebots:secret@localhost:5432/angebots_engine_test" npm test
```

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
