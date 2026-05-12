# Migration Plan: Angebots-Engine → PHP / Symfony / Doctrine / Vue.js

> Created: 2026-05-07
> Updated: 2026-05-12
> Status: **Active — approved**

---

## Overview

The migration runs inside a shared parent directory called **`Angebots-engine-migration`** containing three independent git repositories. The original codebase stays untouched as a live reference. The new system is split into a standalone rules engine microservice and a fully decoupled main application.

All code, naming, API contracts, and documentation are written in **English**.

### Repository Layout

```
Angebots-engine-migration/
├── angebots-engine/     ← Existing repo — cloned reference, read-only during migration
├── pricing-core/        ← NEW: Rules engine microservice
└── offer-studio/        ← NEW: Main application (Symfony API + Vue.js SPA)
```

| # | Repo | Purpose |
|---|---|---|
| 0 | `angebots-engine` | Current production codebase — live reference throughout the entire migration |
| 1 | `pricing-core` | NEW: Rules engine microservice — PHP/Symfony, single responsibility |
| 2 | `offer-studio` | NEW: Main application — Symfony REST API + Vue.js SPA |

### Why Three Repos

Having all three repos side by side in one directory is the core working strategy:

- **`angebots-engine` is the living reference.** Every piece of logic, every edge case, every test already exists there in TypeScript. When building `pricing-core` or `offer-studio`, open the corresponding file in `angebots-engine` right next to it. You always know exactly what the correct behaviour is — no guessing, no ambiguity, no relying on documentation.
- **Full access to the original logic at all times.** `src/lib/engine.ts` is the ground truth for `pricing-core`. `src/services/**` is the ground truth for `offer-studio`'s use cases. `src/app/api/v1/**` is the ground truth for every API route. The existing test suite in `src/__tests__/` is the acceptance baseline — port the tests first, then make them pass.
- **`angebots-engine` stays runnable and untouched.** It is the production fallback until `offer-studio` is live, and the data source for the final DB migration script.
- **Clean separation between old and new.** `pricing-core` and `offer-studio` are independent git repos from day one — no risk of accidentally coupling them to the legacy codebase at the module level.

---

## 1. System Architecture

```
Angebots-engine-migration/
│
│  ┌─────────────────────────────────────────────────────────────────────┐
│  │  offer-studio                                                        │
│  │                                                                      │
│  │  ┌──────────────────────────┐   ┌──────────────────────────────┐   │
│  │  │  Vue.js SPA              │   │  Symfony API                 │   │
│  │  │  (Vite + Pinia + Router) │──▶│  /api/v1/...                 │   │
│  │  │                          │   │                              │   │
│  │  │  - Configurator          │   │  - Auth (JWT)                │   │
│  │  │  - Domain Editor         │   │  - Domain CRUD               │   │
│  │  │  - Admin Dashboard       │   │  - Pricelist CRUD            │   │
│  │  │  - Pricelist Editor      │   │  - External API              │   │
│  │  └──────────────────────────┘   │  - Webhook dispatch          │   │
│  │                                 └──────────────┬───────────────┘   │
│  │                                                │ HTTP               │
│  │                                 ┌──────────────▼───────────────┐   │
│  │                                 │  PostgreSQL                   │   │
│  │                                 └───────────────────────────────┘   │
│  └────────────────────────────┬────────────────────────────────────────┘
│                               │ POST /run  (internal network)
│  ┌────────────────────────────▼────────────────────────────────────────┐
│  │  pricing-core                                                        │
│  │                                                                      │
│  │  POST /run  { config, inputs } → EngineResult                       │
│  │                                                                      │
│  │  - RulesEngine       (pure PHP, zero framework deps)                │
│  │  - ConditionEvaluator                                                │
│  │  - FormulaEvaluator                                                  │
│  └──────────────────────────────────────────────────────────────────────┘
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
mkdir Angebots-engine-migration
cd Angebots-engine-migration

# Reference repo — the current production codebase
git clone git@github.com:<org>/angebots-engine.git

# New microservice
git clone git@github.com:<org>/pricing-core.git        # or: git init pricing-core

# New main application
git clone git@github.com:<org>/offer-studio.git        # or: git init offer-studio
```

Each directory is its own git repo with its own remote. The parent directory `Angebots-engine-migration` is **not** a git repo itself — no nested submodules, no monorepo tooling.

### Local Docker Compose (workspace-level)

