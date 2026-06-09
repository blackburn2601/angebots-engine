# Implementation Plan: `wagner-offer-studio-core` — Part 2: Business Logic (Tasks 5–15)

> **Part 2 of 2** — Business logic: CRUD, engine proxy, external API, logging, rate limiting, webhooks, admin, CI  
> **Requires:** [`impl-plan-wagner-offer-studio-core-p1.md`](impl-plan-wagner-offer-studio-core-p1.md) fully complete  
> Created: 2026-05-13 · Status: **Ready to implement after Phase 2a**  
> Parent plan: [`docs/migration-plan-php-symfony.md`](migration-plan-php-symfony.md) — Phase 2

---

## Prerequisites

- [ ] All P1 tasks (0–4) complete — `vendor/bin/phpunit --filter AuthControllerTest` green
- [ ] `wagner-rules-engine` running at `http://localhost:8001` (Phase 1 done)
- [ ] `ENGINE_SERVICE_KEY` set in `.env` (value from `npm run db:seed` in `wagner-rules-engine`)

---

### Task 5 — Domain CRUD

> **Depends on:** P1 complete (Tasks 0–4 green); `wagner-rules-engine` running  
> **Creates:** `src/Application/Domain/Create|Update|Duplicate|DeleteDomainUseCase.php`, `src/UI/Controller/Internal/DomainController.php`  
> **Modifies:** —  
> **Verify:** `vendor/bin/phpunit --filter DomainControllerTest`  
> **Done when:** GET/POST/PATCH/DELETE + duplicate all pass; slug deduplication appends `-2`, `-3`, etc.

**Reference:** `angebots-engine/src/services/DomainService.ts`

```php
// src/Application/Domain/CreateDomainUseCase.php
final class CreateDomainUseCase
{
    public function execute(CreateDomainCommand $cmd): DomainEntity
    {
        $slug = $this->uniqueSlug($cmd->name);
        $domain = new DomainEntity(Cuid::generate(), $cmd->name, $slug);
        $this->repo->save($domain);
        return $domain;
    }

    private function uniqueSlug(string $name): string
    {
        $base = $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $name), '-'));
        $i = 1;
        while ($this->repo->slugExists($slug)) {
            $slug = "{$base}-" . $i++;
        }
        return $slug;
    }
}
```

TS ref: `DomainService.create()` in `DomainService.ts:42` — same slug deduplication loop.

`DuplicateDomainUseCase` creates a copy with name `{source} (Copy)` and a new unique slug. TS uses `(Kopie)` — English equivalent here.

`DomainController` exposes: `GET/POST /domains`, `GET/PATCH/DELETE /domains/{id}`, `POST /domains/{id}/duplicate`, `POST /domains/{id}/run`.

Response format: `{ "data": ... }` on success, `{ "error": "...", "code": "..." }` on error.

---

### Task 6 — Pricelist CRUD

> **Depends on:** Task 5  
> **Creates:** `src/Application/Pricelist/Create|UpdatePricelistUseCase.php`, `src/UI/Controller/Internal/PricelistController.php`  
> **Modifies:** —  
> **Verify:** `vendor/bin/phpunit --filter PricelistControllerTest`  
> **Done when:** CRUD round-trips; `itemsJson` stores and returns English-keyed `PriceItem[]`.

**Reference:** `angebots-engine/src/services/PricelistService.ts`

`itemsJson` stores `PriceItem[]` as a native JSON column. `PriceItem` shape:
```json
{ "articleNumber": "ART-001", "name": "Solar Module", "unit": "Stk", "purchasePrice": 150.00 }
```

TS field mapping: `artikel_nr` → `articleNumber`, `bezeichnung` → `name`, `einheit` → `unit`, `ek_preis` → `purchasePrice`.

---

### Task 7 — User CRUD

> **Depends on:** Task 5  
> **Creates:** `src/Application/User/Create|UpdateUserUseCase.php`, `src/UI/Controller/Internal/UserController.php`  
> **Modifies:** —  
> **Verify:** `vendor/bin/phpunit --filter UserControllerTest`  
> **Done when:** Create sets `mustChangePassword = true`; only SUPER_ADMIN can access.

