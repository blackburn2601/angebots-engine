# Migration Plan: Angebots-Engine → PHP / Symfony / Doctrine / Vue.js

> Created: 2026-05-07
> Updated: 2026-05-12
> Status: **Active — approved**

---

## Overview

The migration runs inside a shared parent directory called **`angebots-engine-migration`** containing three independent git repositories. The original codebase stays untouched as a live reference. The new system is split into a standalone rules engine microservice and a fully decoupled main application.

All code, naming, API contracts, and documentation are written in **English**.

### Repository Layout

```
angebots-engine-migration/
├── angebots-engine/            ← Existing repo — cloned reference, read-only during migration
├── wagner-rules-engine/        ← NEW: Rules engine microservice
├── wagner-offer-studio-core/   ← NEW: Symfony REST API
└── wagner-offer-studio-ui/     ← NEW: Vue.js SPA
```

| # | Repo | Purpose |
|---|---|---|
| 0 | `angebots-engine` | Current production codebase — live reference throughout the entire migration |
| 1 | `wagner-rules-engine` | NEW: Rules engine microservice — TypeScript/Node.js, shared platform service |
| 2 | `wagner-offer-studio-core` | NEW: Symfony REST API — auth, CRUD, engine proxy, webhooks |
| 3 | `wagner-offer-studio-ui` | NEW: Vue.js SPA — domain editor, configurator, admin |

### Why Four Repos

Having all four repos side by side in one directory is the core working strategy:

- **`angebots-engine` is the living reference.** Every piece of logic, every edge case, every test already exists there in TypeScript. When building any of the new repos, open the corresponding file in `angebots-engine` right next to it. You always know exactly what the correct behaviour is — no guessing, no ambiguity, no relying on documentation.
- **Full access to the original logic at all times.** `src/lib/engine.ts` is the ground truth for `wagner-rules-engine`. `src/services/**` is the ground truth for `wagner-offer-studio-core`'s use cases. `src/app/api/v1/**` is the ground truth for every API route. `src/app/(app)/**` is the ground truth for every UI page in `wagner-offer-studio-ui`.
- **`angebots-engine` stays runnable and untouched.** It is the production fallback until `wagner-offer-studio-core` + `wagner-offer-studio-ui` are live, and the data source for the final DB migration script.
- **Clean separation between concerns.** API and UI are independent git repos — `wagner-offer-studio-ui` talks to `wagner-offer-studio-core` only over HTTP. No shared code, no coupling.

---

## 1. System Architecture

```
angebots-engine-migration/
│
│  ┌──────────────────────────────────────────┐
│  │  wagner-offer-studio-ui                  │
│  │  (Vite + Vue 3 + Pinia)                  │
│  │                                          │
│  │  - Login / Dashboard                     │
│  │  - Domain Editor (5 tabs)                │
│  │  - Configurator  [Calculate button]      │
│  │  - Pricelist Editor                      │
│  │  - Admin pages                           │
│  └──────────────┬───────────────────────────┘
│                 │ HTTP /api/v1/**  (JWT or API key)
│  ┌──────────────▼───────────────────────────┐
│  │  wagner-offer-studio-core                │
│  │  Symfony REST API                        │
│  │                                          │
│  │  - Auth (JWT)                            │
│  │  - Domain / Pricelist / User CRUD        │
│  │  - External API (API key auth)           │
│  │  - Webhook dispatch (Messenger)          │
│  └──────────┬──────────────┬────────────────┘
│             │ SQL           │ POST /run  (internal network)
│  ┌──────────▼────────┐  ┌──▼──────────────────────────────┐
│  │  PostgreSQL        │  │  wagner-rules-engine            │
│  └────────────────────┘  │  POST /run → EngineResult       │
│                          │  - TypeScript engine.ts         │
│                          │  - Service API key auth         │
│                          │  - Own PostgreSQL (exec logs)   │
│                          └─────────────────────────────────┘
│
│  angebots-engine/   (live reference — always open alongside the new repos)
```

**Clean Architecture layers** (both new repos):