A single `docker-compose.yml` at the workspace root wires everything together for local development:

```yaml
# Angebots-engine-migration/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: offer_studio
      POSTGRES_USER: offer
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"

  pricing-core:
    build: ./pricing-core
    ports:
      - "8001:8000"
    environment:
      APP_ENV: dev

  offer-studio-api:
    build: ./offer-studio
    ports:
      - "8000:8000"
    environment:
      APP_ENV: dev
      DATABASE_URL: postgresql://offer:secret@postgres:5432/offer_studio
      ENGINE_BASE_URL: http://pricing-core:8000
    depends_on:
      - postgres
      - pricing-core
```

---

## 3. Repo 1 — `pricing-core` (Rules Engine Microservice)

### Purpose

A minimal Symfony application with a **single HTTP endpoint**. Accepts a domain config + user inputs, runs the rules engine, returns the result. No database, no auth, no state — pure computation.

Deployed on the internal network. `offer-studio` is its only consumer.

### Directory Structure

```
pricing-core/
│
├── config/
│   ├── packages/
│   │   └── framework.yaml
│   ├── routes.yaml
│   └── services.yaml
│
├── src/
│   ├── Domain/
│   │   ├── Contract/
│   │   │   ├── EngineInterface.php
│   │   │   ├── ConditionEvaluatorInterface.php
│   │   │   └── FormulaEvaluatorInterface.php
│   │   │
│   │   ├── Model/                         ← Immutable value objects
│   │   │   ├── DomainConfig.php
│   │   │   ├── Field.php
│   │   │   ├── FieldType.php              ← PHP Enum
│   │   │   ├── RuleGroup.php
│   │   │   ├── Rule.php
│   │   │   ├── Condition.php
│   │   │   ├── ConditionGroup.php
│   │   │   ├── FreeTextRule.php
│   │   │   ├── Validation.php
│   │   │   ├── Component.php
│   │   │   ├── Variant.php
│   │   │   ├── FieldValues.php
│   │   │   ├── EngineResult.php
│   │   │   ├── FiredRule.php
│   │   │   ├── ActiveComponent.php
│   │   │   └── ValidationMessage.php
│   │   │
│   │   ├── Service/
│   │   │   ├── RulesEngine.php            ← Main orchestrator
│   │   │   ├── ConditionEvaluator.php
│   │   │   ├── FormulaEvaluator.php       ← symfony/expression-language
│   │   │   └── FormulaOrderAnalyzer.php   ← Kahn's topological sort
│   │   │
│   │   └── Exception/
│   │       ├── InvalidFormulaException.php
│   │       └── CyclicDependencyException.php
│   │
│   └── UI/
│       ├── Controller/
│       │   └── EngineController.php       ← POST /run
│       ├── Request/
│       │   └── RunEngineRequest.php
│       └── Transformer/
│           └── EngineResultTransformer.php
│
├── tests/
│   ├── Unit/Domain/
│   │   ├── Service/
│   │   │   ├── RulesEngineTest.php
│   │   │   ├── ConditionEvaluatorTest.php
│   │   │   ├── FormulaEvaluatorTest.php
│   │   │   └── FormulaOrderAnalyzerTest.php
│   │   └── Model/
│   │       └── FieldValuesTest.php
│   └── Fixtures/
│       └── DomainConfig/
│
├── Dockerfile
└── composer.json
```

### API Contract

