import type { Datenfeld } from "@/types/domain";

export interface FormulaOrderIssue {
  fieldKey: string;
  dependsOn: string;
  isEngineBreaking: boolean; // false = cosmetic only (input/output fields)
}

function formulaRefs(formel: string, keys: string[]): string[] {
  return keys.filter((k) => k && new RegExp(`\\b${k}\\b`).test(formel));
}

export function detectFormulaOrderIssues(felder: Datenfeld[]): FormulaOrderIssue[] {
  const issues: FormulaOrderIssue[] = [];

  felder.forEach((field, i) => {
    if (field.typ !== "formula" || !field.formel || !field.key) return;

    // All fields that come AFTER this formula in the list
    const later = felder.slice(i + 1).filter((f) => f.key);
    const laterKeys = later.map((f) => f.key);

    for (const refKey of formulaRefs(field.formel, laterKeys)) {
      const refField = later.find((f) => f.key === refKey);
      // Only formula→formula is actually engine-breaking (inputs are pre-loaded)
      const isEngineBreaking = refField?.typ === "formula";
      issues.push({ fieldKey: field.key, dependsOn: refKey, isEngineBreaking });
    }
  });

  return issues;
}

export function fixFormulaOrder(felder: Datenfeld[]): Datenfeld[] {
  // Full topological sort over ALL fields based on formula dependencies.
  // Input/output fields have no formula deps → go first (stable original order).
  // Formula fields go after all fields they reference.
  const withKey = felder.filter((f) => f.key);
  const noKey = felder.filter((f) => !f.key);

  const allKeys = withKey.map((f) => f.key);
  const keyToField = new Map(withKey.map((f) => [f.key, f]));
  const inDegree = new Map<string, number>(allKeys.map((k) => [k, 0]));
  const dependents = new Map<string, string[]>(allKeys.map((k) => [k, []]));

  for (const field of withKey) {
    if (field.typ !== "formula" || !field.formel) continue;
    for (const dep of formulaRefs(field.formel, allKeys.filter((k) => k !== field.key))) {
      inDegree.set(field.key, (inDegree.get(field.key) ?? 0) + 1);
      dependents.get(dep)!.push(field.key);
    }
  }

  // Kahn's algorithm — queue preserves original insertion order within same level
  const queue = allKeys.filter((k) => inDegree.get(k) === 0);
  const result: Datenfeld[] = [];

  while (queue.length > 0) {
    const key = queue.shift()!;
    const field = keyToField.get(key);
    if (field) result.push(field);
    for (const dep of dependents.get(key) ?? []) {
      const deg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, deg);
      if (deg === 0) queue.push(dep);
    }
  }

  // Cyclic deps: append remaining fields unchanged
  for (const field of withKey) {
    if (!result.find((f) => f.key === field.key)) result.push(field);
  }

  return [...result, ...noKey];
}