```
src/
├── Domain/          ← Pure business logic, zero framework dependencies
├── Application/     ← Use cases, orchestration, interfaces
├── Infrastructure/  ← Doctrine, HTTP clients, external services
└── UI/              ← Symfony controllers, request/response DTOs
```

---

## 2. Migration Workspace Setup

```bash
mkdir angebots-engine-migration
cd angebots-engine-migration

# Reference repo — the current production codebase
git clone git@github.com:<org>/angebots-engine.git

# New microservice
git clone git@github.com:<org>/wagner-rules-engine.git        # or: git init wagner-rules-engine

# New REST API
git clone git@github.com:<org>/wagner-offer-studio-core.git        # or: git init wagner-offer-studio-core

# New Vue SPA
git clone git@github.com:<org>/wagner-offer-studio-ui.git          # or: git init wagner-offer-studio-ui
```

Each directory is its own git repo with its own remote. The parent directory `angebots-engine-migration` is **not** a git repo itself — no nested submodules, no monorepo tooling.

### Local Docker Compose (workspace-level)

A single `docker-compose.yml` at the workspace root wires everything together for local development:

```yaml
# angebots-engine-migration/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: offer_studio
      POSTGRES_USER: offer
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"

  wagner-rules-engine:
    build: ./wagner-rules-engine
    ports:
      - "8001:8000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://offer:secret@postgres:5432/rules_engine
    depends_on:
      - postgres

  wagner-offer-studio-core:
    build: ./wagner-offer-studio-core
    ports:
      - "8000:8000"
    environment:
      APP_ENV: dev
      DATABASE_URL: postgresql://offer:secret@postgres:5432/offer_studio
      ENGINE_BASE_URL: http://wagner-rules-engine:8000
      ENGINE_SERVICE_KEY: "esk_..."    # set to the key created by npm run db:seed in wagner-rules-engine
    depends_on:
      - postgres
      - wagner-rules-engine

  wagner-offer-studio-ui:
    build: ./wagner-offer-studio-ui
    ports:
      - "5173:80"
    environment:
      VITE_API_URL: http://localhost:8000
    depends_on:
      - wagner-offer-studio-core
```

---

## 3. Repo 1 — `wagner-rules-engine` (Rules Engine Microservice)

### Purpose

A **TypeScript/Node.js microservice** — a thin HTTP wrapper around the existing `engine.ts` computation core. It exposes a single endpoint (`POST /run`), authenticates callers by per-customer service API key, and logs every execution to its own PostgreSQL tables.

This is a **shared platform service**: one deployment serves all customer instances. Each customer's `wagner-offer-studio-core` Symfony backend has its own `esk_…` service key. The microservice never stores customer domain configs or user data — all input arrives in the request body and all output is returned immediately.

See [`docs/impl-plan-wagner-rules-engine.md`](impl-plan-wagner-rules-engine.md) for the full task-level implementation plan.

### Directory Structure

```
wagner-rules-engine/
├── prisma/
│   ├── schema.prisma          ← ServiceApiKey, ExecutionLog tables
│   └── seed.ts                ← Creates first service key for local dev
├── src/
│   ├── engine/                ← Copied from angebots-engine — treat as read-only
│   │   ├── engine.ts          ← runEngine() — the computation core
│   │   ├── types.ts           ← DomainConfig etc. (German-keyed)
│   │   ├── deserializer.ts    ← English JSON → German DomainConfig
│   │   └── result-mapper.ts   ← German SimulatorResult → English API response
│   ├── lib/
│   │   ├── db.ts              ← Prisma client singleton
│   │   ├── auth.ts            ← Service API key lookup + bcrypt verify
│   │   └── logger.ts          ← Execution log writer
│   ├── plugins/
│   │   └── authenticate.ts    ← Fastify preHandler hook
│   ├── routes/
│   │   └── run.ts             ← POST /run
│   └── server.ts              ← Fastify instance + plugin registration
├── src/__tests__/
│   ├── run.test.ts
│   ├── auth.test.ts
│   └── deserializer.test.ts
├── Dockerfile
└── package.json
```

