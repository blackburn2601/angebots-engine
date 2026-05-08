# Migration Plan: Angebots-Engine → PHP / Symfony / Doctrine / Vue.js

> Created: 2026-05-07  
> Status: Draft — under consideration

---

## 1. Architecture Overview

The new system is **headless and API-first**. Symfony owns all business logic and exposes a versioned REST API. Vue.js is a fully decoupled SPA that consumes that API. They share nothing except the API contract.

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│        Vue.js SPA               │     │       Symfony API                │
│  (Vite + Pinia + Vue Router)    │────▶│  /api/v1/...                     │
│                                 │     │                                  │
│  - Configurator                 │     │  - Auth (JWT)                    │
│  - Domain Editor                │     │  - Rules Engine                  │
│  - Admin Dashboard              │     │  - Domain CRUD                   │
│  - Pricelist Editor             │     │  - Pricelist CRUD                │
└─────────────────────────────────┘     │  - External API                  │
                                        │  - Webhook dispatch              │
                                        └──────────────┬───────────────────┘
                                                       │
                                        ┌──────────────▼───────────────────┐
                                        │       PostgreSQL                  │
                                        └──────────────────────────────────┘
```

**Clean Architecture layers:**

```
src/
├── Domain/          ← Pure business logic, no framework dependencies
├── Application/     ← Use cases, orchestration, interfaces
├── Infrastructure/  ← Doctrine, HTTP, external services
└── UI/              ← Symfony controllers, request/response DTOs
```

---

## 2. Directory Structure

```
angebots-engine-php/
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
│   │
│   ├── Domain/
│   │   ├── Engine/                          ← THE RULES ENGINE (core)
│   │   │   ├── Contract/
│   │   │   │   ├── EngineInterface.php
│   │   │   │   ├── ConditionEvaluatorInterface.php
│   │   │   │   └── FormulaEvaluatorInterface.php
│   │   │   ├── Model/                       ← Value Objects (immutable)
│   │   │   │   ├── DomainConfig.php
│   │   │   │   ├── Datenfeld.php
│   │   │   │   ├── FeldTyp.php              ← PHP Enum
│   │   │   │   ├── RegelGruppe.php
│   │   │   │   ├── StrukturierteRegel.php
│   │   │   │   ├── RegelBedingung.php
│   │   │   │   ├── FreitextRegel.php
│   │   │   │   ├── Validierung.php
│   │   │   │   ├── Komponente.php
│   │   │   │   ├── Variante.php
│   │   │   │   ├── FieldValues.php
│   │   │   │   └── EngineResult.php
│   │   │   ├── Service/
│   │   │   │   ├── RulesEngine.php          ← Main engine
│   │   │   │   ├── ConditionEvaluator.php
│   │   │   │   ├── FormulaEvaluator.php     ← Uses ExpressionLanguage
│   │   │   │   └── FormulaOrderAnalyzer.php ← Topological sort
│   │   │   └── Exception/
│   │   │       ├── InvalidFormulaException.php
│   │   │       └── CyclicDependencyException.php
│   │   │
│   │   ├── Domain/                          ← "Domain" entity aggregate
│   │   │   ├── Domain.php
│   │   │   ├── DomainRepository.php         ← Interface
│   │   │   └── DomainSlug.php               ← Value Object
│   │   │
│   │   ├── Pricelist/
│   │   │   ├── Pricelist.php
│   │   │   ├── PricelistRepository.php
│   │   │   └── PreisItem.php                ← Value Object
│   │   │
│   │   ├── User/
│   │   │   ├── User.php
│   │   │   ├── UserRepository.php
│   │   │   └── UserRolle.php                ← PHP Enum
│   │   │
│   │   └── Shared/
│   │       ├── ValueObject/
│   │       │   └── Cuid.php
│   │       └── Exception/
│   │           └── DomainException.php
│   │
│   ├── Application/
│   │   ├── Engine/
│   │   │   ├── RunEngineUseCase.php
│   │   │   ├── RunEngineCommand.php         ← Input DTO
│   │   │   └── RunEngineResult.php          ← Output DTO
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
│   │   ├── Persistence/
│   │   │   ├── Doctrine/
│   │   │   │   ├── Entity/                  ← Doctrine ORM Entities
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
│       ├── Request/                         ← Input validation DTOs
│       │   ├── CreateDomainRequest.php
│       │   └── UpdateDomainConfigRequest.php
│       └── Transformer/                     ← Output formatters
│           ├── DomainTransformer.php
│           └── PricelistTransformer.php
│
├── frontend/                                ← Vue.js SPA (separate Vite project)
│   ├── src/
│   │   ├── api/                             ← API client layer
│   │   ├── components/
│   │   │   ├── engine/                      ← Rules editor components
│   │   │   └── ui/                          ← Generic UI
│   │   ├── composables/
│   │   ├── pages/
│   │   ├── stores/                          ← Pinia
│   │   └── engine/                          ← Rules engine (JS port for live preview)
│   └── vite.config.ts
│
└── tests/
    ├── Unit/
    │   └── Domain/Engine/                   ← Engine unit tests (most important)
    ├── Integration/
    │   └── UI/Controller/
    └── Fixtures/
        └── DomainConfig/
