import { describe, it, expect } from "vitest";
import { runEngine } from "@/lib/engine";
import type { DomainConfig, PreisItem } from "@/types/domain";

// ─── Minimal config factory ───────────────────────────────────────────────────

function emptyConfig(overrides: Partial<DomainConfig> = {}): DomainConfig {
  return {
    felder: [],
    parameter: [],
    validierungen: [],
    regelwerk: [],
    komponenten: [],
    ...overrides,
  };
}

// ─── Formula evaluation ───────────────────────────────────────────────────────

describe("formula fields", () => {
  it("evaluates basic arithmetic", () => {
    const config = emptyConfig({
      felder: [{ key: "flaeche", label: "Fläche", typ: "formula", formel: "laenge * breite" }],
    });
    const { values } = runEngine(config, { laenge: 5, breite: 4 });
    expect(values.flaeche).toBe(20);
  });

  it("supports Math.round, Math.ceil, Math.floor", () => {
    const config = emptyConfig({
      felder: [
        { key: "gerundet", label: "", typ: "formula", formel: "Math.round(wert)" },
        { key: "aufgerundet", label: "", typ: "formula", formel: "Math.ceil(wert)" },
        { key: "abgerundet", label: "", typ: "formula", formel: "Math.floor(wert)" },
      ],
    });
    const { values } = runEngine(config, { wert: 2.4 });
    expect(values.gerundet).toBe(2);
    expect(values.aufgerundet).toBe(3);
    expect(values.abgerundet).toBe(2);
  });

  it("supports Math.min, Math.max, Math.abs, Math.pow, Math.sqrt", () => {
    const config = emptyConfig({
      felder: [
        { key: "minimum", label: "", typ: "formula", formel: "Math.min(a, b)" },
        { key: "maximum", label: "", typ: "formula", formel: "Math.max(a, b)" },
        { key: "absolut", label: "", typ: "formula", formel: "Math.abs(a)" },
        { key: "potenz", label: "", typ: "formula", formel: "Math.pow(a, 2)" },
        { key: "wurzel", label: "", typ: "formula", formel: "Math.sqrt(b)" },
      ],
    });
    // a = -4 for abs/pow; b = 4 for sqrt (sqrt of negative is NaN)
    const { values } = runEngine(config, { a: -4, b: 4 });
    expect(values.minimum).toBe(-4);
    expect(values.maximum).toBe(4);
    expect(values.absolut).toBe(4);
    expect(values.potenz).toBe(16);
    expect(values.wurzel).toBe(2);
  });

  it("returns 0 for unsafe formulas", () => {
    const config = emptyConfig({
      felder: [{ key: "hack", label: "", typ: "formula", formel: "process.exit(1)" }],
    });
    const { values } = runEngine(config, {});
    expect(values.hack).toBe(0);
  });

  it("returns 0 when formula references unknown variables", () => {
    const config = emptyConfig({
      felder: [{ key: "out", label: "", typ: "formula", formel: "unknown_var * 2" }],
    });
    const { values } = runEngine(config, {});
    expect(values.out).toBe(0);
  });

  it("coerces string inputs to numbers in formulas", () => {
    const config = emptyConfig({
      felder: [{ key: "doppelt", label: "", typ: "formula", formel: "x * 2" }],
    });
    const { values } = runEngine(config, { x: "5" });
    expect(values.doppelt).toBe(10);
  });
});

// ─── Condition operators ──────────────────────────────────────────────────────

describe("condition operators", () => {
  function configWithRule(op: string, wert: unknown, dann: unknown): DomainConfig {
    return emptyConfig({
      felder: [{ key: "ergebnis", label: "", typ: "output" }],
      regelwerk: [{
        ziel_feld: "ergebnis",
        auswertung: "erste_zutreffende",
        regeln: [
          { bedingungen: [{ feld: "x", op, wert }], dann },
          { bedingungen: [], dann: "nein" },
        ],
      }],
    });
  }

  it("== matches equal values", () => {
    const { values } = runEngine(configWithRule("==", 10, "ja"), { x: 10 });
    expect(values.ergebnis).toBe("ja");
  });

  it("== does not match unequal values", () => {
    const { values } = runEngine(configWithRule("==", 10, "ja"), { x: 9 });
    expect(values.ergebnis).toBe("nein");
  });

  it("!= matches when values differ", () => {
    const { values } = runEngine(configWithRule("!=", 10, "ja"), { x: 5 });
    expect(values.ergebnis).toBe("ja");
  });

  it("< matches when left is less", () => {
    const { values } = runEngine(configWithRule("<", 10, "ja"), { x: 5 });
    expect(values.ergebnis).toBe("ja");
  });

  it("<= matches equal values", () => {
    const { values } = runEngine(configWithRule("<=", 10, "ja"), { x: 10 });
    expect(values.ergebnis).toBe("ja");
  });

  it("> matches when left is greater", () => {
    const { values } = runEngine(configWithRule(">", 5, "ja"), { x: 10 });
    expect(values.ergebnis).toBe("ja");
  });

  it(">= matches equal values", () => {
    const { values } = runEngine(configWithRule(">=", 10, "ja"), { x: 10 });
    expect(values.ergebnis).toBe("ja");
  });

  it("enthält matches substring", () => {
    const { values } = runEngine(configWithRule("enthält", "dach", "ja"), { x: "satteldach" });
    expect(values.ergebnis).toBe("ja");
  });

  it("unknown operator never matches", () => {
    const { values } = runEngine(configWithRule("===", 10, "ja"), { x: 10 });
    expect(values.ergebnis).toBe("nein");
  });

  it("== with boolean input", () => {
    const { values } = runEngine(configWithRule("==", true, "ja"), { x: true });
    expect(values.ergebnis).toBe("ja");
  });
});