### API Contract

```
POST /run
Authorization: Bearer esk_<48-hex-chars>

Request:
{
  "config": {
    "fields": [...],
    "ruleGroups": [...],
    "freeTextRules": [...],
    "validations": [...],
    "components": [...]
  },
  "inputs": {
    "roofArea": 48,
    "tilt": 30,
    "orientation": "south"
  }
}

Response 200:
{
  "values": {
    "moduleCount": 16,
    "systemPower": 6.4,
    "totalPriceNet": 8240.00
  },
  "firedRules": [
    { "targetField": "moduleCount", "value": 16, "ruleIndex": 2 }
  ],
  "validations": [],
  "activeComponents": [
    {
      "id": "comp_inverter",
      "name": "Inverter",
      "quantity": 1,
      "articleNumber": "INV-6000"
    }
  ],
  "activeFreeText": []
}

Response 422:
{
  "error": "Invalid domain config",
  "violations": [...]
}
```

---

## 4. Repo 2 — `wagner-offer-studio-core` (Main Application)

### Directory Structure

```
wagner-offer-studio-core/
│
├── config/
│   ├── packages/
│   │   ├── doctrine.yaml
│   │   ├── lexik_jwt_authentication.yaml
│   │   ├── nelmio_cors.yaml
│   │   └── security.yaml
│   ├── routes/
│   │   └── api.yaml
│   └── services.yaml
│
├── src/
│   ├── Domain/
│   │   ├── Domain/
│   │   │   ├── Domain.php
│   │   │   ├── DomainRepository.php       ← Interface
│   │   │   └── DomainSlug.php             ← Value Object
│   │   ├── Pricelist/
│   │   │   ├── Pricelist.php
│   │   │   ├── PricelistRepository.php
│   │   │   └── PriceItem.php
│   │   ├── User/
│   │   │   ├── User.php
│   │   │   ├── UserRepository.php
│   │   │   └── UserRole.php               ← PHP Enum
│   │   └── Shared/
│   │       ├── ValueObject/
│   │       │   └── Cuid.php
│   │       └── Exception/
│   │           └── DomainException.php
│   │
│   ├── Application/
│   │   ├── Engine/
│   │   │   ├── RunEngineUseCase.php       ← Calls wagner-rules-engine via interface
│   │   │   ├── RunEngineCommand.php
│   │   │   └── EngineServiceInterface.php ← Abstraction over HTTP call
│   │   ├── Domain/
│   │   │   ├── CreateDomainUseCase.php
│   │   │   ├── UpdateDomainUseCase.php
│   │   │   ├── DuplicateDomainUseCase.php
│   │   │   └── DeleteDomainUseCase.php
│   │   ├── Pricelist/
│   │   │   ├── CreatePricelistUseCase.php
│   │   │   └── UpdatePricelistUseCase.php
│   │   ├── User/
│   │   │   ├── CreateUserUseCase.php
│   │   │   └── UpdateUserUseCase.php
│   │   └── Webhook/
│   │       └── DispatchWebhookUseCase.php
│   │
│   ├── Infrastructure/
│   │   ├── Engine/
│   │   │   └── HttpEngineService.php      ← Calls wagner-rules-engine via HTTP
│   │   ├── Persistence/
│   │   │   ├── Doctrine/
│   │   │   │   ├── Entity/
│   │   │   │   │   ├── DomainEntity.php
│   │   │   │   │   ├── PricelistEntity.php
│   │   │   │   │   ├── UserEntity.php
│   │   │   │   │   ├── ApiKeyEntity.php
│   │   │   │   │   ├── ApiLogEntity.php
│   │   │   │   │   └── WebhookUrlEntity.php
│   │   │   │   └── Repository/
│   │   │   │       ├── DoctrineDomainRepository.php
│   │   │   │       ├── DoctrinePricelistRepository.php
│   │   │   │       └── DoctrineUserRepository.php
│   │   │   └── Serializer/
│   │   │       └── DomainConfigSerializer.php
│   │   ├── Security/
│   │   │   ├── ApiKeyAuthenticator.php
│   │   │   └── JwtAuthenticator.php
│   │   ├── RateLimit/
│   │   │   └── LoginRateLimiter.php
│   │   └── Webhook/
│   │       └── HttpWebhookDispatcher.php
│   │
│   └── UI/
│       ├── Controller/
│       │   ├── Auth/
│       │   │   └── AuthController.php
│       │   ├── Internal/
│       │   │   ├── DomainController.php
│       │   │   ├── PricelistController.php
│       │   │   ├── UserController.php
│       │   │   ├── ApiKeyController.php
│       │   │   └── Admin/
│       │   │       ├── LogController.php
│       │   │       └── WebhookController.php
│       │   └── External/
│       │       ├── ExternalDomainController.php
│       │       └── ExternalPricelistController.php
│       ├── Request/
│       │   ├── CreateDomainRequest.php
│       │   └── UpdateDomainConfigRequest.php
│       └── Transformer/
│           ├── DomainTransformer.php
│           └── PricelistTransformer.php

└── tests/
    ├── Integration/
    │   └── UI/Controller/
    └── Fixtures/
```