```

---

## 3. Doctrine Entities

### User

```php
#[ORM\Entity]
#[ORM\Table(name: 'users')]
class UserEntity
{
    #[ORM\Id]
    #[ORM\Column(type: 'string', length: 26)]
    private string $id;

    #[ORM\Column(type: 'string', length: 255, unique: true)]
    private string $email;

    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $name;

    #[ORM\Column(type: 'string', length: 255)]
    private string $password;

    #[ORM\Column(type: 'string', enumType: UserRolle::class)]
    private UserRolle $rolle;

    #[ORM\Column(type: 'boolean', options: ['default' => true])]
    private bool $aktiv = true;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $mussPwAendern = false;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $erstelltAm;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $letzterLogin;
}
```

### Domain

```php
#[ORM\Entity]
#[ORM\Table(name: 'domains')]
#[ORM\HasLifecycleCallbacks]
class DomainEntity
{
    #[ORM\Id]
    #[ORM\Column(type: 'string', length: 26)]
    private string $id;

    #[ORM\Column(type: 'string', length: 255)]
    private string $name;

    #[ORM\Column(type: 'string', length: 255, unique: true)]
    private string $slug;

    #[ORM\Column(type: 'json')]          // ← Native JSON column in PostgreSQL
    private array $configJson = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $erstelltAm;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    #[ORM\OneToMany(targetEntity: DomainPricelistEntity::class, mappedBy: 'domain', cascade: ['all'], orphanRemoval: true)]
    private Collection $pricelists;

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }
}
```

### ApiKey

```php
#[ORM\Entity]
#[ORM\Table(name: 'api_keys')]
#[ORM\Index(columns: ['key_prefix'], name: 'idx_api_key_prefix')]
class ApiKeyEntity
{
    #[ORM\Column(type: 'string', length: 17)]   // First 17 chars for fast lookup
    private string $keyPrefix;

    #[ORM\Column(type: 'string', length: 255, unique: true)]
    private string $keyHash;                     // bcrypt of full key
}
```

### ApiLog

```php
#[ORM\Entity]
#[ORM\Table(name: 'api_logs')]
#[ORM\Index(columns: ['zeitstempel'], name: 'idx_log_time')]
#[ORM\Index(columns: ['path'], name: 'idx_log_path')]
#[ORM\Index(columns: ['status_code'], name: 'idx_log_status')]
class ApiLogEntity
{
    #[ORM\Column(type: 'string', length: 10)]
    private string $method;

    #[ORM\Column(type: 'string', length: 500)]
    private string $path;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $statusCode;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $durationMs;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $requestBody;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $responseBody;
}
```

---

## 4. The Rules Engine — Full Detail

This is the most critical part. Every piece of logic must be preserved exactly.

### 4.1 Value Objects (Immutable)

```php
// src/Domain/Engine/Model/FeldTyp.php
enum FeldTyp: string
{
    case Number  = 'number';
    case Text    = 'text';
    case Select  = 'select';
    case Boolean = 'boolean';
    case Formula = 'formula';
    case Output  = 'output';
}

// src/Domain/Engine/Model/FieldValues.php
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