```
POST /run

Request:
{
  "config": {
    "fields": [...],
    "ruleGroups": [...],
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

## 4. Repo 2 — `offer-studio` (Main Application)

### Directory Structure

```
offer-studio/
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
│   │   │   ├── RunEngineUseCase.php       ← Calls pricing-core via interface
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
│   │   │   └── HttpEngineService.php      ← Calls pricing-core via HTTP
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
│   │   │   └── RedisRateLimiter.php
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
│
├── frontend/                              ← Vue.js SPA (Vite project)
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts                  ← Axios + JWT interceptors
│   │   │   ├── domains.ts
│   │   │   ├── pricelists.ts
│   │   │   ├── engine.ts
│   │   │   └── auth.ts
│   │   ├── engine/                        ← TS port for in-browser live preview
│   │   │   ├── types.ts
│   │   │   ├── ConditionEvaluator.ts
│   │   │   ├── FormulaEvaluator.ts
│   │   │   └── RulesEngine.ts
│   │   ├── stores/
│   │   │   ├── auth.ts
│   │   │   ├── domain.ts
│   │   │   └── configurator.ts
│   │   ├── pages/
│   │   │   ├── Login.vue
│   │   │   ├── Dashboard.vue
│   │   │   ├── domains/
│   │   │   │   ├── Index.vue
│   │   │   │   ├── Editor.vue
│   │   │   │   └── Simulator.vue
│   │   │   ├── pricelists/
│   │   │   │   ├── Index.vue
│   │   │   │   └── Editor.vue
│   │   │   ├── configurator/
│   │   │   │   └── [domainId].vue
│   │   │   └── admin/
│   │   │       ├── Users.vue
│   │   │       ├── ApiKeys.vue
│   │   │       ├── Logs.vue
│   │   │       └── Webhooks.vue
│   │   └── components/
│   │       ├── engine/
│   │       │   ├── FieldsEditor.vue
│   │       │   ├── RulesEditor.vue
│   │       │   ├── ConditionBuilder.vue
│   │       │   ├── ValidationsEditor.vue
│   │       │   ├── ComponentsEditor.vue
│   │       │   └── FormulaInput.vue
│   │       └── ui/
│   └── vite.config.ts
│
└── tests/
    ├── Integration/
    │   └── UI/Controller/
    └── Fixtures/
```

---

## 5. Domain Models — Full English Naming

All value objects are defined in `pricing-core`. `offer-studio` references them only through the HTTP contract (JSON). No shared Composer package needed — the JSON schema *is* the contract.

### Field & FieldType

```php
// pricing-core/src/Domain/Model/FieldType.php
enum FieldType: string
{
    case Number  = 'number';
    case Text    = 'text';
    case Select  = 'select';
    case Boolean = 'boolean';
    case Formula = 'formula';
    case Output  = 'output';
}

// pricing-core/src/Domain/Model/Field.php
final class Field
{
    public function __construct(
        public readonly string    $key,
        public readonly string    $label,
        public readonly FieldType $type,
        public readonly mixed     $default = null,
        public readonly ?string   $formula = null,
        public readonly array     $options = [],
    ) {}
}
```

### FieldValues

```php
// pricing-core/src/Domain/Model/FieldValues.php
final class FieldValues
{
    private array $values;

    public function __construct(array $values)
    {
        $this->values = $values;
    }

    public function get(string $key): mixed
    {
        return $this->values[$key] ?? null;
    }

    public function with(string $key, mixed $value): self
    {
        $new = clone $this;
        $new->values[$key] = $value;
        return $new;
    }

    public function all(): array
    {
        return $this->values;
    }
}
```

### DomainConfig

```php
// pricing-core/src/Domain/Model/DomainConfig.php
final class DomainConfig
{
    public function __construct(
        public readonly array $fields,      // Field[]
        public readonly array $ruleGroups,  // RuleGroup[]
        public readonly array $validations, // Validation[]
        public readonly array $components,  // Component[]
    ) {}
}
```

### RuleGroup, Rule, Condition

```php
// pricing-core/src/Domain/Model/RuleGroup.php
final class RuleGroup
{
    public function __construct(
        public readonly string $targetField,
        public readonly array  $rules,      // Rule[]
    ) {}
}

// pricing-core/src/Domain/Model/Rule.php
final class Rule
{
    public function __construct(
        public readonly array  $conditions, // Condition[]
        public readonly mixed  $value,
        public readonly string $logic = 'AND',
    ) {}
}

// pricing-core/src/Domain/Model/Condition.php
final class Condition
{
    public function __construct(
        public readonly string  $field,
        public readonly string  $operator,
        public readonly mixed   $value,
        public readonly ?string $compareField = null,
    ) {}
}

// pricing-core/src/Domain/Model/ConditionGroup.php
final class ConditionGroup
{
    public function __construct(
        public readonly array  $conditions, // Condition[]
        public readonly string $logic,      // 'AND' | 'OR'
    ) {}
}
```

### Validation, Component, Variant, EngineResult

```php
// pricing-core/src/Domain/Model/Validation.php
final class Validation
{
    public function __construct(
        public readonly string                   $type,      // 'error' | 'warning'
        public readonly string                   $message,
        public readonly Condition|ConditionGroup $condition,
    ) {}
}

