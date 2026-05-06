import type { Datenfeld } from "@/types/domain";

export interface FormulaOrderIssue {
  fieldKey: string;
  dependsOn: string;
}

function formulaRefs(formel: string, keys: string[]): string[] {
  return keys.filter((k) => k && new RegExp(`\\b${k}\\b`).test(formel));
}

export function detectFormulaOrderIssues(felder: Datenfeld[]): FormulaOrderIssue[] {
  const formulaFields = felder.filter((f) => f.typ === "formula");
  const issues: FormulaOrderIssue[] = [];

  for (let i = 0; i < formulaFields.length; i++) {
    const field = formulaFields[i];
    if (!field.formel || !field.key) continue;
    const laterKeys = formulaFields.slice(i + 1).map((f) => f.key);
    for (const key of formulaRefs(field.formel, laterKeys)) {
      issues.push({ fieldKey: field.key, dependsOn: key });
    }
  }

  return issues;
}

export function fixFormulaOrder(felder: Datenfeld[]): Datenfeld[] {
  const formulaIndices: number[] = [];
  const formulaFields: Datenfeld[] = [];

  felder.forEach((f, i) => {
    if (f.typ === "formula") {
      formulaIndices.push(i);
      formulaFields.push(f);
    }
  });

  const sorted = topoSort(formulaFields);
  const result = [...felder];
  formulaIndices.forEach((origIdx, pos) => {
    result[origIdx] = sorted[pos];
  });

  return result;
}

function topoSort(fields: Datenfeld[]): Datenfeld[] {
  const keys = fields.map((f) => f.key).filter(Boolean);
  const keyToField = new Map(fields.map((f) => [f.key, f]));
  const inDegree = new Map<string, number>(keys.map((k) => [k, 0]));
  const dependents = new Map<string, string[]>(keys.map((k) => [k, []]));

  for (const field of fields) {
    if (!field.formel || !field.key) continue;
    for (const dep of formulaRefs(field.formel, keys.filter((k) => k !== field.key))) {
      inDegree.set(field.key, (inDegree.get(field.key) ?? 0) + 1);
      dependents.get(dep)!.push(field.key);
    }
  }

  const queue = keys.filter((k) => inDegree.get(k) === 0);
  const result: Datenfeld[] = [];

  while (queue.length > 0) {
    const key = queue.shift()!;
    result.push(keyToField.get(key)!);
    for (const dep of dependents.get(key) ?? []) {
      const deg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, deg);
      if (deg === 0) queue.push(dep);
    }
  }

  // Append remaining (cyclic or empty-key) fields unchanged
  for (const field of fields) {
    if (!result.find((f) => f.key === field.key)) result.push(field);
  }

  return result;
}
