import type {
  DomainConfig, RegelGruppe, FreitextRegel,
  Variante, Komponente, PreisItem
} from "@/types/domain";

type FieldValues = Record<string, unknown>;

// ── Trace types ────────────────────────────────────────────────────────────

export interface TraceCondition {
  field: string;
  op: string;
  value: unknown;
  passed: boolean;
}

export interface TraceRule {
  index: number;
  logic: "AND" | "OR";
  conditions: TraceCondition[];
  passed: boolean;
  fired: boolean;
  result?: unknown;
}

export interface TraceRuleGroup {
  target_field: string;
  target_label: string;
  rules: TraceRule[];
  fired_index: number | null;
  result: unknown;
  used_fallback: boolean;
}

export interface TraceFormula {
  field: string;
  label: string;
  formula: string;
  result: unknown;
}

export interface TraceFreitext {
  text: string;
  triggered: boolean;
}

export interface TraceValidation {
  message: string;
  type: "fehler" | "warnung";
  triggered: boolean;
}

export interface TraceComponent {
  id: string;
  label: string;
  active: boolean;
  activation_checks: TraceCondition[];
  selected_variant: string | null;
  quantity: number;
}

export interface EngineTrace {
  inputs: FieldValues;
  formulas: TraceFormula[];
  rule_groups: TraceRuleGroup[];
  freitext_rules: TraceFreitext[];
  validations: TraceValidation[];
  components: TraceComponent[];
}

// ── Internals ───────────────────────────────────────────────────────────────

function isSafeFormula(formel: string, allowedKeys: string[]): boolean {
  let s = formel;
  s = s.replace(/\bMath\.(round|floor|ceil|min|max|abs|pow|sqrt)\b/g, "");
  for (const key of allowedKeys) {
    s = s.replace(new RegExp(`\\b${key}\\b`, "g"), "");
  }
  s = s.replace(/\b\d+(\.\d+)?\b/g, "");
  s = s.replace(/[\s+\-*/().,]/g, "");
  return s.length === 0;
}

function evaluateFormula(formel: string, values: FieldValues): number {
  const numericValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    numericValues[k] = typeof v === "number" ? v : Number(v) || 0;
  }
  const keys = Object.keys(numericValues);

  if (!isSafeFormula(formel, keys)) return 0;

  try {
    const vals = keys.map((k) => numericValues[k]);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `"use strict"; return (${formel});`);
    const result = fn(...vals);
    return typeof result === "number" && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function evaluateCondition(
  cond: { feld: string; op: string; wert?: unknown; vergleich_feld?: string },
  values: FieldValues
): boolean {
  const left = values[cond.feld];
  const right = cond.vergleich_feld !== undefined ? values[cond.vergleich_feld] : cond.wert;
  switch (cond.op) {
    case "==":
    case "!=": {
      if (right === null || right === undefined) return false;
      let l: unknown, r: unknown;
      if (typeof right === "boolean") { l = Boolean(left); r = right; }
      else if (typeof right === "number") { l = Number(left); r = right; }
      else { l = String(left ?? ""); r = String(right); }
      return cond.op === "==" ? l === r : l !== r;
    }
    case "<": return Number(left) < Number(right);
    case "<=": return Number(left) <= Number(right);
    case ">": return Number(left) > Number(right);
    case ">=": return Number(left) >= Number(right);
    case "enthält": return String(left).includes(String(right));
    default: return false;
  }
}

// ── Public result types ─────────────────────────────────────────────────────

export interface SimulatorResult {
  values: FieldValues;
  firedRules: Array<{ ziel_feld: string; dann: unknown; regelIndex: number }>;
  activeFreitext: FreitextRegel[];
  activeKomponenten: Array<{ komp: Komponente; menge: number; artikel_nr: string | null }>;
  validierungen: Array<{ typ: "fehler" | "warnung"; meldung: string }>;
}

export interface EngineResult extends SimulatorResult {
  trace: EngineTrace;
}

// ── Engine ──────────────────────────────────────────────────────────────────

