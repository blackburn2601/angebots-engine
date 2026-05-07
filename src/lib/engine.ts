import type {
  DomainConfig, Datenfeld, RegelGruppe, FreitextRegel,
  Variante, Komponente, PreisItem
} from "@/types/domain";

type FieldValues = Record<string, unknown>;

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
  cond: { feld: string; op: string; wert?: unknown },
  values: FieldValues
): boolean {
  const left = values[cond.feld];
  const right = cond.wert;
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

export interface SimulatorResult {
  values: FieldValues;
  firedRules: Array<{ ziel_feld: string; dann: unknown; regelIndex: number }>;
  activeFreitext: FreitextRegel[];
  activeKomponenten: Array<{ komp: Komponente; menge: number; artikel_nr: string | null }>;
  validierungen: Array<{ typ: "fehler" | "warnung"; meldung: string }>;
}

export function runEngine(
  config: DomainConfig,
  eingaben: FieldValues,
  preisItems: PreisItem[] = []
): SimulatorResult {
  const values: FieldValues = { ...eingaben };
  const firedRules: SimulatorResult["firedRules"] = [];

  // Step 0: validations
  const validierungen: SimulatorResult["validierungen"] = [];
  for (const val of config.validierungen ?? []) {
    let matches = false;
    const bed = val.bedingung;
    if ("regeln" in bed) {
      const results = bed.regeln.map((r) => evaluateCondition({ feld: r.feld ?? "", op: r.op, wert: r.wert }, values));
      matches = bed.verknuepfung === "AND" ? results.every(Boolean) : results.some(Boolean);
    } else {
      const b = bed as { feld?: string; op: string; wert?: unknown };
      matches = evaluateCondition({ feld: b.feld ?? "", op: b.op, wert: b.wert }, values);
    }
    if (matches) {
      validierungen.push({ typ: val.typ, meldung: val.meldung });
    }
  }

  // Step 1: resolve output fields in dependency order (topological)
  const outputFelder = config.felder.filter((f) => f.typ === "output");
  const regelGruppen = (config.regelwerk ?? []).filter(
    (r): r is RegelGruppe => !("typ" in r && r.typ === "freitext")
  );

  // Initialize all outputs to null
  for (const f of outputFelder) {
    values[f.key] = null;
  }

  // Simple multi-pass resolution (handles cascades)
  for (let pass = 0; pass < outputFelder.length + 1; pass++) {
    for (const gruppe of regelGruppen) {
      for (let ri = 0; ri < gruppe.regeln.length; ri++) {
        const regel = gruppe.regeln[ri];
        let matches = true;
        if (regel.bedingungen.length > 0) {
          const vk = regel.verknuepfung ?? "AND";
          const results = regel.bedingungen.map((b) => evaluateCondition(b, values));
          matches = vk === "AND" ? results.every(Boolean) : results.some(Boolean);
        }
        if (matches) {
          values[gruppe.ziel_feld] = regel.dann;
          firedRules.push({ ziel_feld: gruppe.ziel_feld, dann: regel.dann, regelIndex: ri });
          break;
        }
      }
    }
  }

  // Step 2: evaluate formula fields
  for (const f of config.felder.filter((f) => f.typ === "formula")) {
    if (f.formel) {
      values[f.key] = evaluateFormula(f.formel, values);
    }
  }

  // Step 3: active Freitext rules
  const activeFreitext = (config.regelwerk ?? [])
    .filter((r): r is FreitextRegel => "typ" in r && r.typ === "freitext")
    .filter((r) => {
      if (!r.aktiv_wenn) return true;
      return evaluateCondition(r.aktiv_wenn, values);
    });

  // Step 4: resolve active components
  const activeKomponenten: SimulatorResult["activeKomponenten"] = [];

  function isKompActive(komp: Komponente): boolean {
    if (komp.aktivierung.length === 0) return true;
    const groups: { and: boolean[]; or: boolean[] } = { and: [], or: [] };
    for (const regel of komp.aktivierung) {
      const matches = evaluateCondition({ feld: regel.feld, op: regel.op, wert: regel.wert }, values);
      if (regel.verknuepfung === "OR") groups.or.push(matches);
      else groups.and.push(matches);
    }
    const andOk = groups.and.length === 0 || groups.and.every(Boolean);
    const orOk = groups.or.length === 0 || groups.or.some(Boolean);
    return andOk && orOk;
  }

  function resolveVariante(komp: Komponente): string | null {
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

  function activateKomp(komp: Komponente) {
    if (processed.has(komp.id)) return;
    processed.add(komp.id);
    if (!isKompActive(komp)) return;

    const menge = Number(values[komp.menge_feld] ?? 0);
    const artikel_nr = resolveVariante(komp);

    activeKomponenten.push({ komp, menge, artikel_nr });

    for (const dep of komp.abhaengigkeiten) {
      const depKomp = config.komponenten.find((k) => k.id === dep.komponente_id);
      if (depKomp) activateKomp(depKomp);
    }
  }

  for (const komp of config.komponenten ?? []) {
    activateKomp(komp);
  }

  return { values, firedRules, activeFreitext, activeKomponenten, validierungen };
}