// pricing-core/src/Domain/Model/Component.php
final class Component
{
    public function __construct(
        public readonly string  $id,
        public readonly string  $name,
        public readonly string  $quantityField,
        public readonly array   $activationRules,  // Condition[]
        public readonly array   $variants,         // Variant[]
        public readonly array   $dependencies,     // Dependency[]
    ) {}
}

// pricing-core/src/Domain/Model/Variant.php
final class Variant
{
    public function __construct(
        public readonly string  $articleNumber,
        public readonly bool    $default = false,
        public readonly ?string $whenField = null,
        public readonly ?string $operator = null,
        public readonly mixed   $value = null,
    ) {}
}

// pricing-core/src/Domain/Model/EngineResult.php
final class EngineResult
{
    public function __construct(
        public readonly FieldValues $values,
        public readonly array       $firedRules,       // FiredRule[]
        public readonly array       $activeFreeText,   // FreeTextRule[]
        public readonly array       $activeComponents, // ActiveComponent[]
        public readonly array       $validations,      // ValidationMessage[]
    ) {}
}
```

---

## 6. The Rules Engine — Full Detail

### 6.1 Condition Evaluator

```php
// pricing-core/src/Domain/Service/ConditionEvaluator.php
final class ConditionEvaluator implements ConditionEvaluatorInterface
{
    public function evaluate(Condition $condition, FieldValues $values): bool
    {
        $fieldValue = $values->get($condition->field);

        $compareValue = $condition->compareField !== null
            ? $values->get($condition->compareField)
            : $condition->value;

        return match ($condition->operator) {
            '=='       => $this->looseEquals($fieldValue, $compareValue),
            '!='       => !$this->looseEquals($fieldValue, $compareValue),
            '<'        => $this->toNumber($fieldValue) < $this->toNumber($compareValue),
            '<='       => $this->toNumber($fieldValue) <= $this->toNumber($compareValue),
            '>'        => $this->toNumber($fieldValue) > $this->toNumber($compareValue),
            '>='       => $this->toNumber($fieldValue) >= $this->toNumber($compareValue),
            'contains' => str_contains((string) $fieldValue, (string) $compareValue),
            default    => throw new \InvalidArgumentException("Unknown operator: {$condition->operator}"),
        };
    }

    public function evaluateGroup(array $conditions, string $logic, FieldValues $values): bool
    {
        if ($logic === 'OR') {
            foreach ($conditions as $condition) {
                if ($this->evaluate($condition, $values)) return true;
            }
            return false;
        }

        foreach ($conditions as $condition) {
            if (!$this->evaluate($condition, $values)) return false;
        }
        return true;
    }

    private function looseEquals(mixed $a, mixed $b): bool
    {
        if (is_bool($a) || is_bool($b)) return (bool) $a === (bool) $b;
        if (is_numeric($a) && is_numeric($b)) return (float) $a === (float) $b;
        return (string) $a === (string) $b;
    }

    private function toNumber(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }
}
```

### 6.2 Formula Evaluator — Safe, No eval()

```php
// pricing-core/src/Domain/Service/FormulaEvaluator.php
final class FormulaEvaluator implements FormulaEvaluatorInterface
{
    private ExpressionLanguage $expressionLanguage;

    public function __construct()
    {
        $this->expressionLanguage = new ExpressionLanguage();

        foreach (['round', 'floor', 'ceil', 'min', 'max', 'abs', 'pow', 'sqrt'] as $fn) {
            $this->expressionLanguage->register(
                $fn,
                fn (...$args) => sprintf('%s(%s)', $fn, implode(', ', $args)),
                fn (array $vars, ...$args) => $fn(...$args),
            );
        }
    }

    public function evaluate(string $formula, FieldValues $values): int|float
    {
        if (!$this->isSafe($formula, array_keys($values->all()))) {
            throw new InvalidFormulaException("Unsafe formula: {$formula}");
        }

        try {
            $result = $this->expressionLanguage->evaluate($formula, $values->all());
            return is_numeric($result) ? $result : 0;
        } catch (\Exception) {
            return 0;
        }
    }

    public function isSafe(string $formula, array $allowedKeys): bool
    {
        $safe = $formula;
        foreach ($allowedKeys as $key) {
            $safe = str_replace($key, '', $safe);
        }
        foreach (['round', 'floor', 'ceil', 'min', 'max', 'abs', 'pow', 'sqrt'] as $fn) {
            $safe = str_replace($fn, '', $safe);
        }
        return preg_replace('/[\d\s\+\-\*\/\(\)\.,]/', '', $safe) === '';
    }
}
```

### 6.3 The Main Engine

```php
// pricing-core/src/Domain/Service/RulesEngine.php
final class RulesEngine implements EngineInterface
{
    public function __construct(
        private readonly ConditionEvaluatorInterface $conditionEvaluator,
        private readonly FormulaEvaluatorInterface   $formulaEvaluator,
    ) {}