// src/Domain/Engine/Model/EngineResult.php
final class EngineResult
{
    public function __construct(
        public readonly FieldValues $values,
        public readonly array $firedRules,       // FiredRule[]
        public readonly array $activeFreitext,   // FreitextRegel[]
        public readonly array $activeKomponenten,// ActiveKomponente[]
        public readonly array $validierungen,    // ValidationMessage[]
    ) {}
}
```

### 4.2 Condition Evaluator

```php
// src/Domain/Engine/Service/ConditionEvaluator.php
final class ConditionEvaluator implements ConditionEvaluatorInterface
{
    public function evaluate(RegelBedingung $condition, FieldValues $values): bool
    {
        $fieldValue = $values->get($condition->feld);

        if ($condition->vergleichFeld !== null) {
            $compareValue = $values->get($condition->vergleichFeld);
        } else {
            $compareValue = $condition->wert;
        }

        return match($condition->op) {
            '=='      => $this->looseEquals($fieldValue, $compareValue),
            '!='      => !$this->looseEquals($fieldValue, $compareValue),
            '<'       => $this->toNumber($fieldValue) < $this->toNumber($compareValue),
            '<='      => $this->toNumber($fieldValue) <= $this->toNumber($compareValue),
            '>'       => $this->toNumber($fieldValue) > $this->toNumber($compareValue),
            '>='      => $this->toNumber($fieldValue) >= $this->toNumber($compareValue),
            'enthält' => str_contains((string)$fieldValue, (string)$compareValue),
            default   => throw new \InvalidArgumentException("Unknown operator: {$condition->op}"),
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
        if (is_bool($a) || is_bool($b)) {
            return (bool)$a === (bool)$b;
        }
        if (is_numeric($a) && is_numeric($b)) {
            return (float)$a === (float)$b;
        }
        return (string)$a === (string)$b;
    }

    private function toNumber(mixed $value): float
    {
        return is_numeric($value) ? (float)$value : 0.0;
    }
}
```

### 4.3 Formula Evaluator — Safe, No eval()

```php
// src/Domain/Engine/Service/FormulaEvaluator.php
final class FormulaEvaluator implements FormulaEvaluatorInterface
{
    // Symfony ExpressionLanguage is sandboxed — no arbitrary PHP execution
    private ExpressionLanguage $expressionLanguage;

    public function __construct()
    {
        $this->expressionLanguage = new ExpressionLanguage();

        $mathFunctions = ['round', 'floor', 'ceil', 'min', 'max', 'abs', 'pow', 'sqrt'];
        foreach ($mathFunctions as $fn) {
            $this->expressionLanguage->register(
                $fn,
                fn(...$args) => sprintf('%s(%s)', $fn, implode(', ', $args)),
                fn(array $vars, ...$args) => $fn(...$args),
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
        } catch (\Exception $e) {
            return 0;
        }
    }

    public function isSafe(string $formula, array $allowedKeys): bool
    {
        $safe = $formula;

        foreach ($allowedKeys as $key) {
            $safe = str_replace($key, '', $safe);
        }

        $mathFunctions = ['round', 'floor', 'ceil', 'min', 'max', 'abs', 'pow', 'sqrt'];
        foreach ($mathFunctions as $fn) {
            $safe = str_replace($fn, '', $safe);
        }

        $safe = preg_replace('/[\d\s\+\-\*\/\(\)\.,]/', '', $safe);

        return $safe === '';
    }
}
```

### 4.4 The Main Engine

```php
// src/Domain/Engine/Service/RulesEngine.php
final class RulesEngine implements EngineInterface
{
    public function __construct(
        private readonly ConditionEvaluatorInterface $conditionEvaluator,
        private readonly FormulaEvaluatorInterface   $formulaEvaluator,
    ) {}

    public function run(DomainConfig $config, array $inputs): EngineResult
    {
        $values = $this->initializeValues($config, $inputs);

        // Step 1: Rule resolution (multi-pass topological)
        [$values, $firedRules] = $this->resolveRules($config, $values);

        // Step 2: Formula evaluation (ordered)
        $values = $this->evaluateFormulas($config, $values);

        // Step 3: Validation
        $validierungen = $this->runValidations($config, $values);

        // Step 4: Component resolution
        [$activeFreitext, $activeKomponenten] = $this->resolveComponents($config, $values);

        return new EngineResult(
            values: $values,
            firedRules: $firedRules,
            activeFreitext: $activeFreitext,
            activeKomponenten: $activeKomponenten,
            validierungen: $validierungen,
        );
    }