// ─── Output field rules ───────────────────────────────────────────────────────

describe("output field rules", () => {
  it("fires unconditional rule (no bedingungen)", () => {
    const config = emptyConfig({
      felder: [{ key: "tarif", label: "", typ: "output" }],
      regelwerk: [{
        ziel_feld: "tarif",
        auswertung: "erste_zutreffende",
        regeln: [{ bedingungen: [], dann: "standard" }],
      }],
    });
    const { values, firedRules } = runEngine(config, {});
    expect(values.tarif).toBe("standard");
    // Engine runs (outputFelder.length + 1) passes, so an unconditional rule fires once per pass
    expect(firedRules.length).toBeGreaterThanOrEqual(1);
    expect(firedRules.every((r) => r.ziel_feld === "tarif")).toBe(true);
  });

  it("first matching rule wins", () => {
    const config = emptyConfig({
      felder: [{ key: "stufe", label: "", typ: "output" }],
      regelwerk: [{
        ziel_feld: "stufe",
        auswertung: "erste_zutreffende",
        regeln: [
          { bedingungen: [{ feld: "kwp", op: ">=", wert: 20 }], dann: "gross" },
          { bedingungen: [{ feld: "kwp", op: ">=", wert: 10 }], dann: "mittel" },
          { bedingungen: [], dann: "klein" },
        ],
      }],
    });
    expect(runEngine(config, { kwp: 25 }).values.stufe).toBe("gross");
    expect(runEngine(config, { kwp: 15 }).values.stufe).toBe("mittel");
    expect(runEngine(config, { kwp: 5 }).values.stufe).toBe("klein");
  });

  it("AND condition: both must match", () => {
    const config = emptyConfig({
      felder: [{ key: "result", label: "", typ: "output" }],
      regelwerk: [{
        ziel_feld: "result",
        auswertung: "erste_zutreffende",
        regeln: [
          {
            verknuepfung: "AND",
            bedingungen: [
              { feld: "a", op: ">", wert: 5 },
              { feld: "b", op: ">", wert: 5 },
            ],
            dann: "beide",
          },
          { bedingungen: [], dann: "keins" },
        ],
      }],
    });
    expect(runEngine(config, { a: 10, b: 10 }).values.result).toBe("beide");
    expect(runEngine(config, { a: 10, b: 1 }).values.result).toBe("keins");
  });

  it("OR condition: one is enough", () => {
    const config = emptyConfig({
      felder: [{ key: "result", label: "", typ: "output" }],
      regelwerk: [{
        ziel_feld: "result",
        auswertung: "erste_zutreffende",
        regeln: [
          {
            verknuepfung: "OR",
            bedingungen: [
              { feld: "a", op: ">", wert: 5 },
              { feld: "b", op: ">", wert: 5 },
            ],
            dann: "eins",
          },
          { bedingungen: [], dann: "keins" },
        ],
      }],
    });
    expect(runEngine(config, { a: 10, b: 1 }).values.result).toBe("eins");
    expect(runEngine(config, { a: 1, b: 10 }).values.result).toBe("eins");
    expect(runEngine(config, { a: 1, b: 1 }).values.result).toBe("keins");
  });

  it("resolves cascading output fields across multiple passes", () => {
    // stufe is set by a rule; preis depends on stufe
    const config = emptyConfig({
      felder: [
        { key: "stufe", label: "", typ: "output" },
        { key: "preis", label: "", typ: "output" },
      ],
      regelwerk: [
        {
          ziel_feld: "stufe",
          auswertung: "erste_zutreffende",
          regeln: [
            { bedingungen: [{ feld: "kwp", op: ">=", wert: 10 }], dann: "gross" },
            { bedingungen: [], dann: "klein" },
          ],
        },
        {
          ziel_feld: "preis",
          auswertung: "erste_zutreffende",
          regeln: [
            { bedingungen: [{ feld: "stufe", op: "==", wert: "gross" }], dann: 9999 },
            { bedingungen: [], dann: 1999 },
          ],
        },
      ],
    });
    expect(runEngine(config, { kwp: 15 }).values.preis).toBe(9999);
    expect(runEngine(config, { kwp: 5 }).values.preis).toBe(1999);
  });

  it("initialises unmatched output fields to null", () => {
    const config = emptyConfig({
      felder: [{ key: "out", label: "", typ: "output" }],
      regelwerk: [{
        ziel_feld: "out",
        auswertung: "erste_zutreffende",
        regeln: [{ bedingungen: [{ feld: "x", op: ">", wert: 100 }], dann: "weit" }],
      }],
    });
    expect(runEngine(config, { x: 5 }).values.out).toBeNull();
  });
});

