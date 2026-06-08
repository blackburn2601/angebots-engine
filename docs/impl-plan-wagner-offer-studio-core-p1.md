# Implementation Plan: `wagner-offer-studio-core` — Part 1: Foundation (Tasks 0–4)

> **Part 1 of 2** — Foundation: scaffold, domain layer, Doctrine entities, JWT auth, API key auth  
> **Continues in:** [`impl-plan-wagner-offer-studio-core-p2.md`](impl-plan-wagner-offer-studio-core-p2.md)  
> Created: 2026-05-13 · Status: **Ready to implement after Phase 1**  
> Parent plan: [`docs/migration-plan-php-symfony.md`](migration-plan-php-symfony.md) — Phase 2

---

## CLAUDE.md for this repo

When scaffolding `wagner-offer-studio-core/`, write this file first:

```markdown
# wagner-offer-studio-core

Symfony 7 REST API — auth, CRUD, engine proxy, webhooks. No frontend.

## Invariants — never violate
- Never call `wagner-rules-engine` directly except inside `HttpEngineService`.
- `configJson` and `itemsJson` are native Doctrine `json` columns (English keys, not strings).
- `Cuid::generate()` returns a 26-char ULID. Never use `uniqid()`, `Str::uuid()`, or random hex.
- Passwords: bcrypt cost 12 via Symfony's `UserPasswordHasherInterface`. Never `md5` or `sha1`.
- All DB access through Doctrine EntityManager or repository interfaces. No raw SQL.
- Read `impl-plan-wagner-offer-studio-core-p1.md` then `p2.md` top to bottom before writing code.
- Do not start the next task until the current task's **Verify** command passes.
```

---

## 1. Purpose & Scope

`wagner-offer-studio-core` is the Symfony 7 REST API: auth, CRUD for domains/pricelists/users/API keys, engine proxy, API logging, rate limiting, and webhook dispatch. It has no frontend — the Vue SPA lives in `wagner-offer-studio-ui` and talks to this service over HTTP.

**Phase 1 (`wagner-rules-engine`) must be complete and the Vitest tests passing before starting here.** The rules engine microservice is TypeScript/Node.js — no PHP port is needed.

The `POST /domains/{id}/run` endpoint proxies to `wagner-rules-engine` using a per-instance service API key (`ENGINE_SERVICE_KEY` env var, `Authorization: Bearer esk_…`). This key is created by running `npm run db:seed` in the `wagner-rules-engine` repo.

**Namespace:** `WagnerOfferStudio\`

---

## 2. Prerequisites

- [ ] Phase 1 complete — `wagner-rules-engine` running, all Vitest tests pass
- [ ] `wagner-rules-engine` accessible at `http://localhost:8001` via workspace `docker-compose.yml`
- [ ] Service API key created (`npm run db:seed` in `wagner-rules-engine`) and copied to `ENGINE_SERVICE_KEY` in this repo's `.env`
- [ ] PostgreSQL running at port 5432 (workspace docker-compose)
- [ ] PHP 8.3 + Composer 2 installed

---

## 3. Schema Translation: Prisma → Doctrine

The existing database uses German column names. The new schema uses English. DB columns follow `snake_case`; PHP properties use `camelCase`.

### Column name mapping