    private function resolveRules(DomainConfig $config, FieldValues $values): array
    {
        $firedRules = [];
        $outputFieldCount = count(array_filter(
            $config->felder,
            fn(Datenfeld $f) => $f->typ === FeldTyp::Output
        ));

        $passes = $outputFieldCount + 1;

        for ($pass = 0; $pass < $passes; $pass++) {
            foreach ($config->regelwerk as $gruppe) {
                foreach ($gruppe->regeln as $index => $regel) {
                    if ($this->evaluateRule($regel, $values)) {
                        $values = $values->with($gruppe->zielFeld, $regel->dann);
                        $firedRules[] = new FiredRule(
                            zielFeld: $gruppe->zielFeld,
                            dann: $regel->dann,
                            regelIndex: $index,
                        );
                        break; // erste_zutreffende — first match wins
                    }
                }
            }
        }

        return [$values, $firedRules];
    }

    private function evaluateRule(StrukturierteRegel $regel, FieldValues $values): bool
    {
        if (empty($regel->bedingungen)) {
            return true; // No conditions = always fires (fallback rule)
        }

        return $this->conditionEvaluator->evaluateGroup(
            $regel->bedingungen,
            $regel->verknuepfung ?? 'AND',
            $values,
        );
    }

    private function evaluateFormulas(DomainConfig $config, FieldValues $values): FieldValues
    {
        $formulaFields = array_filter(
            $config->felder,
            fn(Datenfeld $f) => $f->typ === FeldTyp::Formula && $f->formel !== null
        );

        foreach ($formulaFields as $field) {
            $result = $this->formulaEvaluator->evaluate($field->formel, $values);
            $values = $values->with($field->key, $result);
        }

        return $values;
    }

    private function runValidations(DomainConfig $config, FieldValues $values): array
    {
        $messages = [];

        foreach ($config->validierungen as $validierung) {
            $triggered = $this->evaluateValidationCondition($validierung->bedingung, $values);
            if ($triggered) {
                $messages[] = new ValidationMessage(
                    typ: $validierung->typ,
                    meldung: $validierung->meldung,
                );
            }
        }

        return $messages;
    }

    private function evaluateValidationCondition(
        Bedingung|BedingungsGruppe $bedingung,
        FieldValues $values
    ): bool {
        if ($bedingung instanceof BedingungsGruppe) {
            return $this->conditionEvaluator->evaluateGroup(
                $bedingung->bedingungen,
                $bedingung->verknuepfung,
                $values,
            );
        }

        return $this->conditionEvaluator->evaluate(
            new RegelBedingung(
                feld: $bedingung->feld,
                op: $bedingung->op,
                wert: $bedingung->wert,
            ),
            $values,
        );
    }

    private function resolveComponents(DomainConfig $config, FieldValues $values): array
    {
        $activeFreitext = [];
        $activeKomponenten = [];
        $processedIds = [];

        foreach ($config->regelwerk as $gruppe) {
            foreach ($gruppe->regeln as $regel) {
                if ($regel instanceof FreitextRegel && $regel->aktivWenn !== null) {
                    if ($this->conditionEvaluator->evaluate($regel->aktivWenn, $values)) {
                        $activeFreitext[] = $regel;
                    }
                }
            }
        }

        foreach ($config->komponenten as $komp) {
            if ($this->isKomponenteActive($komp, $values)) {
                $this->resolveKomponente($komp, $values, $config, $activeKomponenten, $processedIds);
            }
        }

        return [$activeFreitext, $activeKomponenten];
    }

    private function isKomponenteActive(Komponente $komp, FieldValues $values): bool
    {
        if (empty($komp->aktivierung)) return true;

        foreach ($komp->aktivierung as $regel) {
            if ($this->conditionEvaluator->evaluate($regel, $values)) return true;
        }

        return false;
    }