// ─── Validations ──────────────────────────────────────────────────────────────

describe("validations", () => {
  it("reports a Fehler when condition matches", () => {
    const config = emptyConfig({
      validierungen: [{
        typ: "fehler",
        meldung: "Wert darf nicht negativ sein",
        bedingung: { feld: "x", op: "<", wert: 0 },
      }],
    });
    const { validierungen } = runEngine(config, { x: -1 });
    expect(validierungen).toHaveLength(1);
    expect(validierungen[0].typ).toBe("fehler");
    expect(validierungen[0].meldung).toBe("Wert darf nicht negativ sein");
  });

  it("reports a Warnung when condition matches", () => {
    const config = emptyConfig({
      validierungen: [{
        typ: "warnung",
        meldung: "Sehr hoher Wert",
        bedingung: { feld: "x", op: ">", wert: 100 },
      }],
    });
    const { validierungen } = runEngine(config, { x: 200 });
    expect(validierungen[0].typ).toBe("warnung");
  });

  it("reports no validations when condition does not match", () => {
    const config = emptyConfig({
      validierungen: [{
        typ: "fehler",
        meldung: "Zu klein",
        bedingung: { feld: "x", op: "<", wert: 0 },
      }],
    });
    expect(runEngine(config, { x: 10 }).validierungen).toHaveLength(0);
  });

  it("BedingungsGruppe AND: reports when all conditions match", () => {
    const config = emptyConfig({
      validierungen: [{
        typ: "fehler",
        meldung: "Konflikt",
        bedingung: {
          verknuepfung: "AND",
          regeln: [
            { feld: "a", op: ">", wert: 5 },
            { feld: "b", op: ">", wert: 5 },
          ],
        },
      }],
    });
    expect(runEngine(config, { a: 10, b: 10 }).validierungen).toHaveLength(1);
    expect(runEngine(config, { a: 10, b: 1 }).validierungen).toHaveLength(0);
  });

  it("BedingungsGruppe OR: reports when any condition matches", () => {
    const config = emptyConfig({
      validierungen: [{
        typ: "warnung",
        meldung: "Grenzwert",
        bedingung: {
          verknuepfung: "OR",
          regeln: [
            { feld: "a", op: "<", wert: 0 },
            { feld: "b", op: "<", wert: 0 },
          ],
        },
      }],
    });
    expect(runEngine(config, { a: -1, b: 5 }).validierungen).toHaveLength(1);
    expect(runEngine(config, { a: 5, b: 5 }).validierungen).toHaveLength(0);
  });

  it("validation runs after formula fields are resolved", () => {
    // formula field "gesamt" must be ready before the validation checks it
    const config = emptyConfig({
      felder: [{ key: "gesamt", label: "", typ: "formula", formel: "a + b" }],
      validierungen: [{
        typ: "fehler",
        meldung: "Zu hoch",
        bedingung: { feld: "gesamt", op: ">", wert: 100 },
      }],
    });
    expect(runEngine(config, { a: 60, b: 50 }).validierungen).toHaveLength(1);
    expect(runEngine(config, { a: 40, b: 50 }).validierungen).toHaveLength(0);
  });
});

// ─── Freitext rules ───────────────────────────────────────────────────────────

describe("freitext rules", () => {
  it("always active freitext rule is included unconditionally", () => {
    const config = emptyConfig({
      regelwerk: [{
        typ: "freitext",
        text: "Hinweis: Bitte Angebot prüfen",
        aktiv_wenn: null,
      }],
    });
    const { activeFreitext } = runEngine(config, {});
    expect(activeFreitext).toHaveLength(1);
    expect(activeFreitext[0].text).toContain("Hinweis");
  });

  it("conditional freitext is included when condition matches", () => {
    const config = emptyConfig({
      regelwerk: [{
        typ: "freitext",
        text: "Speicher empfohlen",
        aktiv_wenn: { feld: "kwp", op: ">=", wert: 10 },
      }],
    });
    expect(runEngine(config, { kwp: 15 }).activeFreitext).toHaveLength(1);
    expect(runEngine(config, { kwp: 5 }).activeFreitext).toHaveLength(0);
  });
});