---

## 5. Engine Source (`wagner-rules-engine`)

`wagner-rules-engine` is a TypeScript/Node.js microservice — it does **not** contain a PHP port of the engine. The computation logic stays in the original `engine.ts` and is copied into `src/engine/` of the new repo.

**Source files (copied, not ported):**

| Destination | Source |
|---|---|
| `wagner-rules-engine/src/engine/engine.ts` | `angebots-engine/src/lib/engine.ts` |
| `wagner-rules-engine/src/engine/types.ts`  | `angebots-engine/src/types/domain.ts` |

Both files must stay in sync with `angebots-engine` whenever engine logic changes. Add `// SOURCE: angebots-engine/src/lib/engine.ts — keep in sync` at the top of each copied file.

**Why copying, not a package:** During the migration phase all four repos live side by side. Copying avoids a publish/version cycle and keeps the reference visible. Post-migration, publishing `@wagner/rules-engine-core` as an npm package is a natural upgrade.

**Naming note:** The TypeScript `DomainConfig` interface uses German field names (`felder`, `regelwerk`, `validierungen`, `komponenten`). The microservice's `deserializer.ts` maps the English-keyed JSON from `wagner-offer-studio-core` to these German types before calling `runEngine()`. The `result-mapper.ts` maps the German-named `SimulatorResult` back to the English API contract. See `impl-plan-wagner-rules-engine.md` §6 for the full mapping code.


---

## 6. wagner-offer-studio-core — Engine Integration

`wagner-offer-studio-core` never imports `RulesEngine` or any `wagner-rules-engine` class. It depends on `EngineServiceInterface`, satisfied by `HttpEngineService` in production and a fake in tests.

```php
// wagner-offer-studio-core/src/Application/Engine/EngineServiceInterface.php
interface EngineServiceInterface
{
    // preisItems: English-keyed price items forwarded from the client request.
    // Pass an empty array when the caller did not include pricelist data.
    public function run(array $config, array $inputs, array $preisItems = []): array;
}

// wagner-offer-studio-core/src/Application/Engine/RunEngineCommand.php
final class RunEngineCommand
{
    public function __construct(
        public readonly string $domainId,
        public readonly array  $inputs,
        public readonly array  $preisItems = [],  // forwarded from POST /domains/:id/run body
    ) {}
}

// wagner-offer-studio-core/src/Application/Engine/RunEngineUseCase.php
final class RunEngineUseCase
{
    public function __construct(
        private readonly DomainRepository       $domainRepository,
        private readonly EngineServiceInterface $engineService,
    ) {}

    public function execute(RunEngineCommand $command): array
    {
        $domain = $this->domainRepository->findById($command->domainId)
            ?? throw new DomainNotFoundException($command->domainId);

        return $this->engineService->run(
            $domain->getConfigJson(),
            $command->inputs,
            $command->preisItems,   // forwarded — not silently dropped
        );
    }
}

// wagner-offer-studio-core/src/Infrastructure/Engine/HttpEngineService.php
final class HttpEngineService implements EngineServiceInterface
{
    public function __construct(
        private readonly HttpClientInterface $client,
        private readonly string              $engineBaseUrl,
        private readonly string              $engineServiceKey,  // esk_… from ENGINE_SERVICE_KEY env var
    ) {}

    public function run(array $config, array $inputs, array $preisItems = []): array
    {
        return $this->client
            ->request('POST', $this->engineBaseUrl . '/run', [
                'json'    => ['config' => $config, 'inputs' => $inputs, 'preisItems' => $preisItems],
                'headers' => ['Authorization' => 'Bearer ' . $this->engineServiceKey],
            ])
            ->toArray();
    }
}
```