    public function run(DomainConfig $config, array $inputs): EngineResult
    {
        $values = $this->initializeValues($config, $inputs);

        // Step 1: Rule resolution (multi-pass fixed-point)
        [$values, $firedRules] = $this->resolveRules($config, $values);

        // Step 2: Formula evaluation (topologically ordered)
        $values = $this->evaluateFormulas($config, $values);

        // Step 3: Validations
        $validations = $this->runValidations($config, $values);

        // Step 4: Component resolution
        [$activeFreeText, $activeComponents] = $this->resolveComponents($config, $values);

        return new EngineResult(
            values:           $values,
            firedRules:       $firedRules,
            activeFreeText:   $activeFreeText,
            activeComponents: $activeComponents,
            validations:      $validations,
        );
    }

    private function initializeValues(DomainConfig $config, array $inputs): FieldValues
    {
        $values = [];
        foreach ($config->fields as $field) {
            $values[$field->key] = $inputs[$field->key] ?? $field->default ?? null;
        }
        return new FieldValues($values);
    }

    private function resolveRules(DomainConfig $config, FieldValues $values): array
    {
        $firedRules = [];
        $outputCount = count(array_filter($config->fields, fn (Field $f) => $f->type === FieldType::Output));

        for ($pass = 0; $pass < $outputCount + 1; $pass++) {
            foreach ($config->ruleGroups as $group) {
                foreach ($group->rules as $index => $rule) {
                    if ($this->evaluateRule($rule, $values)) {
                        $values = $values->with($group->targetField, $rule->value);
                        $firedRules[] = new FiredRule($group->targetField, $rule->value, $index);
                        break; // first match wins
                    }
                }
            }
        }

        return [$values, $firedRules];
    }

    private function evaluateRule(Rule $rule, FieldValues $values): bool
    {
        if (empty($rule->conditions)) return true; // fallback rule

        return $this->conditionEvaluator->evaluateGroup($rule->conditions, $rule->logic, $values);
    }

    private function evaluateFormulas(DomainConfig $config, FieldValues $values): FieldValues
    {
        $formulaFields = array_filter(
            $config->fields,
            fn (Field $f) => $f->type === FieldType::Formula && $f->formula !== null
        );

        foreach ($formulaFields as $field) {
            $values = $values->with($field->key, $this->formulaEvaluator->evaluate($field->formula, $values));
        }

        return $values;
    }

    private function runValidations(DomainConfig $config, FieldValues $values): array
    {
        $messages = [];

        foreach ($config->validations as $validation) {
            if ($this->evaluateValidationCondition($validation->condition, $values)) {
                $messages[] = new ValidationMessage($validation->type, $validation->message);
            }
        }

        return $messages;
    }

    private function evaluateValidationCondition(Condition|ConditionGroup $condition, FieldValues $values): bool
    {
        if ($condition instanceof ConditionGroup) {
            return $this->conditionEvaluator->evaluateGroup($condition->conditions, $condition->logic, $values);
        }
        return $this->conditionEvaluator->evaluate($condition, $values);
    }

    private function resolveComponents(DomainConfig $config, FieldValues $values): array
    {
        $activeFreeText   = [];
        $activeComponents = [];
        $processedIds     = [];

        foreach ($config->ruleGroups as $group) {
            foreach ($group->rules as $rule) {
                if ($rule instanceof FreeTextRule && $rule->activeWhen !== null) {
                    if ($this->conditionEvaluator->evaluate($rule->activeWhen, $values)) {
                        $activeFreeText[] = $rule;
                    }
                }
            }
        }

        foreach ($config->components as $component) {
            if ($this->isComponentActive($component, $values)) {
                $this->resolveComponent($component, $values, $config, $activeComponents, $processedIds);
            }
        }

        return [$activeFreeText, $activeComponents];
    }

    private function isComponentActive(Component $component, FieldValues $values): bool
    {
        if (empty($component->activationRules)) return true;

        foreach ($component->activationRules as $rule) {
            if ($this->conditionEvaluator->evaluate($rule, $values)) return true;
        }
        return false;
    }