    private function resolveKomponente(
        Komponente $komp,
        FieldValues $values,
        DomainConfig $config,
        array &$result,
        array &$processedIds,
    ): void {
        if (in_array($komp->id, $processedIds, true)) return;

        $processedIds[] = $komp->id;
        $menge     = (float)($values->get($komp->mengeFeld) ?? 0);
        $artikelNr = $this->resolveVariante($komp, $values);

        $result[] = new ActiveKomponente(komp: $komp, menge: $menge, artikelNr: $artikelNr);

        foreach ($komp->abhaengigkeiten as $abh) {
            $depKomp = $this->findKomponente($config, $abh->komponenteId);
            if ($depKomp !== null) {
                $this->resolveKomponente($depKomp, $values, $config, $result, $processedIds);
            }
        }
    }

    private function resolveVariante(Komponente $komp, FieldValues $values): ?string
    {
        $standard = null;

        foreach ($komp->varianten as $variante) {
            if ($variante->standard === true) {
                $standard = $variante->artikelNr;
            }
            if ($variante->wennFeld !== null) {
                $condition = new RegelBedingung(
                    feld: $variante->wennFeld,
                    op: $variante->op ?? '==',
                    wert: $variante->wert,
                );
                if ($this->conditionEvaluator->evaluate($condition, $values)) {
                    return $variante->artikelNr;
                }
            }
        }

        return $standard;
    }

    private function initializeValues(DomainConfig $config, array $inputs): FieldValues
    {
        $values = [];
        foreach ($config->felder as $field) {
            $values[$field->key] = $inputs[$field->key] ?? $field->standard ?? null;
        }
        return new FieldValues($values);
    }

    private function findKomponente(DomainConfig $config, string $id): ?Komponente
    {
        foreach ($config->komponenten as $komp) {
            if ($komp->id === $id) return $komp;
        }
        return null;
    }
}
```

### 4.5 Topological Sort for Formula Order

```php
// src/Domain/Engine/Service/FormulaOrderAnalyzer.php
final class FormulaOrderAnalyzer
{
    /**
     * Kahn's algorithm — port of validate-fields.ts
     */
    public function sort(array $felder): array
    {
        $formulaKeys   = [];
        $dependencyMap = [];

        foreach ($felder as $field) {
            if ($field->typ !== FeldTyp::Formula || $field->formel === null) continue;
            $formulaKeys[]              = $field->key;
            $dependencyMap[$field->key] = $this->extractDependencies($field->formel, $formulaKeys);
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

        $queue  = array_keys(array_filter($inDegree, fn($d) => $d === 0));
        $sorted = [];

        while (!empty($queue)) {
            $node     = array_shift($queue);
            $sorted[] = $node;
            foreach ($graph[$node] as $neighbour) {
                if (--$inDegree[$neighbour] === 0) {
                    $queue[] = $neighbour;
                }
            }
        }

        // Cyclic fields appended unchanged (same behaviour as TS version)
        $unsorted = array_diff($formulaKeys, $sorted);

        return [...$sorted, ...$unsorted];
    }

    private function extractDependencies(string $formula, array $knownKeys): array
    {
        $deps = [];
        foreach ($knownKeys as $key) {
            if (str_contains($formula, $key)) $deps[] = $key;
        }
        return $deps;
    }
}
```

---

## 5. Application Layer — Use Cases

```php
// src/Application/Engine/RunEngineUseCase.php
final class RunEngineUseCase
{
    public function __construct(
        private readonly DomainRepository       $domainRepository,
        private readonly RulesEngine            $engine,
        private readonly DomainConfigSerializer $serializer,
    ) {}

    public function execute(RunEngineCommand $command): EngineResult
    {
        $domain = $this->domainRepository->findById($command->domainId)
            ?? throw new DomainNotFoundException($command->domainId);

        $config = $this->serializer->deserialize($domain->getConfigJson());

        return $this->engine->run($config, $command->inputs);
    }
}

// src/Application/Domain/CreateDomainUseCase.php
final class CreateDomainUseCase
{
    public function __construct(
        private readonly DomainRepository $repository,
        private readonly IdGenerator      $idGenerator,
    ) {}