| Prisma field | PHP property | DB column | Notes |
|---|---|---|---|
| `User.rolle` | `role` | `role` | Stored as `UserRole` enum |
| `User.aktiv` | `active` | `active` | |
| `User.muss_pw_aendern` | `mustChangePassword` | `must_change_password` | |
| `User.erstellt_am` | `createdAt` | `created_at` | |
| `User.letzter_login` | `lastLogin` | `last_login` | |
| `ApiKey.key_hash` | `keyHash` | `key_hash` | |
| `ApiKey.key_prefix` | `keyPrefix` | `key_prefix` | |
| `ApiKey.erstellt_am` | `createdAt` | `created_at` | |
| `ApiKey.letzter_zugriff` | `lastAccessAt` | `last_access_at` | |
| `ApiKey.aktiv` | `active` | `active` | |
| `ApiKeyLog.endpunkt` | `endpoint` | `endpoint` | |
| `ApiKeyLog.zeitstempel` | `createdAt` | `created_at` | |
| `Domain.config_json` | `configJson` | `config_json` | Doctrine `json` type (array, not string) |
| `Domain.erstellt_am` | `createdAt` | `created_at` | |
| `Domain.updated_at` | `updatedAt` | `updated_at` | |
| `Pricelist.gueltig_ab` | `validFrom` | `valid_from` | |
| `Pricelist.gueltig_bis` | `validUntil` | `valid_until` | |
| `Pricelist.aktiv` | `active` | `active` | |
| `Pricelist.items_json` | `itemsJson` | `items_json` | Doctrine `json` type (array, not string) |
| `Pricelist.erstellt_am` | `createdAt` | `created_at` | |
| `Pricelist.updated_at` | `updatedAt` | `updated_at` | |
| `LoginAttempt.zeitstempel` | `createdAt` | `created_at` | |
| `ApiLog.status_code` | `statusCode` | `status_code` | |
| `ApiLog.duration_ms` | `durationMs` | `duration_ms` | |
| `ApiLog.request_headers` | `requestHeaders` | `request_headers` | |
| `ApiLog.request_body` | `requestBody` | `request_body` | |
| `ApiLog.response_body` | `responseBody` | `response_body` | |
| `ApiLog.user_id` | `userId` | `user_id` | |
| `ApiLog.api_key_id` | `apiKeyId` | `api_key_id` | |
| `ApiLog.zeitstempel` | `createdAt` | `created_at` | |
| `WebhookUrl.aktiv` | `active` | `active` | |
| `WebhookUrl.erstellt_am` | `createdAt` | `created_at` | |
| `WebhookUrl.updated_at` | `updatedAt` | `updated_at` | |
| `AppSetting.updated_at` | `updatedAt` | `updated_at` | |
| `AppSetting.updated_by` | `updatedBy` | `updated_by` | |

### Dropped tables

`Account`, `Session`, `VerificationToken` — NextAuth adapter tables. Not ported; replaced by LexikJWTAuthBundle's stateless JWT flow.

### `configJson` format change