    private function resolveComponent(
        Component $component,
        FieldValues $values,
        DomainConfig $config,
        array &$result,
        array &$processedIds,
    ): void {
        if (in_array($component->id, $processedIds, true)) return;

        $processedIds[] = $component->id;
        $result[] = new ActiveComponent(
            component:     $component,
            quantity:      (float) ($values->get($component->quantityField) ?? 0),
            articleNumber: $this->resolveVariant($component, $values),
        );

        foreach ($component->dependencies as $dep) {
            $depComponent = $this->findComponent($config, $dep->componentId);
            if ($depComponent !== null) {
                $this->resolveComponent($depComponent, $values, $config, $result, $processedIds);
            }
        }
    }

    private function resolveVariant(Component $component, FieldValues $values): ?string
    {
        $default = null;
        foreach ($component->variants as $variant) {
            if ($variant->default) $default = $variant->articleNumber;
            if ($variant->whenField !== null) {
                $condition = new Condition($variant->whenField, $variant->operator ?? '==', $variant->value);
                if ($this->conditionEvaluator->evaluate($condition, $values)) return $variant->articleNumber;
            }
        }
        return $default;
    }

    private function findComponent(DomainConfig $config, string $id): ?Component
    {
        foreach ($config->components as $component) {
            if ($component->id === $id) return $component;
        }
        return null;
    }
}
```

### 6.4 Topological Sort

```php
// pricing-core/src/Domain/Service/FormulaOrderAnalyzer.php
final class FormulaOrderAnalyzer
{
    /** Kahn's algorithm — ensures formula fields are evaluated after their dependencies. */
    public function sort(array $fields): array
    {
        $formulaKeys   = [];
        $dependencyMap = [];

        foreach ($fields as $field) {
            if ($field->type !== FieldType::Formula || $field->formula === null) continue;
            $formulaKeys[]              = $field->key;
            $dependencyMap[$field->key] = array_filter($formulaKeys, fn ($k) => str_contains($field->formula, $k));
        }

        $inDegree = array_fill_keys($formulaKeys, 0);
        $graph    = array_fill_keys($formulaKeys, []);

        foreach ($dependencyMap as $key => $deps) {
            foreach ($deps as $dep) {
                if (isset($graph[$dep])) {
                    $graph[$dep][] = $key;
                    $inDegree[$key]++;
                }
            }
        }

        $queue  = array_keys(array_filter($inDegree, fn ($d) => $d === 0));
        $sorted = [];

        while (!empty($queue)) {
            $node     = array_shift($queue);
            $sorted[] = $node;
            foreach ($graph[$node] as $neighbour) {
                if (--$inDegree[$neighbour] === 0) $queue[] = $neighbour;
            }
        }

        // Cyclic fields appended unchanged (graceful degradation)
        return [...$sorted, ...array_diff($formulaKeys, $sorted)];
    }
}
```

### 6.5 Engine Controller (Microservice Entry Point)

```php
// pricing-core/src/UI/Controller/EngineController.php
#[Route('/run', methods: ['POST'])]
final class EngineController extends AbstractController
{
    public function __construct(
        private readonly RulesEngine            $engine,
        private readonly DomainConfigSerializer $serializer,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $data   = $request->toArray();
        $config = $this->serializer->deserialize($data['config'] ?? []);
        $inputs = $data['inputs'] ?? [];
        $result = $this->engine->run($config, $inputs);

        return $this->json([
            'values'           => $result->values->all(),
            'firedRules'       => array_map(fn ($r) => [
                'targetField' => $r->targetField,
                'value'       => $r->value,
                'ruleIndex'   => $r->ruleIndex,
            ], $result->firedRules),
            'validations'      => array_map(fn ($v) => [
                'type'    => $v->type,
                'message' => $v->message,
            ], $result->validations),
            'activeComponents' => array_map(fn ($c) => [
                'id'            => $c->component->id,
                'name'          => $c->component->name,
                'quantity'      => $c->quantity,
                'articleNumber' => $c->articleNumber,
            ], $result->activeComponents),
            'activeFreeText'   => $result->activeFreeText,
        ]);
    }
}
```

---

## 7. offer-studio — Engine Integration

`offer-studio` never imports `RulesEngine` or any `pricing-core` class. It depends on `EngineServiceInterface`, satisfied by `HttpEngineService` in production and a fake in tests.

```php
// offer-studio/src/Application/Engine/EngineServiceInterface.php
interface EngineServiceInterface
{
    public function run(array $config, array $inputs): array;
}

