"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Save, AlertTriangle, XCircle, ArrowLeftRight,
} from "lucide-react";
import type { DomainConfig, Validierung, BedingungsGruppe, Bedingung, Datenfeld } from "@/types/domain";
import { cn } from "@/lib/utils";

const OPS: Record<string, string[]> = {
  number:  ["<", "<=", ">", ">=", "==", "!="],
  formula: ["<", "<=", ">", ">=", "==", "!="],
  output:  ["<", "<=", ">", ">=", "==", "!="],
  text:    ["==", "!=", "enthält"],
  select:  ["==", "!="],
  boolean: ["=="],
};

const OP_LABELS: Record<string, string> = {
  "<": "< kleiner als",
  "<=": "≤ kleiner/gleich",
  ">": "> größer als",
  ">=": "≥ größer/gleich",
  "==": "= gleich",
  "!=": "≠ ungleich",
  "enthält": "enthält",
};

function newBedingung(): Bedingung {
  return { feld: "", op: "==", wert: undefined };
}

function normalizeBedingung(b: Validierung["bedingung"]): BedingungsGruppe {
  if ("regeln" in b) return b as BedingungsGruppe;
  return { verknuepfung: "AND", regeln: [b as Bedingung] };
}

interface ConditionRowProps {
  condition: Bedingung;
  fields: Datenfeld[];
  onChange: (c: Bedingung) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function ConditionRow({ condition, fields, onChange, onDelete, canDelete }: ConditionRowProps) {
  const selectedField = fields.find((f) => f.key === condition.feld);
  const ops = selectedField ? (OPS[selectedField.typ] ?? ["==", "!="]) : ["==", "!=", "<", "<=", ">", ">="];
  const isFieldComparison = condition.vergleich_feld !== undefined;

  // Numeric-capable operators that make sense for field comparisons
  const numericOps = ["<", "<=", ">", ">=", "==", "!="];
  const comparisonOps = selectedField
    ? (["number", "formula", "output"].includes(selectedField.typ) ? numericOps : ["==", "!="])
    : numericOps;

  function toggleComparisonMode() {
    if (isFieldComparison) {
      onChange({ ...condition, vergleich_feld: undefined, wert: undefined });
    } else {
      onChange({ ...condition, wert: undefined, vergleich_feld: "" });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Left field selector */}
      <Select
        value={condition.feld ?? ""}
        onValueChange={(v) => {
          const f = fields.find((f) => f.key === v);
          onChange({
            ...condition,
            feld: v,
            op: (OPS[f?.typ ?? ""] ?? ["=="])[0],
            wert: isFieldComparison ? undefined : (f?.typ === "boolean" ? true : undefined),
            vergleich_feld: isFieldComparison ? condition.vergleich_feld : undefined,
          });
        }}
      >
        <SelectTrigger className="flex-1 h-8 text-xs">
          <SelectValue placeholder="Feld wählen…" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key} className="text-xs">
              {f.label} <span className="text-muted-foreground">({f.key})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select value={condition.op} onValueChange={(v) => onChange({ ...condition, op: v })}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(isFieldComparison ? comparisonOps : ops).map((op) => (
            <SelectItem key={op} value={op} className="text-xs">{OP_LABELS[op] ?? op}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Toggle: static value ↔ field comparison */}
      <Button
        variant={isFieldComparison ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={toggleComparisonMode}
        title={isFieldComparison ? "Auf festen Wert wechseln" : "Mit anderem Feld vergleichen"}
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </Button>

      {/* Right side: field selector or value input */}
      {isFieldComparison ? (
        <Select
          value={condition.vergleich_feld ?? ""}
          onValueChange={(v) => onChange({ ...condition, vergleich_feld: v })}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Vergleichsfeld…" />
          </SelectTrigger>
          <SelectContent>
            {fields.filter((f) => f.key !== condition.feld).map((f) => (
              <SelectItem key={f.key} value={f.key} className="text-xs">
                {f.label} <span className="text-muted-foreground">({f.key})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : selectedField?.typ === "boolean" ? (
        <Select
          value={String(condition.wert ?? "true")}
          onValueChange={(v) => onChange({ ...condition, wert: v === "true" })}
        >
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">Ja</SelectItem>
            <SelectItem value="false" className="text-xs">Nein</SelectItem>
          </SelectContent>
        </Select>
      ) : selectedField?.typ === "select" ? (
        <Select
          value={String(condition.wert ?? "")}
          onValueChange={(v) => onChange({ ...condition, wert: v })}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Wert…" />
          </SelectTrigger>
          <SelectContent>
            {(selectedField.optionen ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="w-28 h-8 text-xs"
          type={selectedField?.typ === "number" ? "number" : "text"}
          placeholder="Wert…"
          value={condition.wert != null ? String(condition.wert) : ""}
          onChange={(e) => onChange({
            ...condition,
            wert: selectedField?.typ === "number"
              ? (e.target.value === "" ? undefined : Number(e.target.value))
              : e.target.value || undefined,
          })}
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={!canDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface ValidationCardProps {
  val: Validierung;
  fields: Datenfeld[];
  onChange: (v: Validierung) => void;
  onDelete: () => void;
}

function ValidationCard({ val, fields, onChange, onDelete }: ValidationCardProps) {
  const [open, setOpen] = useState(!val.meldung);
  const gruppe = normalizeBedingung(val.bedingung);

  function updateGruppe(g: BedingungsGruppe) {
    onChange({ ...val, bedingung: g });
  }

  function updateRegel(i: number, b: Bedingung) {
    const regeln = [...gruppe.regeln];
    regeln[i] = b;
    updateGruppe({ ...gruppe, regeln });
  }

  function addRegel() {
    updateGruppe({ ...gruppe, regeln: [...gruppe.regeln, newBedingung()] });
  }

  function deleteRegel(i: number) {
    const regeln = gruppe.regeln.filter((_, idx) => idx !== i);
    updateGruppe({ ...gruppe, regeln });
  }

  const Icon = val.typ === "fehler" ? XCircle : AlertTriangle;
  const iconColor = val.typ === "fehler" ? "text-destructive" : "text-amber-500";
  const badgeClass = val.typ === "fehler"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-amber-300 bg-amber-50 text-amber-700";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn("rounded-xl border bg-card shadow-sm transition-shadow", open && "shadow-md")}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center gap-3 p-4 hover:bg-muted/30 rounded-xl">
            <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {val.meldung || <span className="italic text-muted-foreground">Keine Meldung</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {gruppe.regeln.length === 1
                  ? "1 Bedingung"
                  : `${gruppe.regeln.length} Bedingungen (${gruppe.verknuepfung})`}
              </p>
            </div>
            <Badge variant="outline" className={cn("shrink-0 text-xs", badgeClass)}>
              {val.typ === "fehler" ? "Fehler" : "Warnung"}
            </Badge>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Typ</Label>
                <Select value={val.typ} onValueChange={(v: "fehler" | "warnung") => onChange({ ...val, typ: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fehler">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        Fehler — blockiert das Absenden
                      </div>
                    </SelectItem>
                    <SelectItem value="warnung">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Warnung — zeigt Hinweis, blockiert nicht
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Meldung</Label>
                <Input
                  placeholder="z.B. Länge darf nicht negativ sein"
                  value={val.meldung}
                  onChange={(e) => onChange({ ...val, meldung: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Bedingungen</Label>
                {gruppe.regeln.length > 1 && (
                  <Select
                    value={gruppe.verknuepfung}
                    onValueChange={(v: "AND" | "OR") => updateGruppe({ ...gruppe, verknuepfung: v })}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND" className="text-xs">Alle (AND)</SelectItem>
                      <SelectItem value="OR" className="text-xs">Eine (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                {gruppe.regeln.map((regel, i) => (
                  <ConditionRow
                    key={i}
                    condition={regel}
                    fields={fields}
                    onChange={(b) => updateRegel(i, b)}
                    onDelete={() => deleteRegel(i)}
                    canDelete={gruppe.regeln.length > 1}
                  />
                ))}
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={addRegel}>
                  <Plus className="h-3 w-3" />
                  Bedingung hinzufügen
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Validierung entfernen
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ValidationsEditorProps {
  domainId: string;
  initialConfig: DomainConfig;
}

export function ValidationsEditor({ domainId, initialConfig }: ValidationsEditorProps) {
  const [config, setConfig] = useState<DomainConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const validierungen = config.validierungen ?? [];

  const addValidierung = useCallback(() => {
    const neu: Validierung = {
      typ: "fehler",
      meldung: "",
      bedingung: { verknuepfung: "AND", regeln: [newBedingung()] },
    };
    setConfig((prev) => ({ ...prev, validierungen: [...(prev.validierungen ?? []), neu] }));
    setSaved(false);
  }, []);

  const updateValidierung = useCallback((i: number, v: Validierung) => {
    setConfig((prev) => {
      const arr = [...(prev.validierungen ?? [])];
      arr[i] = v;
      return { ...prev, validierungen: arr };
    });
    setSaved(false);
  }, []);

  const deleteValidierung = useCallback((i: number) => {
    setConfig((prev) => {
      const arr = [...(prev.validierungen ?? [])];
      arr.splice(i, 1);
      return { ...prev, validierungen: arr };
    });
    setSaved(false);
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config_json: JSON.stringify(config) }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Fehler beim Speichern. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const inputFelder = config.felder.filter((f) => f.key);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {validierungen.length === 0
            ? "Noch keine Validierungen"
            : `${validierungen.length} Validierung${validierungen.length !== 1 ? "en" : ""}`}
        </p>
        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-destructive">{error}</span>}
          {saved && !saving && <span className="text-sm text-emerald-600">Gespeichert ✓</span>}
          <Button onClick={save} loading={saving} disabled={saving}>
            <Save className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </div>

      {validierungen.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Noch keine Validierungen — lege eine Fehler- oder Warnungsregel an
          </p>
          <Button onClick={addValidierung}>
            <Plus className="h-4 w-4" />
            Erste Validierung anlegen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button variant="outline" onClick={addValidierung} className="w-full">
            <Plus className="h-4 w-4" />
            Validierung hinzufügen
          </Button>
          {validierungen.map((v, i) => (
            <ValidationCard
              key={i}
              val={v}
              fields={inputFelder}
              onChange={(updated) => updateValidierung(i, updated)}
              onDelete={() => deleteValidierung(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