In `angebots-engine`, `Domain.config_json` is a JSON **string** with German keys. In `wagner-offer-studio-core`, `configJson` is a Doctrine `json` column (native PostgreSQL JSON array) with **English keys** matching the `wagner-rules-engine` API contract. The data migration in Phase 4 converts keys; see [§ 8 Data Migration](#8-data-migration-from-angebots-engine-phase-4).

---

## 4. Project Scaffolding

### 4.1 Init

```bash
cd angebots-engine-migration

composer create-project symfony/skeleton wagner-offer-studio-core
cd wagner-offer-studio-core

composer require symfony/framework-bundle symfony/http-foundation
composer require doctrine/orm doctrine/doctrine-bundle doctrine/doctrine-migrations-bundle
composer require lexik/jwt-authentication-bundle
composer require nelmio/cors-bundle
composer require symfony/rate-limiter symfony/messenger
composer require symfony/http-client
composer require symfony/security-bundle

composer require --dev phpunit/phpunit symfony/test-pack doctrine/doctrine-fixtures-bundle
```

### 4.2 `composer.json` (final state)

```json
{
  "name": "wagner/offer-studio-core",
  "description": "Symfony REST API for the offer studio",
  "type": "project",
  "license": "proprietary",
  "require": {
    "php": ">=8.3",
    "ext-json": "*",
    "doctrine/doctrine-bundle": "^2.12",
    "doctrine/doctrine-migrations-bundle": "^3.3",
    "doctrine/orm": "^3.2",
    "lexik/jwt-authentication-bundle": "^3.1",
    "nelmio/cors-bundle": "^2.5",
    "symfony/framework-bundle": "^7.2",
    "symfony/http-client": "^7.2",
    "symfony/http-foundation": "^7.2",
    "symfony/messenger": "^7.2",
    "symfony/rate-limiter": "^7.2",
    "symfony/security-bundle": "^7.2",
    "symfony/serializer": "^7.2",
    "symfony/validator": "^7.2"
  },
  "require-dev": {
    "doctrine/doctrine-fixtures-bundle": "^3.6",
    "phpunit/phpunit": "^11.0",
    "symfony/test-pack": "^1.1"
  },
  "autoload": {
    "psr-4": { "WagnerOfferStudio\\": "src/" }
  },
  "autoload-dev": {
    "psr-4": { "WagnerOfferStudio\\Tests\\": "tests/" }
  }
}
```

### 4.3 Config files

**`config/packages/doctrine.yaml`**
```yaml
doctrine:
  dbal:
    url: '%env(resolve:DATABASE_URL)%'
  orm:
    auto_generate_proxy_classes: true
    enable_lazy_ghost_objects: true
    naming_strategy: doctrine.orm.naming_strategy.underscore_number_aware
    auto_mapping: true
    mappings:
      WagnerOfferStudio:
        is_bundle: false
        dir: '%kernel.project_dir%/src/Infrastructure/Persistence/Doctrine/Entity'
        prefix: 'WagnerOfferStudio\Infrastructure\Persistence\Doctrine\Entity'
        alias: App
```

**`config/packages/lexik_jwt_authentication.yaml`**
```yaml
lexik_jwt_authentication:
  secret_key: '%env(resolve:JWT_SECRET_KEY)%'
  public_key: '%env(resolve:JWT_PUBLIC_KEY)%'
  pass_phrase: '%env(JWT_PASSPHRASE)%'
  token_ttl: 900    # 15 minutes — access token only; sessions are maintained via httpOnly refresh token cookie
```

**`config/packages/nelmio_cors.yaml`**
```yaml
nelmio_cors:
  defaults:
    allow_origin: ['%env(CORS_ALLOW_ORIGIN)%']
    allow_methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
    allow_headers: ['Content-Type', 'Authorization']
    allow_credentials: true
    max_age: 3600
  paths:
    '^/api/': ~
```

**`config/packages/security.yaml`**
```yaml
security:
  password_hashers:
    WagnerOfferStudio\Infrastructure\Persistence\Doctrine\Entity\UserEntity:
      algorithm: bcrypt
      cost: 12

  providers:
    jwt_user_provider:
      entity:
        class: WagnerOfferStudio\Infrastructure\Persistence\Doctrine\Entity\UserEntity
        property: email

  firewalls:
    dev:
      pattern: ^/(_(profiler|wdt)|css|images|js)/
      security: false

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
    - { path: ^/api/v1/auth,        roles: PUBLIC_ACCESS }
    - { path: ^/api/v1/external,    roles: ROLE_API_KEY }   # ApiKeyAuthenticator grants this role
    - { path: ^/api/v1/admin,       roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1/users,       roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1/api-keys,    roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1,             roles: ROLE_SELLER }
```

**`config/packages/messenger.yaml`**
```yaml
framework:
  messenger:
    transports:
      async:
        dsn: '%env(MESSENGER_TRANSPORT_DSN)%'
        retry_strategy:
          max_retries: 3
          delay: 1000
          multiplier: 2
    routing:
      WagnerOfferStudio\Application\Webhook\DispatchWebhookMessage: async
```

**`config/routes/api.yaml`**
```yaml
api_controllers:
  resource:
    path: ../../src/UI/Controller/
    namespace: WagnerOfferStudio\UI\Controller
  type: attribute
  prefix: /api/v1
```

**`.env`**
```dotenv
APP_ENV=dev
APP_SECRET=change-this-in-production
DATABASE_URL=postgresql://offer:secret@localhost:5432/offer_studio
JWT_SECRET_KEY=%kernel.project_dir%/config/jwt/private.pem
JWT_PUBLIC_KEY=%kernel.project_dir%/config/jwt/public.pem
JWT_PASSPHRASE=change-this
CORS_ALLOW_ORIGIN=http://localhost:5173
ENGINE_BASE_URL=http://localhost:8001
ENGINE_SERVICE_KEY=            # esk_… key from: npm run db:seed in wagner-rules-engine
MESSENGER_TRANSPORT_DSN=doctrine://default
COOKIE_DOMAIN=                 # e.g. .example.com for cross-subdomain cookies; leave empty for same-domain
```

Generate JWT keys:
```bash
mkdir -p config/jwt
openssl genrsa -out config/jwt/private.pem -aes256 4096
openssl rsa -pubout -in config/jwt/private.pem -out config/jwt/public.pem
```

---

## 5. Backend Implementation Tasks

Tasks are strictly ordered. Complete all tasks in a group before moving to the next.

---

### Task 0 — Test Scaffolding

> **Depends on:** Prerequisites in [§ 2](#2-prerequisites) met  
> **Creates:** `tests/Unit/Application/Domain/`, `tests/Integration/UI/Controller/`, `tests/Fixtures/UserFixtures.php`  
> **Modifies:** —  
> **Verify:** `vendor/bin/phpunit`  
> **Done when:** PHPUnit runs without error (zero tests is fine); no autoload errors.

```
tests/
├── Unit/
│   ├── Application/
│   │   ├── Domain/CreateDomainUseCaseTest.php
│   │   ├── Domain/DuplicateDomainUseCaseTest.php
│   │   └── Engine/RunEngineUseCaseTest.php
│   └── Infrastructure/
│       └── Security/ApiKeyAuthenticatorTest.php
├── Integration/
│   └── UI/Controller/
│       ├── AuthControllerTest.php
│       ├── DomainControllerTest.php
│       ├── PricelistControllerTest.php
│       ├── UserControllerTest.php
│       ├── ApiKeyControllerTest.php
│       └── External/ExternalDomainControllerTest.php
└── Fixtures/
    └── UserFixtures.php
```

---

### Task 1 — Domain Layer (Value Objects)

> **Depends on:** Task 0  
> **Creates:** `src/Domain/User/UserRole.php`, `src/Domain/Shared/ValueObject/Cuid.php`, five repository interfaces  
> **Modifies:** `composer.json` (add `symfony/uid`)  
> **Verify:** `vendor/bin/phpunit --filter DomainTest`  
> **Done when:** `Cuid::generate()` returns a 26-char ULID; `UserRole::SuperAdmin->toSymfonyRole()` returns `'ROLE_SUPER_ADMIN'`.

**Reference:** `angebots-engine/prisma/schema.prisma` + `angebots-engine/src/lib/auth-helpers.ts`

#### `UserRole` enum

```php
// src/Domain/User/UserRole.php
enum UserRole: string
{
    case SuperAdmin  = 'SUPER_ADMIN';
    case DomainAdmin = 'DOMAIN_ADMIN';
    case Seller      = 'SELLER';

    public function canManageUsers(): bool     { return $this === self::SuperAdmin; }
    public function canManageApiKeys(): bool   { return $this === self::SuperAdmin; }
    public function canManageDomains(): bool   { return $this !== self::Seller; }
    public function canManagePricelists(): bool{ return $this !== self::Seller; }

    public function toSymfonyRole(): string
    {
        return match($this) {
            self::SuperAdmin  => 'ROLE_SUPER_ADMIN',
            self::DomainAdmin => 'ROLE_DOMAIN_ADMIN',
            self::Seller      => 'ROLE_SELLER',
        };
    }
}
```

#### `Cuid` value object (implemented as ULID)

The original `angebots-engine` used CUID v1 (26-char, sortable). PHP has no canonical CUID library — instead use **Symfony ULID** from `symfony/uid` (already a Symfony component, no extra package). ULIDs are:
- 26 chars, base32 encoded — fits the `length: 26` Doctrine column
- Monotonically sortable by creation time (same benefit as CUID)
- Cryptographically random suffix

The class is named `Cuid` so existing call sites don't change.

```php
// src/Domain/Shared/ValueObject/Cuid.php
use Symfony\Component\Uid\Ulid;

final class Cuid
{
    private function __construct(public readonly string $value) {}

    public static function generate(): self
    {
        return new self((string) new Ulid());  // 26-char base32 ULID, e.g. "01HV…"
    }

    public static function from(string $value): self { return new self($value); }
    public function __toString(): string { return $this->value; }
}
```

Require `symfony/uid` if not already present: `composer require symfony/uid`.

#### Repository interfaces

One interface per aggregate: `DomainRepository`, `PricelistRepository`, `UserRepository`, `ApiKeyRepository`, `WebhookUrlRepository` — each with `findAll`, `findById`, `save`, `delete` methods.

---

### Task 2 — Doctrine Entities

> **Depends on:** Task 1  
> **Creates:** 10 entity files in `src/Infrastructure/Persistence/Doctrine/Entity/`, `src/Command/PurgeRefreshTokensCommand.php`  
> **Modifies:** —  
> **Verify:** `php bin/console doctrine:migrations:diff && php bin/console doctrine:migrations:migrate`  
> **Done when:** All tables created in DB; `RefreshTokenEntity::isValid()` returns `false` for revoked/expired tokens.

**Reference:** `angebots-engine/prisma/schema.prisma`

All entities use string IDs (CUID values). See migration plan § 7 for partial stubs.

#### `UserEntity.php`

```php
#[ORM\Entity]
#[ORM\Table(name: 'users')]
class UserEntity implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\Column(type: 'string', length: 26)]
    private string $id;

    #[ORM\Column(type: 'string')]
    private string $name;

    #[ORM\Column(type: 'string', unique: true)]
    private string $email;

    #[ORM\Column(type: 'string')]
    private string $password;

    #[ORM\Column(type: 'string', enumType: UserRole::class)]
    private UserRole $role;

    #[ORM\Column(type: 'boolean', options: ['default' => true])]
    private bool $active = true;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $mustChangePassword = false;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastLogin = null;

    public function getUserIdentifier(): string { return $this->email; }
    public function getRoles(): array { return [$this->role->toSymfonyRole(), 'ROLE_USER']; }
    public function eraseCredentials(): void {}
    public function getPassword(): string { return $this->password; }
}
```

#### `DomainEntity.php`

```php
#[ORM\Entity]
#[ORM\Table(name: 'domains')]
#[ORM\HasLifecycleCallbacks]
class DomainEntity
{
    #[ORM\Column(type: 'json')]
    private array $configJson = [
        'fields' => [], 'ruleGroups' => [], 'freeTextRules' => [],
        'validations' => [], 'components' => [],
    ];

    #[ORM\ManyToMany(targetEntity: PricelistEntity::class)]
    #[ORM\JoinTable(name: 'domain_pricelists')]
    private Collection $pricelists;

    #[ORM\PreUpdate]
    public function onPreUpdate(): void { $this->updatedAt = new \DateTimeImmutable(); }
}
```

#### `PricelistEntity.php`

```php
#[ORM\Column(type: 'datetime_immutable', nullable: true)]
private ?\DateTimeImmutable $validFrom = null;

#[ORM\Column(type: 'datetime_immutable', nullable: true)]
private ?\DateTimeImmutable $validUntil = null;

#[ORM\Column(type: 'boolean', options: ['default' => true])]
private bool $active = true;

#[ORM\Column(type: 'json')]
private array $itemsJson = [];
```

TS ref: `Pricelist` in `schema.prisma:89`.

#### `ApiKeyEntity.php`

```php
#[ORM\Column(type: 'string', unique: true)]
private string $keyHash;

#[ORM\Column(type: 'string', length: 17)]
private string $keyPrefix;

#[ORM\Column(type: 'boolean', options: ['default' => true])]
private bool $active = true;

#[ORM\Column(type: 'datetime_immutable', nullable: true)]
private ?\DateTimeImmutable $lastAccessAt = null;
```

Key format: `eak_live_` + 48 hex chars. TS ref: `ApiKey` in `schema.prisma:59`.

#### `RefreshTokenEntity.php`

```php
#[ORM\Entity]
#[ORM\Table(name: 'refresh_tokens')]
#[ORM\Index(columns: ['token_hash'], name: 'idx_rt_hash')]
class RefreshTokenEntity
{
    #[ORM\Id]
    #[ORM\Column(type: 'string', length: 26)]
    private string $id;

    #[ORM\Column(type: 'string', unique: true)]
    private string $tokenHash;

    #[ORM\ManyToOne(targetEntity: UserEntity::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private UserEntity $user;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $revokedAt = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $id, string $tokenHash, UserEntity $user, \DateTimeImmutable $expiresAt)
    {
        $this->id        = $id;
        $this->tokenHash = $tokenHash;
        $this->user      = $user;
        $this->expiresAt = $expiresAt;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function isValid(): bool
    {
        return $this->revokedAt === null && $this->expiresAt > new \DateTimeImmutable();
    }

    public function revoke(): void     { $this->revokedAt = new \DateTimeImmutable(); }
    public function getTokenHash(): string { return $this->tokenHash; }
    public function getUser(): UserEntity  { return $this->user; }
}
```

No external Composer package needed — uses the existing PostgreSQL database.

Create `src/Command/PurgeRefreshTokensCommand.php`:
```php
#[AsCommand(name: 'app:purge-refresh-tokens', description: 'Delete expired and revoked refresh token rows')]
final class PurgeRefreshTokensCommand extends Command
{
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $deleted = $this->refreshTokenRepo->deleteExpiredBefore(new \DateTimeImmutable());
        $output->writeln("Purged {$deleted} refresh token rows.");
        return Command::SUCCESS;
    }
}
```

Schedule nightly: `0 3 * * * php bin/console app:purge-refresh-tokens`

#### Remaining entities

`ApiLogEntity`, `ApiKeyLogEntity`, `LoginAttemptEntity`, `WebhookUrlEntity`, `AppSettingEntity` — follow the column mapping table in [§ 3](#3-schema-translation-prisma--doctrine).

#### Generate migration

```bash
php bin/console doctrine:migrations:diff
php bin/console doctrine:migrations:migrate
```

---

### Task 3 — JWT Authentication

> **Depends on:** Task 2  
> **Creates:** `src/UI/Controller/Auth/AuthController.php`, `src/Infrastructure/Security/JwtCreatedSubscriber.php`  
> **Modifies:** `config/packages/lexik_jwt_authentication.yaml`, `config/packages/security.yaml`  
> **Verify:** `vendor/bin/phpunit --filter AuthControllerTest`  
> **Done when:** `POST /api/v1/auth/login` returns `accessToken` + sets httpOnly `refresh_token` cookie; `/refresh` rotates token; `/logout` revokes token in DB and clears cookie.

**Reference:** `angebots-engine/src/lib/auth.ts` + `angebots-engine/src/lib/auth-helpers.ts`

#### `AuthController.php`

```php
#[Route('/auth')]
final class AuthController extends AbstractController
{
    private const REFRESH_TTL = 2592000; // 30 days in seconds

    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $ip = $request->getClientIp() ?? 'unknown';

        if (!$this->rateLimiter->isAllowed($ip)) {
            return $this->json(['error' => 'Too many failed attempts. Try again later.'], 429);
        }

        $data = $request->toArray();
        $user = $this->em->getRepository(UserEntity::class)->findOneBy(['email' => $data['email'] ?? '']);

        if (!$user || !$this->hasher->isPasswordValid($user, $data['password'] ?? '')) {
            $this->rateLimiter->recordFailure($ip, $data['email'] ?? '');
            return $this->json(['error' => 'Invalid credentials'], 401);
        }

        if (!$user->isActive()) {
            return $this->json(['error' => 'Account disabled'], 403);
        }

        $this->rateLimiter->recordSuccess($ip, $user->getEmail());
        $user->setLastLogin(new \DateTimeImmutable());
        $this->em->flush();

        $response = $this->json(['data' => [
            'accessToken' => $this->jwtManager->create($user),
            'user'        => $this->serializeUser($user),
        ]]);
        $response->headers->setCookie($this->issueRefreshToken($user));
        return $response;
    }

    #[Route('/refresh', methods: ['POST'])]
    public function refresh(Request $request): JsonResponse
    {
        if (!$this->rateLimiter->isAllowed($request->getClientIp() ?? 'unknown')) {
            return $this->json(['error' => 'Too many requests'], 429);
        }

        $rawToken = $request->cookies->get('refresh_token', '');
        if ($rawToken === '') {
            return $this->json(['error' => 'No refresh token'], 401);
        }

        $entity = $this->em->getRepository(RefreshTokenEntity::class)
            ->findOneBy(['tokenHash' => hash('sha256', $rawToken)]);

        if ($entity === null || !$entity->isValid()) {
            return $this->json(['error' => 'Invalid or expired refresh token'], 401);
        }

        $entity->revoke(); // rotate — old token immediately invalidated
        $user     = $entity->getUser();
        $response = $this->json(['data' => [
            'accessToken' => $this->jwtManager->create($user),
            'user'        => $this->serializeUser($user),
        ]]);
        $response->headers->setCookie($this->issueRefreshToken($user));
        $this->em->flush();
        return $response;
    }

    #[Route('/logout', methods: ['POST'])]
    public function logout(Request $request): JsonResponse
    {
        $rawToken = $request->cookies->get('refresh_token', '');
        if ($rawToken !== '') {
            $entity = $this->em->getRepository(RefreshTokenEntity::class)
                ->findOneBy(['tokenHash' => hash('sha256', $rawToken)]);
            $entity?->revoke();
            $this->em->flush();
        }

        $response = $this->json(['data' => null]);
        $response->headers->clearCookie('refresh_token', '/', null, true, true);
        return $response;
    }

    #[Route('/me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        /** @var UserEntity $user */
        $user = $this->getUser();
        return $this->json(['data' => $this->serializeUser($user)]);
    }

    private function issueRefreshToken(UserEntity $user): Cookie
    {
        $rawToken  = bin2hex(random_bytes(32));
        $expiresAt = new \DateTimeImmutable('+' . self::REFRESH_TTL . ' seconds');
        $this->em->persist(new RefreshTokenEntity(
            (string) Cuid::generate(), hash('sha256', $rawToken), $user, $expiresAt
        ));
        return Cookie::create('refresh_token')
            ->withValue($rawToken)
            ->withExpires($expiresAt->getTimestamp())
            ->withHttpOnly(true)
            ->withSecure(true)
            ->withSameSite('Strict')
            ->withDomain($_ENV['COOKIE_DOMAIN'] ?? null);  // set COOKIE_DOMAIN in .env for cross-subdomain
    }

    private function serializeUser(UserEntity $user): array
    {
        return [
            'id'                 => $user->getId(),
            'name'               => $user->getName(),
            'email'              => $user->getEmail(),
            'role'               => $user->getRole()->value,
            'mustChangePassword' => $user->mustChangePassword(),
        ];
    }
}
```

#### JWT payload — custom claims

```php
// src/Infrastructure/Security/JwtCreatedSubscriber.php
final class JwtCreatedSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [Events::JWT_CREATED => 'onJwtCreated'];
    }

    public function onJwtCreated(JWTCreatedEvent $event): void
    {
        $user = $event->getUser();
        $event->setData(array_merge($event->getData(), [
            'id'                 => $user->getId(),
            'name'               => $user->getName(),
            'role'               => $user->getRole()->value,
            'mustChangePassword' => $user->mustChangePassword(),
        ]));
    }
}
```

---

### Task 4 — API Key Authenticator

> **Depends on:** Task 2  
> **Creates:** `src/Infrastructure/Security/ApiKeyAuthenticator.php`, `src/Infrastructure/Security/ApiKeyUser.php`  
> **Modifies:** `config/packages/security.yaml`  
> **Verify:** `vendor/bin/phpunit --filter ApiKeyAuthenticatorTest`  
> **Done when:** `Bearer eak_live_…` header grants `ROLE_API_KEY`; invalid key returns 401; `access_control` grants `ROLE_API_KEY` for `/api/v1/external`.

**Reference:** `angebots-engine/src/lib/api-key-auth.ts`

```php
// src/Infrastructure/Security/ApiKeyAuthenticator.php
final class ApiKeyAuthenticator extends AbstractAuthenticator
{
    public function supports(Request $request): ?bool
    {
        return str_starts_with($request->headers->get('Authorization', ''), 'Bearer eak_live_');
    }

    public function authenticate(Request $request): Passport
    {
        $rawKey = substr($request->headers->get('Authorization'), 7);
        $prefix = substr($rawKey, 0, 17);

        return new SelfValidatingPassport(
            new UserBadge($rawKey, function (string $key) use ($prefix): UserInterface {
                $candidates = $this->apiKeyRepo->findActiveByPrefix($prefix);
                foreach ($candidates as $apiKey) {
                    if (password_verify($key, $apiKey->getKeyHash())) {
                        $apiKey->setLastAccessAt(new \DateTimeImmutable());
                        $this->em->flush();
                        return new ApiKeyUser($apiKey);
                    }
                }
                throw new AuthenticationException('Invalid API key');
            }),
        );
    }
}
```

`ApiKeyUser` is a lightweight `UserInterface` with `getRoles(): ['ROLE_API_KEY']`.

TS ref: `api-key-auth.ts` — prefix-based lookup then bcrypt compare.


---

> **Part 1 complete** — proceed to [`impl-plan-wagner-offer-studio-core-p2.md`](impl-plan-wagner-offer-studio-core-p2.md) when all four tasks above pass their **Verify** commands.