export function runEngine(
  config: DomainConfig,
  eingaben: FieldValues,
  preisItems: PreisItem[] = []
): EngineResult {
  const values: FieldValues = { ...eingaben };
  const firedRules: SimulatorResult["firedRules"] = [];

  const trace: EngineTrace = {
    inputs: { ...eingaben },
    formulas: [],
    rule_groups: [],
    freitext_rules: [],
    validations: [],
    components: [],
  };

  // ── Step 1: resolve output fields via rule groups ─────────────────────────
  const outputFields = config.felder.filter((f) => f.typ === "output");
  const ruleGroups = (config.regelwerk ?? []).filter(
    (r): r is RegelGruppe => !("typ" in r && r.typ === "freitext")
  );

  for (const f of outputFields) values[f.key] = null;

  for (let pass = 0; pass < outputFields.length + 1; pass++) {
    for (const group of ruleGroups) {
      const targetLabel = config.felder.find((f) => f.key === group.ziel_feld)?.label ?? group.ziel_feld;
      const traceGroup: TraceRuleGroup = {
        target_field: group.ziel_feld,
        target_label: targetLabel,
        rules: [],
        fired_index: null,
        result: null,
        used_fallback: false,
      };

      let groupFired = false;
      for (let ri = 0; ri < group.regeln.length; ri++) {
        const rule = group.regeln[ri];
        const isFallback = rule.bedingungen.length === 0;
        const logic = (rule.verknuepfung ?? "AND") as "AND" | "OR";

        const conditionResults: TraceCondition[] = rule.bedingungen.map((b) => ({
          field: b.feld,
          op: b.op,
          value: b.vergleich_feld !== undefined ? `[field: ${b.vergleich_feld}]` : b.wert,
          passed: evaluateCondition(b, values),
        }));

        let matched: boolean;
        if (isFallback) {
          matched = true;
        } else {
          const results = conditionResults.map((c) => c.passed);
          matched = logic === "AND" ? results.every(Boolean) : results.some(Boolean);
        }

        const fired = matched && !groupFired;

        traceGroup.rules.push({
          index: ri,
          logic,
          conditions: conditionResults,
          passed: matched,
          fired,
          result: fired ? rule.dann : undefined,
        });

        if (fired) {
          values[group.ziel_feld] = rule.dann;
          firedRules.push({ ziel_feld: group.ziel_feld, dann: rule.dann, regelIndex: ri });
          traceGroup.fired_index = ri;
          traceGroup.result = rule.dann;
          traceGroup.used_fallback = isFallback;
          groupFired = true;
          break;
        }
      }

      if (pass === 0) trace.rule_groups.push(traceGroup);
      else {
        // Update result on subsequent passes (cascade resolution)
        const existing = trace.rule_groups.find((g) => g.target_field === group.ziel_feld);
        if (existing) {
          existing.fired_index = traceGroup.fired_index;
          existing.result = traceGroup.result;
          existing.used_fallback = traceGroup.used_fallback;
          existing.rules = traceGroup.rules;
        }
      }
    }
  }

  // ── Step 2: formula fields ────────────────────────────────────────────────
  for (const f of config.felder.filter((f) => f.typ === "formula")) {
    if (f.formel) {
      const result = evaluateFormula(f.formel, values);
      values[f.key] = result;
      trace.formulas.push({ field: f.key, label: f.label, formula: f.formel, result });
    }
  }

  // ── Step 3: validations ───────────────────────────────────────────────────
  const validierungen: SimulatorResult["validierungen"] = [];
  for (const val of config.validierungen ?? []) {
    let triggered = false;
    const bed = val.bedingung;
    if ("regeln" in bed) {
      const results = bed.regeln.map((r) =>
        evaluateCondition({ feld: r.feld ?? "", op: r.op, wert: r.wert, vergleich_feld: r.vergleich_feld }, values)
      );
      triggered = bed.verknuepfung === "AND" ? results.every(Boolean) : results.some(Boolean);
    } else {
      const b = bed as { feld?: string; op: string; wert?: unknown; vergleich_feld?: string };
      triggered = evaluateCondition({ feld: b.feld ?? "", op: b.op, wert: b.wert, vergleich_feld: b.vergleich_feld }, values);
    }
    if (triggered) validierungen.push({ typ: val.typ, meldung: val.meldung });
    trace.validations.push({ message: val.meldung, type: val.typ, triggered });
  }

  // ── Step 4: freitext rules ────────────────────────────────────────────────
  const activeFreitext = (config.regelwerk ?? [])
    .filter((r): r is FreitextRegel => "typ" in r && r.typ === "freitext")
    .filter((r) => {
      const triggered = !r.aktiv_wenn || evaluateCondition(r.aktiv_wenn, values);
      trace.freitext_rules.push({ text: r.text, triggered });
      return triggered;
    });

  // ── Step 5: components ────────────────────────────────────────────────────
  const activeKomponenten: SimulatorResult["activeKomponenten"] = [];

  function isComponentActive(komp: Komponente): { active: boolean; checks: TraceCondition[] } {
    if (komp.aktivierung.length === 0) return { active: true, checks: [] };
    const groups: { and: boolean[]; or: boolean[] } = { and: [], or: [] };
    const checks: TraceCondition[] = [];
    for (const regel of komp.aktivierung) {
      const passed = evaluateCondition({ feld: regel.feld, op: regel.op, wert: regel.wert }, values);
      checks.push({ field: regel.feld, op: regel.op, value: regel.wert, passed });
      if (regel.verknuepfung === "OR") groups.or.push(passed);
      else groups.and.push(passed);
    }
    const andOk = groups.and.length === 0 || groups.and.every(Boolean);
    const orOk = groups.or.length === 0 || groups.or.some(Boolean);
    return { active: andOk && orOk, checks };
  }

  function resolveVariant(komp: Komponente): string | null {
    for (const v of komp.varianten) {
      if (v.standard) continue;
      if (v.wenn_feld && v.op) {
        const matches = evaluateCondition({ feld: v.wenn_feld, op: v.op, wert: v.wert }, values);
        if (matches) return v.artikel_nr;
      }
    }
    const std = komp.varianten.find((v: Variante) => v.standard);
    return std?.artikel_nr ?? null;
  }

  const processed = new Set<string>();

  function activateComponent(komp: Komponente) {
    if (processed.has(komp.id)) return;
    processed.add(komp.id);

    const { active, checks } = isComponentActive(komp);
    const quantity = Number(values[komp.menge_feld] ?? 0);
    const selectedVariant = resolveVariant(komp);

    trace.components.push({
      id: komp.id,
      label: komp.label,
      active,
      activation_checks: checks,
      selected_variant: active ? selectedVariant : null,
      quantity: active ? quantity : 0,
    });

    if (!active) return;

    activeKomponenten.push({ komp, menge: quantity, artikel_nr: selectedVariant });

    for (const dep of komp.abhaengigkeiten) {
      const depKomp = config.komponenten.find((k) => k.id === dep.komponente_id);
      if (depKomp) activateComponent(depKomp);
    }
  }

  for (const komp of config.komponenten ?? []) {
    activateComponent(komp);
  }

  return { values, firedRules, activeFreitext, activeKomponenten, validierungen, trace };
}