    public function execute(CreateDomainCommand $command): Domain
    {
        if ($this->repository->existsBySlug($command->slug)) {
            throw new SlugAlreadyExistsException($command->slug);
        }

        $domain = new Domain(
            id: $this->idGenerator->generate(),
            name: $command->name,
            slug: $command->slug,
        );

        $this->repository->save($domain);

        return $domain;
    }
}
```

---

## 6. API Design

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
POST   /api/v1/domains/{id}/run         ← Execute the rules engine

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

### Engine Endpoint

```
POST /api/v1/domains/{id}/run

Request:
{
  "inputs": {
    "dachflaeche": 48,
    "neigung":     30,
    "ausrichtung": "Süd"
  }
}

Response:
{
  "values": {
    "module_anzahl": 16,
    "systemleistung": 6.4,
    "gesamtpreis_netto": 8240.00
  },
  "firedRules": [
    { "zielFeld": "module_anzahl", "dann": 16, "regelIndex": 2 }
  ],
  "validierungen": [],
  "activeKomponenten": [
    {
      "id": "komp_wechselrichter",
      "name": "Wechselrichter",
      "menge": 1,
      "artikelNr": "WR-6000",
      "preis": 1200.00
    }
  ],
  "activeFreitext": []
}
```

### Security Configuration

```yaml
# config/packages/security.yaml
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

### API Logging Middleware

```php
// src/Infrastructure/EventListener/ApiLogListener.php
final class ApiLogListener implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST  => ['onRequest', 100],
            KernelEvents::RESPONSE => ['onResponse', -100],
        ];
    }

    public function onRequest(RequestEvent $event): void
    {
        if (!str_starts_with($event->getRequest()->getPathInfo(), '/api/v1')) return;
        $event->getRequest()->attributes->set('_start_time', microtime(true));
    }

    public function onResponse(ResponseEvent $event): void
    {
        $request   = $event->getRequest();
        $startTime = $request->attributes->get('_start_time');
        if ($startTime === null) return;

        $this->logger->log(
            method:       $request->getMethod(),
            path:         $request->getPathInfo(),
            statusCode:   $event->getResponse()->getStatusCode(),
            durationMs:   (int)((microtime(true) - $startTime) * 1000),
            ip:           $request->getClientIp(),
            requestBody:  $this->parseBody($request),
            responseBody: $this->parseResponse($event->getResponse()),
        );
    }
}
```

---

## 7. Frontend — Vue.js

### Structure

```
frontend/src/
├── api/
│   ├── client.ts         ← Axios instance with JWT interceptors
│   ├── domains.ts
│   ├── pricelists.ts
│   ├── engine.ts         ← POST /domains/{id}/run
│   └── auth.ts
│
├── engine/               ← Client-side engine (live preview, no server round-trip)
│   ├── types.ts
│   ├── ConditionEvaluator.ts
│   ├── FormulaEvaluator.ts
│   └── RulesEngine.ts    ← Runs in browser for instant configurator feedback
│
├── stores/
│   ├── auth.ts           ← Pinia: JWT, user, rolle
│   ├── domain.ts         ← Pinia: current domain + config
│   └── configurator.ts   ← Pinia: inputs, result, pricelist
│
├── pages/
│   ├── Login.vue
│   ├── Dashboard.vue
│   ├── domains/
│   │   ├── Index.vue
│   │   ├── Editor.vue    ← Tabbed: Fields, Rules, Validations, Components
│   │   └── Simulator.vue
│   ├── pricelists/
│   │   ├── Index.vue
│   │   └── Editor.vue
│   ├── configurator/
│   │   └── [domainId].vue
│   └── admin/
│       ├── Users.vue
│       ├── ApiKeys.vue
│       ├── Logs.vue
│       └── Webhooks.vue
│
└── components/
    ├── engine/
    │   ├── FieldsEditor.vue
    │   ├── RulesEditor.vue
    │   ├── ConditionBuilder.vue
    │   ├── ValidationsEditor.vue
    │   ├── ComponentsEditor.vue
    │   └── FormulaInput.vue
    └── ui/
```

### Key design decision: dual engine

The rules engine runs **in the browser** (TypeScript port) for instant configurator feedback with no network latency. The same engine lives on the PHP server for trusted calculations and webhook payloads. Both must stay in sync.

```typescript
// frontend/src/engine/RulesEngine.ts
// Direct port of src/lib/engine.ts — logic must stay in sync with PHP RulesEngine
export function runEngine(config: DomainConfig, inputs: FieldValues): EngineResult {
    // ... identical logic
}
```

---

## 8. SOLID Principles Applied

| Principle | How it's applied |
|---|---|
| **S** — Single Responsibility | `ConditionEvaluator` only evaluates conditions. `FormulaEvaluator` only handles formulas. `RulesEngine` orchestrates — never evaluates directly. |
| **O** — Open/Closed | New operators = add a `match` arm. New field types = add an `Enum` case. No existing code changes. |
| **L** — Liskov Substitution | `DoctrineDomainRepository` implements `DomainRepository` — swappable for an in-memory fake in tests without breaking anything. |
| **I** — Interface Segregation | `EngineInterface`, `ConditionEvaluatorInterface`, `FormulaEvaluatorInterface` are separate — consumers depend only on what they use. |
| **D** — Dependency Inversion | `RulesEngine` depends on `ConditionEvaluatorInterface`, not the concrete class. Controllers depend on use cases, not repositories. |

---

## 9. Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| PHP | 8.3 | Enums, readonly properties, fibers |
| Framework | Symfony 7 LTS | Long-term support, mature ecosystem |
| ORM | Doctrine 3 | Standard with Symfony, closest to Prisma |
| Auth | LexikJWTAuthBundle | Industry standard for Symfony JWT |
| CORS | NelmioCorsBundle | One config block |
| Rate limiting | symfony/rate-limiter | Built-in, Redis-backed |
| Formula eval | symfony/expression-language | Safe alternative to eval() |
| Database | PostgreSQL 16 | Native JSON columns, best Doctrine support |
| Frontend | Vue 3 + Composition API | Closest to React mental model |
| State | Pinia | Official Vue state manager |
| HTTP client | Axios | Interceptors for JWT refresh |
| Build | Vite | Fast, simple |
| CSS | Tailwind CSS | Carries over 1:1 from current project |
| Testing | PHPUnit + Pest | Unit tests for engine, integration for API |

---

## 10. Phased Roadmap

### Phase 1 — Backend Core (2 weeks)
- [ ] Symfony 7 project setup + Doctrine config + PostgreSQL
- [ ] All Doctrine entities + migrations
- [ ] `RulesEngine`, `ConditionEvaluator`, `FormulaEvaluator` with full unit tests
- [ ] `FormulaOrderAnalyzer` (topological sort) with unit tests
- [ ] JWT authentication + `UserProvider`
- [ ] `ApiKeyAuthenticator`

### Phase 2 — API Routes (1.5 weeks)
- [ ] All internal CRUD routes (domains, pricelists, users, api-keys)
- [ ] `POST /domains/{id}/run` — engine endpoint
- [ ] All external routes
- [ ] API logging middleware
- [ ] Rate limiting (login + external API)
- [ ] Webhook dispatch

### Phase 3 — Vue Frontend (2.5 weeks)
- [ ] Vite + Vue Router + Pinia + Tailwind setup
- [ ] Auth pages (login, JWT management)
- [ ] Domain editor (Fields, Rules, Validations, Components tabs)
- [ ] Client-side engine port (TypeScript)
- [ ] Configurator page
- [ ] Admin pages (users, API keys, logs, webhooks)
- [ ] Pricelist editor

### Phase 4 — Polish (1 week)
- [ ] Integration tests for all API endpoints
- [ ] Data migration from existing DB
- [ ] Docker + Docker Compose setup
- [ ] Deploy

**Total: ~7–8 weeks** at a comfortable pace.

---

## 11. Decisions to Make Before Starting

1. **IDs** — Keep CUID (26-char strings) for API compatibility, or switch to UUID (more native to PHP/Symfony)?
2. **Config versioning** — Add a `version` field to `config_json` so future schema changes can be migrated gracefully.
3. **Monorepo or separate repos** — One repo with `backend/` and `frontend/` folders, or two separate repos?
4. **Webhook delivery** — Synchronous (simple) or via Symfony Messenger queue (more reliable, retryable)?

---

> The rules engine is the soul of this system. Everything else is standard CRUD.
> Start Phase 1 with the engine — get it fully unit-tested in isolation before touching any HTTP layer.