---

## 7. Doctrine Entities (wagner-offer-studio-core)

> **Reference stubs only.** The key column mappings and lifecycle annotations are illustrated below.
> Full entity implementations with all fields, constructors, and getters are in
> [`impl-plan-wagner-offer-studio-core-p1.md`](impl-plan-wagner-offer-studio-core-p1.md) Task 2.

### User

```php
#[ORM\Entity]
#[ORM\Table(name: 'users')]
class UserEntity
{
    #[ORM\Column(type: 'string', enumType: UserRole::class)]
    private UserRole $role;

    #[ORM\Column(type: 'boolean', options: ['default' => true])]
    private bool $active = true;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $mustChangePassword = false;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastLogin;
}
```

### Domain

```php
#[ORM\Entity]
#[ORM\Table(name: 'domains')]
#[ORM\HasLifecycleCallbacks]
class DomainEntity
{
    #[ORM\Column(type: 'json')]
    private array $configJson = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }
}
```

### ApiLog

```php
#[ORM\Entity]
#[ORM\Table(name: 'api_logs')]
#[ORM\Index(columns: ['timestamp'], name: 'idx_log_time')]
#[ORM\Index(columns: ['path'], name: 'idx_log_path')]
#[ORM\Index(columns: ['status_code'], name: 'idx_log_status')]
class ApiLogEntity
{
    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $timestamp;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $statusCode;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $durationMs;
}
```

---

## 8. API Design (wagner-offer-studio-core)

### Route Map

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me

GET    /api/v1/domains
POST   /api/v1/domains
GET    /api/v1/domains/{id}
PATCH  /api/v1/domains/{id}
DELETE /api/v1/domains/{id}
POST   /api/v1/domains/{id}/duplicate
POST   /api/v1/domains/{id}/run         ← Proxies to wagner-rules-engine

GET    /api/v1/pricelists
POST   /api/v1/pricelists
GET    /api/v1/pricelists/{id}
PATCH  /api/v1/pricelists/{id}
DELETE /api/v1/pricelists/{id}

GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/{id}
DELETE /api/v1/users/{id}

GET    /api/v1/api-keys
POST   /api/v1/api-keys
DELETE /api/v1/api-keys/{id}

GET    /api/v1/admin/logs
DELETE /api/v1/admin/logs

GET    /api/v1/admin/webhooks
POST   /api/v1/admin/webhooks
PATCH  /api/v1/admin/webhooks/{id}
DELETE /api/v1/admin/webhooks/{id}

# External (API key auth)
GET    /api/v1/external/domains
GET    /api/v1/external/domains/{id}
GET    /api/v1/external/pricelists
GET    /api/v1/external/pricelists/{id}
```

### Security

```yaml
# wagner-offer-studio-core/config/packages/security.yaml
security:
  firewalls:
    api_external:
      pattern: ^/api/v1/external
      stateless: true
      custom_authenticators:
        - WagnerOfferStudio\Infrastructure\Security\ApiKeyAuthenticator

    api_internal:
      pattern: ^/api/v1
      stateless: true
      jwt: ~

  access_control:
    - { path: ^/api/v1/auth,       roles: PUBLIC_ACCESS }
    - { path: ^/api/v1/external,   roles: ROLE_API_KEY }   # ApiKeyAuthenticator grants this role
    - { path: ^/api/v1/admin,      roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1/users,      roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1/api-keys,   roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1,            roles: ROLE_SELLER }