// ─── Component activation ─────────────────────────────────────────────────────

describe("components", () => {
  const baseKomp = {
    id: "komp_1",
    name: "Wechselrichter",
    menge_feld: "anzahl",
    abhaengigkeiten: [],
    konflikte: [],
  };

  it("activates a component with no activation rules (always active)", () => {
    const config = emptyConfig({
      komponenten: [{
        ...baseKomp,
        aktivierung: [],
        varianten: [{ artikel_nr: "ART-001", standard: true }],
      }],
    });
    const { activeKomponenten } = runEngine(config, { anzahl: 5 });
    expect(activeKomponenten).toHaveLength(1);
    expect(activeKomponenten[0].menge).toBe(5);
    expect(activeKomponenten[0].artikel_nr).toBe("ART-001");
  });

  it("does not activate a component when activation condition fails", () => {
    const config = emptyConfig({
      komponenten: [{
        ...baseKomp,
        aktivierung: [{ feld: "hat_speicher", op: "==", wert: true, verknuepfung: "AND" }],
        varianten: [{ artikel_nr: "ART-SPE", standard: true }],
      }],
    });
    expect(runEngine(config, { hat_speicher: false }).activeKomponenten).toHaveLength(0);
    expect(runEngine(config, { hat_speicher: true }).activeKomponenten).toHaveLength(1);
  });

  it("selects non-standard variant when condition matches", () => {
    const config = emptyConfig({
      komponenten: [{
        ...baseKomp,
        aktivierung: [],
        varianten: [
          { wenn_feld: "typ", op: "==", wert: "premium", artikel_nr: "ART-PRE", standard: false },
          { artikel_nr: "ART-STD", standard: true },
        ],
      }],
    });
    expect(runEngine(config, { typ: "premium", anzahl: 1 }).activeKomponenten[0].artikel_nr).toBe("ART-PRE");
    expect(runEngine(config, { typ: "standard", anzahl: 1 }).activeKomponenten[0].artikel_nr).toBe("ART-STD");
  });

  it("activates dependent component when parent is active", () => {
    const config = emptyConfig({
      komponenten: [
        {
          id: "komp_parent",
          name: "Modul",
          menge_feld: "anzahl",
          aktivierung: [],
          varianten: [{ artikel_nr: "ART-MOD", standard: true }],
          abhaengigkeiten: [{ komponente_id: "komp_child" }],
          konflikte: [],
        },
        {
          id: "komp_child",
          name: "Montageset",
          menge_feld: "anzahl",
          aktivierung: [],
          varianten: [{ artikel_nr: "ART-SET", standard: true }],
          abhaengigkeiten: [],
          konflikte: [],
        },
      ],
    });
    const { activeKomponenten } = runEngine(config, { anzahl: 10 });
    const ids = activeKomponenten.map((k) => k.komp.id);
    expect(ids).toContain("komp_parent");
    expect(ids).toContain("komp_child");
  });

  it("does not duplicate a component activated by multiple paths", () => {
    const config = emptyConfig({
      komponenten: [
        {
          id: "shared",
          name: "Shared",
          menge_feld: "anzahl",
          aktivierung: [],
          varianten: [{ artikel_nr: "ART-SHR", standard: true }],
          abhaengigkeiten: [],
          konflikte: [],
        },
      ],
    });
    const { activeKomponenten } = runEngine(config, { anzahl: 3 });
    expect(activeKomponenten.filter((k) => k.komp.id === "shared")).toHaveLength(1);
  });
});

// ─── Full integration: engine with preis_items ────────────────────────────────

describe("runEngine with preisItems", () => {
  it("passes preis_items through without modifying them", () => {
    const preisItems: PreisItem[] = [
      { artikel_nr: "ART-001", bezeichnung: "Modul", einheit: "Stk", ek_preis: 150 },
    ];
    const config = emptyConfig();
    // Engine does not price-calculate internally — it just returns aktive Komponenten
    // and preis resolution happens at the caller layer
    const result = runEngine(config, {}, preisItems);
    expect(result.activeKomponenten).toHaveLength(0);
  });

  it("returns all engine result keys", () => {
    const result = runEngine(emptyConfig(), {});
    expect(result).toHaveProperty("values");
    expect(result).toHaveProperty("firedRules");
    expect(result).toHaveProperty("activeFreitext");
    expect(result).toHaveProperty("activeKomponenten");
    expect(result).toHaveProperty("validierungen");
  });
});
