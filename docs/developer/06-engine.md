# The Engine

## What is the Engine?

The **engine** (`src/lib/engine.ts`) is the core business logic of the entire platform. It takes a domain configuration and a set of user input values, then computes:

1. **Output field values** — set by IF/THEN rules
2. **Formula field values** — computed by mathematical expressions
3. **Active components** — product components that are triggered based on field values
4. **Validations** — errors and warnings to display to the user
5. **Freitext hints** — conditional text notes (passed to AI or shown to user)

The engine is a **pure function** — no database access, no side effects:

```typescript
function runEngine(
  config: DomainConfig,
  eingaben: FieldValues,
  preisItems: PreisItem[] = []
): EngineResult
```

This means the same function runs both in the browser (real-time simulator) and on the server (REST API endpoint).

---

## Input and Output Types

### Input: `DomainConfig`

Defined in `src/types/domain.ts`. Parsed from `Domain.config_json`.

```typescript
interface DomainConfig {
  felder: Datenfeld[];          // All field definitions
  parameter: Parameter[];        // Which fields appear as inputs
  validierungen: Validierung[];  // Validation rules
  regelwerk: Regelwerk[];        // IF/THEN rules + freitext hints
  komponenten: Komponente[];     // Product components
}
```

### Input: `FieldValues`

A plain `Record<string, unknown>` — the user's input values, keyed by field `key`.

```typescript
{ laenge: 5, breite: 4, material: "holz" }
```

### Output: `EngineResult`

`runEngine` returns an **`EngineResult`** — a `SimulatorResult` plus a structured `trace`
of everything the engine did (defined in `src/lib/engine.ts`):

```typescript
interface EngineResult extends SimulatorResult {
  trace: EngineTrace;
}

interface SimulatorResult {
  values: FieldValues;                  // All field values (inputs + computed)
  firedRules: Array<{
    ziel_feld: string;
    dann: unknown;
    regelIndex: number;
  }>;
  activeFreitext: FreitextRegel[];
  activeKomponenten: Array<{
    komp: Komponente;
    menge: number;
    artikel_nr: string | null;
  }>;
  validierungen: Array<{
    typ: "fehler" | "warnung";
    meldung: string;
  }>;
}
```

### The execution trace: `EngineTrace`

`trace` records each step the engine took, useful for debugging configurations and for the
in-app simulator's "why did this happen?" view. It mirrors the four engine stages:

```typescript
interface EngineTrace {
  inputs: FieldValues;             // resolved input values
  formulas: TraceFormula[];        // each formula field + evaluated result
  rule_groups: TraceRuleGroup[];   // output-rule groups, their conditions and match outcome
  freitext_rules: TraceFreitext[]; // freitext hints and whether they activated
  validations: TraceValidation[];  // each validation, its condition tree and pass/fail
  components: TraceComponent[];    // component activation, chosen variant, quantity
}
```

The supporting types (`TraceCondition`, `TraceRule`, `TraceRuleGroup`, `TraceFormula`,
`TraceFreitext`, `TraceValidation`, `TraceComponent`) are all exported from `src/lib/engine.ts`.

> **Note:** the result's `trace` is computed in-memory and returned to the caller. There is an
> `EngineLog` table in the schema intended to persist runs, but no code writes to it yet —
> see [04 · Database](./04-database.md).

---

## Field Types

| Type | Description | Engine behavior |
|---|---|---|
| `number` | Numeric input | Passed through as-is from `eingaben` |
| `text` | Text input | Passed through as-is |
| `select` | Dropdown | Passed through as-is |
| `boolean` | True/false toggle | Passed through as-is |
| `formula` | Math expression | Computed by `evaluateFormula()` after rules |
| `output` | Rule-driven result | Set by `RegelGruppe` rules, initialized to `null` |

---

## Engine Execution Order

The engine runs in this exact sequence:

```
1. Copy eingaben → values
2. Initialize all output fields to null in values
3. Multi-pass rule evaluation (resolves cascades)
   └── For each RegelGruppe in regelwerk:
       └── For each Regel in gruppe.regeln:
           └── Evaluate bedingungen (AND or OR)
           └── If matches: set values[ziel_feld] = dann; break
4. Evaluate formula fields
   └── For each field with typ == "formula":
       └── isSafeFormula() check
       └── evaluateFormula() using new Function()
5. Run validations (after formulas so formula results are available)
6. Collect active Freitext rules
7. Activate components (depth-first, deduplication by ID)
```

### Why multi-pass?