// offer-studio/src/Application/Engine/RunEngineUseCase.php
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

        return $this->engineService->run($domain->getConfigJson(), $command->inputs);
    }
}

// offer-studio/src/Infrastructure/Engine/HttpEngineService.php
final class HttpEngineService implements EngineServiceInterface
{
    public function __construct(
        private readonly HttpClientInterface $client,
        private readonly string              $engineBaseUrl,
    ) {}

    public function run(array $config, array $inputs): array
    {
        return $this->client
            ->request('POST', $this->engineBaseUrl . '/run', [
                'json' => ['config' => $config, 'inputs' => $inputs],
            ])
            ->toArray();
    }
}
```

---

## 8. Doctrine Entities (offer-studio)

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

## 9. API Design (offer-studio)

### Route Map

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh

GET    /api/v1/domains
POST   /api/v1/domains
GET    /api/v1/domains/{id}
PATCH  /api/v1/domains/{id}
DELETE /api/v1/domains/{id}
POST   /api/v1/domains/{id}/duplicate
POST   /api/v1/domains/{id}/run         ← Proxies to pricing-core

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
# offer-studio/config/packages/security.yaml
security:
  firewalls:
    api_external:
      pattern: ^/api/v1/external
      stateless: true
      custom_authenticators:
        - App\Infrastructure\Security\ApiKeyAuthenticator

    api_internal:
      pattern: ^/api/v1
      stateless: true
      jwt: ~

  access_control:
    - { path: ^/api/v1/auth/login, roles: PUBLIC_ACCESS }
    - { path: ^/api/v1/external,   roles: PUBLIC_ACCESS }
    - { path: ^/api/v1/admin,      roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1/users,      roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1/api-keys,   roles: ROLE_SUPER_ADMIN }
    - { path: ^/api/v1,            roles: ROLE_SELLER }
```

---

## 10. Frontend — Vue.js (offer-studio)

### Dual Engine Strategy

The browser runs a **TypeScript port** of the rules engine for instant configurator feedback. `pricing-core` handles all trusted calculations — webhook payloads, saved results, API responses. Both engines must stay in sync; a shared fixture test suite validates they produce identical output.

```typescript
// offer-studio/frontend/src/engine/RulesEngine.ts
// TypeScript port — logic must mirror pricing-core RulesEngine exactly.
export function runEngine(config: DomainConfig, inputs: FieldValues): EngineResult {
    // ... identical algorithm
}
```

**Configurator flow:**
1. User changes a field → TS engine recalculates instantly (no request)
2. User submits / saves → `POST /api/v1/domains/{id}/run` → `pricing-core` result (authoritative)

---

## 11. Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| PHP | 8.3 | Enums, readonly properties |
| Framework | Symfony 7 LTS | Long-term support |
| ORM | Doctrine 3 | Standard for Symfony |
| Auth | LexikJWTAuthBundle | JWT standard |
| CORS | NelmioCorsBundle | One config block |
| Rate limiting | symfony/rate-limiter | Redis-backed, built-in |
| Formula eval | symfony/expression-language | Safe sandbox, no eval() |
| HTTP client | symfony/http-client | Used by HttpEngineService |
| Database | PostgreSQL 16 | Native JSON, best Doctrine support |
| Frontend | Vue 3 + Composition API | Closest to React mental model |
| State | Pinia | Official Vue state manager |
| HTTP client (FE) | Axios | JWT interceptors |
| Build | Vite | Fast, simple |
| CSS | Tailwind CSS | Carries over 1:1 |
| Testing | PHPUnit + Pest | Unit tests for engine, integration for API |

---

## 12. Phased Roadmap

### Phase 0 — Workspace & Repo Setup (2 days)
- [ ] Create parent directory `Angebots-engine-migration/`
- [ ] Clone `angebots-engine` into it (read-only reference)
- [ ] Create `pricing-core` repo — init Symfony skeleton, set up CI (lint, test)
- [ ] Create `offer-studio` repo — init Symfony skeleton + Vite frontend scaffold, set up CI
- [ ] Write workspace-level `docker-compose.yml` (postgres, pricing-core, offer-studio-api)

