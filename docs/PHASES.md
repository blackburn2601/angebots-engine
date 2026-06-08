# Implementation Phases — Wagner Offer Studio Migration

> **Start here.** Read this file before opening any implementation plan.  
> Each phase must reach its gate condition before the next begins. Do not start Phase 2 before Phase 1's gate is green.

---

## File Map

| File | Covers |
|---|---|
| `migration-plan-php-symfony.md` | Architecture overview, workspace docker-compose, API contracts, tech stack, phased roadmap — no code |
| `impl-plan-wagner-rules-engine.md` | **Phase 1** — TS engine microservice (Tasks 0–9) |
| `impl-plan-wagner-offer-studio-core-p1.md` | **Phase 2a** — Symfony API foundation: scaffold, entities, auth (Tasks 0–4) |
| `impl-plan-wagner-offer-studio-core-p2.md` | **Phase 2b** — Symfony API business logic: CRUD, engine, webhooks, CI (Tasks 5–15) |
| `impl-plan-wagner-offer-studio-ui.md` | **Phase 3** — Vue 3 SPA (Tasks 0–18) |

---

## Cross-Cutting Constraints

These apply across every phase and every repo. An AI agent must read these before implementing any task.

- **`src/engine/engine.ts` and `src/engine/types.ts` in `wagner-rules-engine` are read-only copies** — never edit them directly. Sync from `angebots-engine` only.
- **The type contract in `src/types/index.ts` (UI) must exactly match `deserializer.ts` (engine).** A key mismatch causes a silent runtime failure with no error.
- **`logExecution()` must never receive raw `config` or `inputs`** — counts only, never customer data.
- **`configJson` in `wagner-offer-studio-core` is a native Doctrine `json` column with English keys** — not a string, not German keys.
- **Never push directly to `main`.** Feature branch + pull request for every change.
- **Run `angebots-engine` test suite before and after any engine-related change** — it is the ground truth.

---

## Phase 0 — Workspace Setup (~1 day)

**Outcome:** Four repos cloned side by side, `angebots-engine` test suite green, workspace docker-compose up.

Checklist: `migration-plan-php-symfony.md` § 11 (Phase 0).

**Gate:** `cd angebots-engine && npm test` — all green.

---

## Phase 1 — `wagner-rules-engine` Engine Microservice (3–4 days)

**Outcome:** Shared TypeScript microservice running at `http://localhost:8001`. Single `POST /run` endpoint, service API key auth (`Bearer esk_…`), execution logging, Dockerfile, CI.

→ **[`impl-plan-wagner-rules-engine.md`](impl-plan-wagner-rules-engine.md)**

**Gate:**
```bash
npm test                                           # all Vitest tests green
curl -s http://localhost:8001/health               # {"status":"ok"}
```

---

## Phase 2a — `wagner-offer-studio-core`: Foundation (4–5 days)

**Outcome:** Symfony project scaffolded with all config files, Doctrine entities + migrations, JWT two-token auth, and API key authenticator.

→ **[`impl-plan-wagner-offer-studio-core-p1.md`](impl-plan-wagner-offer-studio-core-p1.md)**

**Gate:**
```bash
vendor/bin/phpunit --filter AuthControllerTest      # login, refresh, logout, /me
vendor/bin/phpunit --filter ApiKeyAuthenticatorTest # bearer eak_live_ grants access
```

---

## Phase 2b — `wagner-offer-studio-core`: Business Logic (1.5 weeks)

**Outcome:** All API endpoints live — Domain/Pricelist/User/ApiKey CRUD, engine proxy, external API, logging, rate limiting, webhook dispatch, admin controllers, Dockerfile, CI.

→ **[`impl-plan-wagner-offer-studio-core-p2.md`](impl-plan-wagner-offer-studio-core-p2.md)**

**Gate:**
```bash
composer test                                      # zero failures, zero errors
# end-to-end smoke test:
curl -X POST http://localhost:8000/api/v1/domains/{id}/run \
  -H 'Authorization: Bearer <access-token>' \
  -d '{"inputs": {...}}' | jq .data.values
```

---

## Phase 3 — `wagner-offer-studio-ui` Vue SPA (2.5 weeks)

**Outcome:** Vue 3 SPA with auth, 5-tab domain editor, configurator (explicit Calculate button), admin pages, nginx Dockerfile, CI.

→ **[`impl-plan-wagner-offer-studio-ui.md`](impl-plan-wagner-offer-studio-ui.md)**

**Gate:**
```bash
npm test -- --run                                  # all Vitest tests green
npm run build                                      # zero TypeScript errors
docker build -t wagner-offer-studio-ui .           # image builds
```

---

## Phase 4 — Data Migration & Launch (1 week)

**Outcome:** `angebots-engine` production data migrated to `wagner-offer-studio-core`; all systems verified end-to-end; `angebots-engine` decommissioned.

Steps: `impl-plan-wagner-offer-studio-core-p2.md` [§ 7 Data Migration](#7-data-migration-from-angebots-engine-phase-4).

**Gate:** Row counts match source DB; `config_json` round-trip verified; smoke tests pass on migrated data.

---

## Quick Navigation

| Task | Where to look |
|---|---|
| Engine deserialization (English → German) | `impl-plan-wagner-rules-engine.md` [§ 6.2](#62-srcenginedeserializerts) |
| Engine result mapping (German → English) | `impl-plan-wagner-rules-engine.md` [§ 6.3](#63-srcengineresult-mapperts) |
| Service API key format (`esk_…`) | `impl-plan-wagner-rules-engine.md` [§ 5](#5-database-schema) |
| JWT two-token auth flow | `impl-plan-wagner-offer-studio-core-p1.md` Task 3 |
| `configJson` English key schema | `impl-plan-wagner-offer-studio-core-p2.md` [§ 6](#6-domainconfigserializer) |
| German → English key conversion map (migration) | `impl-plan-wagner-offer-studio-core-p2.md` [§ 7](#7-data-migration-from-angebots-engine-phase-4) |
| Vue type contract (`src/types/index.ts`) | `impl-plan-wagner-offer-studio-ui.md` [§ 5](#5-types) |
| Calculate button pattern (no auto-submit) | `impl-plan-wagner-offer-studio-ui.md` Task 9 |
| Workspace docker-compose | `migration-plan-php-symfony.md` [§ 2](#2-migration-workspace-setup) |