**Reference:** `angebots-engine/src/services/UserService.ts`

`CreateUserUseCase` hashes password (bcrypt cost 12 via Symfony's `UserPasswordHasherInterface`) and sets `mustChangePassword = true`. TS ref: `UserService.create()` in `UserService.ts:17`.

---

### Task 8 — API Key CRUD

> **Depends on:** Task 5  
> **Creates:** `src/Application/ApiKey/CreateApiKeyUseCase.php`, `src/UI/Controller/Internal/ApiKeyController.php`  
> **Modifies:** —  
> **Verify:** `vendor/bin/phpunit --filter ApiKeyControllerTest`  
> **Done when:** Raw key returned exactly once; bcrypt-hashed in DB; revocation sets `active = false`.

**Reference:** `angebots-engine/src/services/ApiKeyService.ts`

```php
// src/Application/ApiKey/CreateApiKeyUseCase.php
final class CreateApiKeyUseCase
{
    public function execute(string $label): string
    {
        $rawKey    = 'eak_live_' . bin2hex(random_bytes(24));  // 57 chars total
        $keyHash   = password_hash($rawKey, PASSWORD_BCRYPT, ['cost' => 10]);
        $keyPrefix = substr($rawKey, 0, 17);
        $this->repo->save(new ApiKeyEntity(Cuid::generate(), $label, $keyHash, $keyPrefix));
        return $rawKey;  // returned once only, never stored plaintext
    }
}
```

Revocation sets `active = false` — no hard delete.

---

### Task 9 — Engine Integration

> **Depends on:** Task 5; `ENGINE_SERVICE_KEY` set; `wagner-rules-engine` accessible  
> **Creates:** `src/Application/Engine/EngineServiceInterface.php`, `RunEngineCommand.php`, `RunEngineUseCase.php`, `src/Infrastructure/Engine/HttpEngineService.php`  
> **Modifies:** `config/services.yaml`  
> **Verify:** `vendor/bin/phpunit --filter RunEngineUseCaseTest`; `curl -X POST /api/v1/domains/{id}/run`  
> **Done when:** Engine result returned end-to-end; `preisItems` forwarded; 401 if service key missing.

**Reference:** Migration plan § 7; `angebots-engine/src/services/EngineService.ts`

Full implementations in migration plan § 6. `HttpEngineService` authenticates with the per-instance service key (`Authorization: Bearer esk_…`) and forwards `preisItems`:

```php
public function run(array $config, array $inputs, array $preisItems = []): array
{
    return $this->client
        ->request('POST', $this->engineBaseUrl . '/run', [
            'json'    => ['config' => $config, 'inputs' => $inputs, 'preisItems' => $preisItems],
            'headers' => ['Authorization' => 'Bearer ' . $this->engineServiceKey],
        ])
        ->toArray();
}
```

Register in `services.yaml`:
```yaml
WagnerOfferStudio\Infrastructure\Engine\HttpEngineService:
  arguments:
    $engineBaseUrl:    '%env(ENGINE_BASE_URL)%'
    $engineServiceKey: '%env(ENGINE_SERVICE_KEY)%'
```

---

### Task 10 — External API Controllers

> **Depends on:** Task 5, Task 6; Task 4 (API key auth)  
> **Creates:** `src/UI/Controller/External/ExternalDomainController.php`, `ExternalPricelistController.php`  
> **Modifies:** —  
> **Verify:** `vendor/bin/phpunit --filter ExternalDomainControllerTest`  
> **Done when:** `GET /api/v1/external/domains` returns list with valid `eak_live_…`; 401 without key.

Read-only, API key auth via `api_external` firewall:

```php
// src/UI/Controller/External/ExternalDomainController.php
#[Route('/external/domains')]
final class ExternalDomainController extends AbstractController
{
    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse { /* domains list */ }

    #[Route('/{id}', methods: ['GET'])]
    public function show(string $id): JsonResponse { /* domain + configJson */ }
}
```

TS ref: `angebots-engine/src/app/api/v1/domains/route.ts` and sibling external routes.

---

### Task 11 — API Logging

> **Depends on:** Task 5  
> **Creates:** `src/Infrastructure/EventSubscriber/ApiLogSubscriber.php`  
> **Modifies:** —  
> **Verify:** Make a request; check `api_logs` table for a row  
> **Done when:** Every `/api/v1/**` request produces a log row; `Authorization` value stripped; bodies truncated at 5000/8000 chars.

**Reference:** `angebots-engine/src/lib/api-logger.ts`

Event subscriber on `KernelEvents::REQUEST` (capture start time) + `KernelEvents::RESPONSE` (write log). Fire-and-forget — never let logging throw.

Key behaviours matching the TS source:
- Truncate `requestHeaders` to 5 000 chars, `requestBody`/`responseBody` to 8 000 chars
- Strip `Authorization` value (keep first 4 chars + `***`)
- Never log `Cookie` headers
- IP from `X-Forwarded-For` → `X-Real-IP` → `'unknown'`

---

### Task 12 — Login Rate Limiting

> **Depends on:** Task 3 (AuthController)  
> **Creates:** `src/Infrastructure/Security/LoginRateLimiter.php`, `src/Command/PurgeLoginAttemptsCommand.php`  
> **Modifies:** `src/UI/Controller/Auth/AuthController.php`  
> **Verify:** `vendor/bin/phpunit --filter AuthControllerTest` (6th failed attempt returns 429)  
> **Done when:** 6th failed login from same IP in 15 min returns 429; `app:purge-login-attempts` runs without error.

**Reference:** `angebots-engine/src/lib/rate-limit.ts`

5 failed attempts per IP per 15 minutes, stored in `LoginAttempt` table. Direct Doctrine implementation mirrors the TS source exactly:

```php
// src/Infrastructure/Security/LoginRateLimiter.php
final class LoginRateLimiter
{
    private const MAX_ATTEMPTS = 5;
    private const WINDOW_SECONDS = 900;

    public function isAllowed(string $ip): bool
    {
        $since    = new \DateTimeImmutable('-' . self::WINDOW_SECONDS . ' seconds');
        $attempts = $this->repo->countFailedSince($ip, $since);
        return $attempts < self::MAX_ATTEMPTS;
    }

    public function recordFailure(string $ip, string $email): void
    {
        $this->em->persist(new LoginAttemptEntity(Cuid::generate(), $ip, $email, false));
        $this->em->flush();
        // Cleanup is NOT called here — running a DELETE on every failed login is
        // a DoS amplifier. Instead, a scheduled console command purges old rows nightly.
    }
}
```

Create `src/Command/PurgeLoginAttemptsCommand.php` as a Symfony console command:
```php
#[AsCommand(name: 'app:purge-login-attempts', description: 'Delete login attempt rows older than 24 hours')]
final class PurgeLoginAttemptsCommand extends Command
{
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $deleted = $this->loginAttemptRepo->deleteOlderThan(new \DateTimeImmutable('-24 hours'));
        $output->writeln("Purged {$deleted} login attempt rows.");
        return Command::SUCCESS;
    }
}
```

Schedule nightly in `config/packages/scheduler.yaml` (Symfony 6.3+) or via a cron job: `0 3 * * * php bin/console app:purge-login-attempts`.

---

### Task 13 — Webhook Dispatch

> **Depends on:** Task 5  
> **Creates:** `src/Application/Webhook/DispatchWebhookMessage.php`, `SendWebhookMessage.php`, `DispatchWebhookHandler.php`, `SendWebhookHandler.php`  
> **Modifies:** `config/packages/messenger.yaml`  
> **Verify:** Dispatch a domain event; verify Messenger queue delivers it  
> **Done when:** Per-URL delivery retried independently on failure (max 3); other URLs unaffected.

**Reference:** `angebots-engine/src/services/WebhookService.ts`

Symfony Messenger for async, retryable delivery (migration plan open decision § 4).

**Two-message design** — `DispatchWebhookMessage` fans out one `SendWebhookMessage` per URL so each delivery is retried independently. Never wrap `SendWebhookHandler` in a try/catch — let exceptions propagate so Messenger's retry strategy applies.

```php
// src/Application/Webhook/DispatchWebhookMessage.php  — fan-out message
final class DispatchWebhookMessage
{
    public function __construct(
        public readonly string $event,
        public readonly array  $payload,
    ) {}
}

// src/Application/Webhook/SendWebhookMessage.php  — per-URL delivery message
final class SendWebhookMessage
{
    public function __construct(
        public readonly string $url,
        public readonly string $event,
        public readonly array  $payload,
    ) {}
}

// src/Application/Webhook/DispatchWebhookHandler.php  — fans out, no HTTP calls
final class DispatchWebhookHandler implements MessageHandlerInterface
{
    public function __invoke(DispatchWebhookMessage $message): void
    {
        foreach ($this->webhookRepo->findAllActive() as $webhook) {
            $this->bus->dispatch(new SendWebhookMessage(
                $webhook->getUrl(), $message->event, $message->payload,
            ));
        }
    }
}

// src/Application/Webhook/SendWebhookHandler.php  — one URL, no catch, retryable
final class SendWebhookHandler implements MessageHandlerInterface
{
    public function __invoke(SendWebhookMessage $message): void
    {
        // No try/catch — exceptions propagate so Messenger retries this delivery
        $this->client->request('POST', $message->url, [
            'json'    => ['event' => $message->event, 'data' => $message->payload],
            'timeout' => 5,
        ]);
    }
}
```

Route both message types in `messenger.yaml`:
```yaml
routing:
  WagnerOfferStudio\Application\Webhook\DispatchWebhookMessage: async
  WagnerOfferStudio\Application\Webhook\SendWebhookMessage: async
```

---

### Task 14 — Admin Controllers

> **Depends on:** Task 11, Task 13  
> **Creates:** `src/UI/Controller/Internal/Admin/LogController.php`, `WebhookController.php`  
> **Modifies:** —  
> **Verify:** `vendor/bin/phpunit --filter AdminControllerTest`  
> **Done when:** Paginated log listing works; webhook CRUD complete; only SUPER_ADMIN can access.

```
src/UI/Controller/Internal/Admin/
├── LogController.php      ← GET (paginated + filters), DELETE /admin/logs
└── WebhookController.php  ← GET, POST, PATCH, DELETE /admin/webhooks
```

TS ref: `angebots-engine/src/app/api/v1/admin/`.

---

### Task 15 — Dockerfile + CI

> **Depends on:** All prior tasks complete  
> **Creates:** `Dockerfile`, `.github/workflows/ci.yml`  
> **Modifies:** —  
> **Verify:** `docker build .`; push to branch → GitHub Actions green  
> **Done when:** Image builds; CI passes including `lexik:jwt:generate-keypair --skip-if-exists`.

**Dockerfile**
```dockerfile
FROM php:8.3-fpm-alpine AS base
RUN apk add --no-cache postgresql-client \
    && docker-php-ext-install pdo pdo_pgsql opcache

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app

FROM base AS deps
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

FROM base AS runtime
COPY --from=deps /app/vendor ./vendor
COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && php bin/console cache:warmup --env=prod

EXPOSE 8000
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public"]
```

**`.github/workflows/ci.yml`**
```yaml
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
          POSTGRES_DB: offer_studio_test
          POSTGRES_USER: offer
          POSTGRES_PASSWORD: secret
        ports: ['5432:5432']
    env:
      DATABASE_URL: postgresql://offer:secret@localhost:5432/offer_studio_test
      APP_ENV: test
      JWT_PASSPHRASE: ci-test-passphrase
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: pdo_pgsql, mbstring, json
      - run: composer install --prefer-dist --no-progress
      - run: php bin/console lexik:jwt:generate-keypair --skip-if-exists
      - run: php bin/console doctrine:migrations:migrate --no-interaction
      - run: vendor/bin/phpunit
```

---

## 6. DomainConfigSerializer

`wagner-offer-studio-core` does **not** need to fully deserialize the config into PHP domain models — it stores and forwards `configJson` as a plain array. The serializer only validates structure before saving:

```php
// src/Infrastructure/Persistence/Serializer/DomainConfigSerializer.php
final class DomainConfigSerializer
{
    public function validate(array $config): array  // returns violation strings
    {
        $violations = [];
        foreach (['fields', 'ruleGroups', 'freeTextRules', 'validations', 'components'] as $key) {
            if (!isset($config[$key]) || !is_array($config[$key])) {
                $violations[] = "config.{$key} must be an array";
            }
        }
        return $violations;
    }
}
```

---

## 7. Data Migration from `angebots-engine` (Phase 4)

Executed after `wagner-offer-studio-core` and `wagner-offer-studio-ui` are both fully functional.

### Key challenges

1. German → English key conversion in `config_json` (Domain) and `items_json` (Pricelist)
2. Column renames across every table
3. Type change: `config_json` was a `String` — becomes native `json` column
4. Dropped tables: Account, Session, VerificationToken
5. Password + API key bcrypt hashes are compatible — no rehashing needed
6. CUIDs kept as-is

### `config_json` key conversion map

```php
$keyMap = [
    // top-level config keys
    'felder'         => 'fields',
    'regelwerk'      => null,          // split: RegelGruppe → ruleGroups, FreitextRegel → freeTextRules
    'validierungen'  => 'validations',
    'komponenten'    => 'components',
    'parameter'      => null,          // dropped
    // field-level
    'typ'            => 'type',
    'formel'         => 'formula',
    'standard'       => 'default',
    'optionen'       => 'options',
    // rule group
    'ziel_feld'      => 'targetField',
    'auswertung'     => null,          // dropped
    'regeln'         => 'rules',
    'bedingungen'    => 'conditions',
    'dann'           => 'value',
    'verknuepfung'   => 'logic',
    // condition
    'feld'           => 'field',
    'op'             => 'operator',
    'wert'           => 'value',
    'vergleich_feld' => 'compareField',
    // freitext (split from regelwerk into freeTextRules)
    'aktiv_wenn'     => 'activeWhen',
    // validation
    'meldung'        => 'message',
    'bedingung'      => 'condition',
    // component
    'menge_feld'     => 'quantityField',
    'aktivierung'    => 'activationRules',
    'varianten'      => 'variants',
    'abhaengigkeiten'=> 'dependencies',
    'konflikte'      => null,          // dropped
    // variant
    'wenn_feld'      => 'whenField',
    'artikel_nr'     => 'articleNumber',
    // operator values
    'enthält'        => 'contains',
    'fehler'         => 'error',
    'warnung'        => 'warning',
];
```

`regelwerk` entries with `typ === 'freitext'` → `freeTextRules[]`; all others → `ruleGroups[]`.

---

## 8. Definition of Done

Phase 2 is complete when **all** of the following are true:

- [ ] `composer test` runs clean — zero failures, zero errors
- [ ] `POST /api/v1/auth/login` returns short-lived access token in body + sets httpOnly `refresh_token` cookie (30 days)
- [ ] `POST /api/v1/auth/refresh` validates cookie, rotates refresh token, returns new access token
- [ ] `POST /api/v1/auth/logout` revokes refresh token in DB and clears cookie
- [ ] `GET /api/v1/auth/me` returns current user from access token claims
- [ ] `configJson` round-trip integration test: create domain → fetch domain → POST /run returns correct engine result
- [ ] All CRUD endpoints for domains, pricelists, users, API keys return correct shapes
- [ ] `POST /api/v1/domains/{id}/run` proxies to `wagner-rules-engine` and returns the engine result
- [ ] API key auth works for external routes
- [ ] Rate limiting blocks after 5 failed login attempts per 15-minute window per IP
- [ ] API logs are written for every request to `/api/v1/**`
- [ ] Webhook messages are dispatched asynchronously via Symfony Messenger
- [ ] CI pipeline passes on `main`
- [ ] `wagner-rules-engine` Vitest tests still pass unchanged (`npm test` in `wagner-rules-engine/`)
- [ ] `angebots-engine` TS tests still pass unchanged (`npm test` in `angebots-engine/`)