### Phase 1 — `pricing-core`: Rules Engine (1.5 weeks)
Reference: `angebots-engine/src/lib/engine.ts` + `src/__tests__/engine.test.ts`

- [ ] Port `engine.test.ts` to PHPUnit **first** — these are the acceptance criteria
- [ ] All domain models (`Field`, `RuleGroup`, `Rule`, `Condition`, etc.) — mirror `src/types/domain.ts`
- [ ] `ConditionEvaluator` — mirror `evaluateCondition` / `evaluateBedingungsGruppe` in `engine.ts`
- [ ] `FormulaEvaluator` — mirror `evaluateFormula` + `isSafeFormula` in `engine.ts`
- [ ] `FormulaOrderAnalyzer` — mirror topological sort in `engine.ts`
- [ ] `RulesEngine` — mirror `runEngine` four-stage pipeline in `engine.ts`
- [ ] `DomainConfigSerializer` (JSON → domain models)
- [ ] `EngineController` — `POST /run`
- [ ] Dockerfile for `pricing-core`
- [ ] All ported tests must pass before moving to Phase 2

### Phase 2 — `offer-studio`: Backend Core (2 weeks)
Reference: `angebots-engine/src/services/**` + `angebots-engine/src/app/api/v1/**`

- [ ] Doctrine entities + migrations — mirror Prisma schema in `angebots-engine/prisma/schema.prisma`
- [ ] JWT authentication + `UserProvider` — mirror `angebots-engine/src/lib/auth-helpers.ts`
- [ ] `ApiKeyAuthenticator` — mirror `angebots-engine/src/lib/api-key-auth.ts`
- [ ] `HttpEngineService` — calls `pricing-core`
- [ ] All CRUD use cases — mirror `angebots-engine/src/services/**`
- [ ] `POST /domains/{id}/run` — proxies to `pricing-core`
- [ ] All external routes — mirror `angebots-engine/src/app/api/v1/**`
- [ ] API logging middleware — mirror `angebots-engine/src/middleware.ts`
- [ ] Rate limiting — mirror `angebots-engine/src/lib/rate-limit.ts`
- [ ] Webhook dispatch — mirror `angebots-engine/src/services/webhook.service.ts`

### Phase 3 — `offer-studio`: Vue Frontend (2.5 weeks)
Reference: `angebots-engine/src/app/(app)/**` + `angebots-engine/src/components/**`

- [ ] Auth pages — mirror `angebots-engine/src/app/(auth)/**`
- [ ] Domain editor (Fields, Rules, Validations, Components tabs) — mirror `angebots-engine/src/app/(app)/domains/**`
- [ ] TypeScript engine port — mirror `angebots-engine/src/lib/engine.ts`; must pass shared fixture suite against `pricing-core`
- [ ] Configurator page — mirror `angebots-engine/src/app/(app)/configurator/**`
- [ ] Admin pages (users, API keys, logs, webhooks) — mirror `angebots-engine/src/app/(app)/admin/**`
- [ ] Pricelist editor — mirror `angebots-engine/src/app/(app)/pricelists/**`
- [ ] Dashboard — mirror `angebots-engine/src/app/(app)/dashboard/**`

### Phase 4 — Data Migration & Launch (1 week)
- [ ] Write migration script: `angebots-engine` DB → `offer-studio` DB (keep CUIDs)
- [ ] Run migration against a copy of production data, verify counts and checksums
- [ ] Production Docker Compose for `pricing-core` and `offer-studio`
- [ ] Smoke test all API endpoints against migrated data
- [ ] Decommission `angebots-engine`

**Total: ~7–8 weeks** at a comfortable pace.

---

## 13. Open Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **IDs** | Keep CUID (26-char) vs. UUID | Keep CUID — API compatibility, no migration pain |
| 2 | **Config versioning** | Add `schemaVersion` to `configJson` | Yes — allows graceful future schema migrations |
| 3 | **Microservice auth** | None (network-only) vs. shared secret header | `X-Engine-Token` shared secret — low overhead, avoids open access |
| 4 | **Webhook delivery** | Synchronous vs. Symfony Messenger queue | Messenger queue — retryable, non-blocking |
| 5 | **TS/PHP engine sync** | Manual vs. contract test | Shared JSON fixture suite run against both — catches drift automatically |

---

> The rules engine is the soul of this system — build and prove `pricing-core` correct before touching anything else.
> `angebots-engine` stays live and untouched throughout the migration; it is the safety net and the data source.