Output fields can depend on other output fields (cascading rules). A single pass would miss cases where field A's rule depends on field B, and field B's rule hasn't been evaluated yet.

The engine runs `outputFelder.length + 1` passes. Each pass overwrites the previous value of an output field if a rule matches. This converges correctly for acyclic dependency graphs.

---

## Rule Evaluation

A `RegelGruppe` targets one output field:

```typescript
interface RegelGruppe {
  ziel_feld: string;          // "tarif"
  auswertung: "erste_zutreffende";
  regeln: StrukturierteRegel[];
}
```

Rules are evaluated in order. The **first matching rule wins** (no other rules are evaluated for that group).

A rule with no `bedingungen` is a **fallback** (always matches):

```typescript
{ bedingungen: [], dann: "standard" }
```

### Condition operators

| Operator | Comparison |
|---|---|
| `==` | Equal (type-aware: boolean→boolean, number→number, else string) |
| `!=` | Not equal |
| `<` | Less than (numeric) |
| `<=` | Less than or equal |
| `>` | Greater than |
| `>=` | Greater than or equal |
| `enthält` | String contains |

### AND vs OR linking

`StrukturierteRegel.verknuepfung` controls how multiple conditions in one rule are combined:

- `"AND"` (default): all conditions must match
- `"OR"`: at least one condition must match

---

## Formula Evaluation

Formula fields use a **sandboxed `new Function()`** approach:

```typescript
function evaluateFormula(formel: string, values: FieldValues): number {
  // Convert all values to numbers
  // Create: const fn = new Function("a", "b", "c", "return (a * b + c);")
  // Call: fn(valueA, valueB, valueC)
}
```

### Security: `isSafeFormula()`

Before executing, the formula is validated:

1. All allowed `Math.*` methods (`round, floor, ceil, min, max, abs, pow, sqrt`) are stripped
2. All known field keys are stripped
3. All numbers and arithmetic operators are stripped
4. If anything remains → **unsafe, return 0**

This prevents code injection like `process.exit(1)` or `require('fs')`.

**Allowed formula syntax:**
```
laenge * breite
Math.round(flaeche / 100)
Math.max(a, b) + 10
```

**Blocked (returns 0):**
```
process.exit(1)
require('child_process').exec('rm -rf /')
window.location = 'evil.com'
```

> Note: The guard uses string stripping, not a proper AST. It is pragmatic security for a trusted internal tool, not a publicly-accessible code execution environment.

---

## Component Activation

Components in `DomainConfig.komponenten` represent product BOM (Bill of Materials) entries.

```typescript
interface Komponente {
  id: string;
  name: string;
  menge_feld: string;        // Which field drives the quantity
  aktivierung: AktivierungsRegel[];   // When to include this component
  varianten: Variante[];     // Different article numbers based on conditions
  abhaengigkeiten: Abhaengigkeit[];   // Other components that activate together
  konflikte: Konflikt[];     // Conflict rules (UI enforcement, not engine-enforced)
}
```

### Activation logic

- `aktivierung` is empty → always active
- `aktivierung` has rules → AND-linked rules must all match, OR-linked rules need one match

### Variants

A component can map to different article numbers based on conditions:

```typescript
[
  { wenn_feld: "typ", op: "==", wert: "premium", artikel_nr: "ART-PRE", standard: false },
  { artikel_nr: "ART-STD", standard: true }
]
```

Non-standard variants are checked first, in order. The standard (`standard: true`) variant is the fallback.

### Dependencies

If component A has `abhaengigkeiten: [{ komponente_id: "B" }]`, activating A also activates B (recursive, depth-first, with deduplication via a `Set<string>`).

---

## Using the Engine via API

```http
POST /api/v1/domains/{id}/run
Authorization: Bearer eak_live_...
Content-Type: application/json

{
  "inputs": {
    "laenge": 10,
    "breite": 5,
    "material": "holz"
  },
  "preis_items": [
    {
      "artikel_nr": "ART-001",
      "bezeichnung": "Holzbalken",
      "einheit": "m",
      "ek_preis": 12.50
    }
  ]
}
```

Response:
```json
{
  "data": {
    "values": { "laenge": 10, "breite": 5, "flaeche": 50, "tarif": "standard" },
    "firedRules": [{ "ziel_feld": "tarif", "dann": "standard", "regelIndex": 0 }],
    "activeFreitext": [],
    "activeKomponenten": [...],
    "validierungen": [],
    "trace": { "inputs": {...}, "formulas": [...], "rule_groups": [...], "freitext_rules": [...], "validations": [...], "components": [...] }
  }
}
```