```

---

## 9. Frontend — `wagner-offer-studio-ui`

The Vue.js SPA is a **separate repository** — see [`docs/impl-plan-wagner-offer-studio-ui.md`](impl-plan-wagner-offer-studio-ui.md) for the full implementation plan.

There is no TypeScript engine port in the browser. All calculations go through the single authoritative engine endpoint.

**Configurator flow:**
1. User fills in fields
2. User clicks **Calculate**
3. `POST /api/v1/domains/{id}/run` → `wagner-offer-studio-core` → `wagner-rules-engine`
4. Result displayed

This keeps the UI a pure presentation layer with zero engine logic.

---

## 10. Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Engine runtime | Node.js 22 LTS + TypeScript | Engine stays in original language — zero porting risk |
| Engine framework | Fastify 5 | Fast, TypeScript-native |
| Engine auth | Per-customer service API keys (`esk_…`) | One key per customer Symfony instance; revocable independently |
| PHP | 8.3 | Enums, readonly properties |
| Framework | Symfony 7 LTS | Long-term support |
| ORM | Doctrine 3 | Standard for Symfony |
| Auth | LexikJWTAuthBundle | Two-token: 15-min access token (memory) + 30-day refresh token (httpOnly cookie) |
| CORS | NelmioCorsBundle | One config block |
| Rate limiting | Custom Doctrine | LoginAttempt table — 5 attempts / 15 min / IP, no Redis needed |
| HTTP client | symfony/http-client | Used by HttpEngineService |
| Database | PostgreSQL 16 | Native JSON, best Doctrine support |
| Frontend | Vue 3 + Composition API | Closest to React mental model |
| State | Pinia | Official Vue state manager |
| HTTP client (FE) | Axios | JWT interceptors |
| Build | Vite | Fast, simple |
| CSS | Tailwind CSS | Carries over 1:1 |
| Testing | Vitest (engine) + PHPUnit (API) | Consistent with angebots-engine; PHPUnit for Symfony |

---

## 11. Phased Roadmap

### Phase 0 — Workspace & Repo Setup (1 day)
- [ ] Create parent directory `angebots-engine-migration/`
- [ ] Clone `angebots-engine` into it (read-only reference) and confirm `npm test` is green
- [ ] Create `wagner-rules-engine` repo — init Node.js/TypeScript + Fastify project, set up CI
- [ ] Create `wagner-offer-studio-core` repo — init Symfony skeleton, set up CI
- [ ] Create `wagner-offer-studio-ui` repo — init Vue 3 / Vite project, set up CI
- [ ] Write workspace-level `docker-compose.yml` (postgres, wagner-rules-engine, wagner-offer-studio-core)

### Phase 1 — `wagner-rules-engine`: Engine Microservice (3–4 days)

> **Full task breakdown, deserializer, result mapper, auth, and DoD:**
> [`docs/impl-plan-wagner-rules-engine.md`](impl-plan-wagner-rules-engine.md)

Reference: `angebots-engine/src/lib/engine.ts` (copied, not ported)

- [ ] Scaffold Fastify project + Prisma schema (`ServiceApiKey`, `ExecutionLog` tables)
- [ ] Copy `engine.ts` + `types.ts` from `angebots-engine` into `src/engine/`
- [ ] Write `deserializer.ts` — maps English JSON keys to German `DomainConfig` TypeScript types
- [ ] Write `result-mapper.ts` — maps German `SimulatorResult` to English API response
- [ ] Service API key auth middleware (`Bearer esk_…`, bcrypt-hashed in own PostgreSQL)
- [ ] `POST /run` route — deserialize → `runEngine()` → map result → log execution
- [ ] Prisma seed for local dev service key
- [ ] Dockerfile + CI pipeline
- [ ] All Vitest tests pass before moving to Phase 2

### Phase 2 — `wagner-offer-studio-core`: REST API (2 weeks)

> **Full task breakdown, schema translation table, Doctrine entities, use cases, auth, logging, and CI:**
> [`impl-plan-wagner-offer-studio-core-p1.md`](impl-plan-wagner-offer-studio-core-p1.md) → [`impl-plan-wagner-offer-studio-core-p2.md`](impl-plan-wagner-offer-studio-core-p2.md)

Reference: `angebots-engine/src/services/**` + `angebots-engine/src/app/api/v1/**`

- [ ] Symfony skeleton + config files (Doctrine, LexikJWT, NelmioCORS, Messenger, security)
- [ ] Doctrine entities + migrations — column mapping from `angebots-engine/prisma/schema.prisma` to English names
- [ ] JWT auth + `UserProvider` + login endpoint — mirror `angebots-engine/src/lib/auth-helpers.ts`
- [ ] `ApiKeyAuthenticator` — prefix lookup + bcrypt verify — mirror `angebots-engine/src/lib/api-key-auth.ts`
- [ ] Domain, Pricelist, User, ApiKey CRUD use cases + controllers
- [ ] `HttpEngineService` + `RunEngineUseCase` — calls `wagner-rules-engine` with `Authorization: Bearer <ENGINE_SERVICE_KEY>`
- [ ] `POST /domains/{id}/run` — proxies to `wagner-rules-engine`
- [ ] External read-only API routes (API key auth)
- [ ] API logging event subscriber — mirror `angebots-engine/src/lib/api-logger.ts`
- [ ] Login rate limiting — mirror `angebots-engine/src/lib/rate-limit.ts`
- [ ] Webhook dispatch via Symfony Messenger — mirror `angebots-engine/src/services/WebhookService.ts`
- [ ] Admin controllers (logs, webhooks)
- [ ] Dockerfile + CI pipeline

### Phase 3 — `wagner-offer-studio-ui`: Vue SPA (2.5 weeks)

> **Full task breakdown, API contract, Calculate button pattern, and frontend DoD:**
> [`docs/impl-plan-wagner-offer-studio-ui.md`](impl-plan-wagner-offer-studio-ui.md)

Reference: `angebots-engine/src/app/(app)/**` + `angebots-engine/src/components/**`

- [ ] Vite + Vue 3 + Pinia + Vue Router + Axios scaffold + Tailwind CSS
- [ ] JWT-intercepted API client + auth store + Login page + route guards
- [ ] Pinia stores (domain, pricelist, configurator)
- [ ] Domain editor — 5 tabs: Fields, Rules, Validations, Components, Simulator
- [ ] Configurator — explicit **Calculate** button → `POST /domains/{id}/run`
- [ ] Pricelist editor
- [ ] Admin pages (users, API keys, logs, webhooks)
- [ ] Dashboard
- [ ] Dockerfile (nginx serving built assets) + CI pipeline

### Phase 4 — Data Migration & Launch (1 week)
- [ ] Write migration script: `angebots-engine` DB → `wagner-offer-studio-core` DB (keep CUIDs, convert German→English keys)
- [ ] Run migration against a copy of production data, verify counts and checksums
- [ ] Production Docker Compose for all four services
- [ ] Smoke test all API endpoints + UI flows against migrated data
- [ ] Decommission `angebots-engine`

**Total: ~7–8 weeks** at a comfortable pace.

---

## 12. Open Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **IDs** | Keep CUID (26-char) vs. UUID | Keep CUID — API compatibility, no migration pain |
| 2 | **Config versioning** | Add `schemaVersion` to `configJson` | Yes — allows graceful future schema migrations |
| 3 | **Microservice auth** | Shared secret vs. per-customer API keys | Per-customer `esk_…` keys — independently revocable per customer, bcrypt-hashed in own PostgreSQL |
| 4 | **Webhook delivery** | Synchronous vs. Symfony Messenger queue | Messenger queue — retryable, non-blocking |

---

> The rules engine is the soul of this system — `engine.ts` stays in TypeScript and is never ported. Copy it, wrap it, and prove the microservice correct before touching anything else.
> `angebots-engine` stays live and untouched throughout the migration; it is the safety net, the engine source of truth, and the data source.
