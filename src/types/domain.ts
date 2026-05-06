export type FeldTyp = "number" | "text" | "select" | "boolean" | "formula" | "output";

export interface StandardRegel {
  wenn?: { feld: string; op: string; wert: unknown };
  fallback?: unknown;
  dann?: unknown;
}

export interface SichtbarWenn {
  feld: string;
  op: string;
  wert: unknown;
}

export interface Datenfeld {
  key: string;
  label: string;
  typ: FeldTyp;
  einheit?: string;
  min?: number;
  max?: number;
  optionen?: string[];
  formel?: string;
  standard?: unknown;
  standard_regeln?: StandardRegel[];
  sichtbar_wenn?: SichtbarWenn | null;
  pflicht?: boolean;
}

export interface Parameter {
  feld: string;
}

export interface Bedingung {
  feld?: string;
  op: string;
  wert?: unknown;
  vergleich_feld?: string;
}

export interface BedingungsGruppe {
  verknuepfung: "AND" | "OR";
  regeln: Bedingung[];
}

export interface Validierung {
  typ: "fehler" | "warnung";
  bedingung: Bedingung | BedingungsGruppe;
  meldung: string;
}

export interface RegelBedingung {
  feld: string;
  op: string;
  wert?: unknown;
  vergleich_feld?: string;
}

export interface StrukturierteRegel {
  verknuepfung?: "AND" | "OR";
  bedingungen: RegelBedingung[];
  dann: unknown;
}

export interface RegelGruppe {
  ziel_feld: string;
  auswertung: "erste_zutreffende";
  regeln: StrukturierteRegel[];
}

export interface FreitextRegel {
  typ: "freitext";
  text: string;
  aktiv_wenn?: { feld: string; op: string; wert: unknown } | null;
}

export type Regelwerk = RegelGruppe | FreitextRegel;

export interface Variante {
  wenn_feld?: string;
  op?: string;
  wert?: unknown;
  standard?: boolean;
  artikel_nr: string;
}

export interface Abhaengigkeit {
  komponente_id: string;
}

export interface Konflikt {
  komponente_id?: string;
  kombinations_konflikt?: boolean;
  komponenten?: string[];
  typ: "blockieren" | "warnung" | "auto_aufloesung";
  nur_wenn?: { feld: string; op: string; wert: unknown };
  meldung: string;
  aktion?: string;
  komponente_id_ziel?: string;
}

export interface AktivierungsRegel {
  feld: string;
  op: string;
  wert: unknown;
  verknuepfung: "AND" | "OR";
}

export interface Komponente {
  id: string;
  name: string;
  menge_feld: string;
  aktivierung: AktivierungsRegel[];
  varianten: Variante[];
  abhaengigkeiten: Abhaengigkeit[];
  konflikte: Konflikt[];
}

export interface DomainConfig {
  felder: Datenfeld[];
  parameter: Parameter[];
  validierungen: Validierung[];
  regelwerk: Regelwerk[];
  komponenten: Komponente[];
}

export interface PreisItem {
  artikel_nr: string;
  bezeichnung: string;
  einheit: string;
  ek_preis: number;
  waehrung?: string;
  steuer_prozent?: number;
}
