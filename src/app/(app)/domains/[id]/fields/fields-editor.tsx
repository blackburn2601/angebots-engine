"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, ChevronDown, ChevronRight, Trash2, GripVertical,
  Hash, Type, List, ToggleLeft, Calculator, Cpu, Save, AlertCircle, Search, X, AlertTriangle, Wand2
} from "lucide-react";
import type { DomainConfig, Datenfeld, FeldTyp } from "@/types/domain";
import { cn } from "@/lib/utils";
import { FormulaInput } from "@/components/ui/formula-input";
import { detectFormulaOrderIssues, fixFormulaOrder } from "@/lib/validate-fields";

const UNIT_PRESETS = ["m", "m²", "m³", "cm", "mm", "km", "kg", "g", "t", "l", "ml", "Stk", "Paar", "Stg", "h", "min", "kW", "kWh", "kN", "N", "%", "€", "°C"];

function normalizeToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s_]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/^[^a-z]+/, "");
}

const FIELD_TYPE_CONFIG: Record<FeldTyp, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }> = {
  number: { label: "Zahl", icon: Hash, color: "text-blue-600 bg-blue-50", description: "Numerischer Eingabewert" },
  text: { label: "Text", icon: Type, color: "text-green-600 bg-green-50", description: "Freitext-Eingabe" },
  select: { label: "Auswahl", icon: List, color: "text-purple-600 bg-purple-50", description: "Dropdown mit festen Optionen" },
  boolean: { label: "Ja/Nein", icon: ToggleLeft, color: "text-orange-600 bg-orange-50", description: "Ein/Aus Umschalter" },
  formula: { label: "Berechnung", icon: Calculator, color: "text-indigo-600 bg-indigo-50", description: "Automatische Berechnung (immer dieselbe Formel)" },
  output: { label: "Ergebnis", icon: Cpu, color: "text-rose-600 bg-rose-50", description: "Wird durch das Regelwerk gesetzt" },
};

function newField(): Datenfeld {
  return { key: "", label: "", typ: "number" };
}

function validateKey(key: string): string | null {
  if (!key) return "Pflichtfeld";
  if (!/^[a-z][a-z0-9_]*$/.test(key)) return "Nur Kleinbuchstaben, Zahlen und _ erlaubt, muss mit Buchstabe beginnen";
  return null;
}

interface FieldCardProps {
  field: Datenfeld;
  allFields: Datenfeld[];
  onChange: (f: Datenfeld) => void;
  onDelete: () => void;
  orderIssues?: string[];
  isDragOver?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}

function FieldCard({ field, allFields, onChange, onDelete, orderIssues, isDragOver, draggable, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }: FieldCardProps) {
  const allKeys = allFields.map((f) => f.key);
  const [open, setOpen] = useState(!field.key);
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(!!field.key);
  const [customUnit, setCustomUnit] = useState(!!field.einheit && !UNIT_PRESETS.includes(field.einheit));
  const typeConfig = FIELD_TYPE_CONFIG[field.typ];
  const keyError = validateKey(field.key);
  const isDuplicate = allKeys.filter((k) => k === field.key).length > 1;

  const TypeIcon = typeConfig.icon;

  function handleLabelChange(newLabel: string) {
    const updates: Partial<Datenfeld> = { label: newLabel };
    if (!keyManuallyEdited) {
      const base = normalizeToKey(newLabel);
      if (base) {
        const otherKeys = allKeys.filter((k) => k !== field.key);
        updates.key = otherKeys.includes(base) ? `${base}_${Math.random().toString(36).slice(2, 5)}` : base;
      }
    }
    onChange({ ...field, ...updates });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={cn(
          "rounded-xl border bg-card shadow-sm transition-shadow",
          open && "shadow-md",
          draggable && "cursor-grab active:cursor-grabbing",
          isDragOver && "border-primary bg-primary/5 shadow-md scale-[1.01]"
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center gap-3 p-4 hover:bg-muted/30 rounded-xl">
            <GripVertical className={cn("h-4 w-4 shrink-0", draggable ? "text-muted-foreground/60" : "text-muted-foreground/20")} />
            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", typeConfig.color)}>
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{field.label || <span className="text-muted-foreground italic">Kein Name</span>}</span>
                {field.key && (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{field.key}</code>
                )}
                {(keyError || isDuplicate) && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">{typeConfig.label}</span>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">{typeConfig.label}</Badge>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Bezeichnung</Label>
                <Input
                  placeholder="z.B. Länge"
                  value={field.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Interner Name
                  {!keyManuallyEdited && <span className="ml-2 text-xs text-muted-foreground">(auto)</span>}
                  {isDuplicate && <span className="ml-2 text-xs text-destructive">(bereits vergeben)</span>}
                  {keyError && field.key && <span className="ml-2 text-xs text-destructive">({keyError})</span>}
                </Label>
                <Input
                  placeholder="z.B. laenge"
                  value={field.key}
                  onChange={(e) => {
                    setKeyManuallyEdited(true);
                    onChange({ ...field, key: e.target.value.toLowerCase().replace(/\s/g, "_") });
                  }}
                  className={cn((keyError && field.key) || isDuplicate ? "border-destructive" : "")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Feldtyp</Label>
              <Select
                value={field.typ}
                onValueChange={(v: FeldTyp) => onChange({ ...field, typ: v, optionen: undefined, formel: undefined, einheit: undefined })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(FIELD_TYPE_CONFIG) as [FeldTyp, (typeof FIELD_TYPE_CONFIG)[FeldTyp]][]).map(([typ, cfg]) => (
                    <SelectItem key={typ} value={typ}>
                      <div className="flex items-center gap-2">
                        <cfg.icon className="h-4 w-4" />
                        <span>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">· {cfg.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(field.typ === "number" || field.typ === "formula" || field.typ === "output") && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Einheit</Label>
                  <Select
                    value={customUnit ? "__custom__" : (field.einheit ?? "__none__")}
                    onValueChange={(v) => {
                      if (v === "__custom__") { setCustomUnit(true); }
                      else { setCustomUnit(false); onChange({ ...field, einheit: v === "__none__" ? undefined : v }); }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Keine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine</SelectItem>
                      {UNIT_PRESETS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      <SelectItem value="__custom__">Eigene…</SelectItem>
                    </SelectContent>
                  </Select>
                  {customUnit && (
                    <Input
                      autoFocus
                      placeholder="Eigene Einheit"
                      value={field.einheit ?? ""}
                      onChange={(e) => onChange({ ...field, einheit: e.target.value || undefined })}
                    />
                  )}
                </div>
                {field.typ === "number" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Minimalwert</Label>
                      <Input
                        type="number"
                        placeholder="—"
                        value={field.min ?? ""}
                        onChange={(e) => onChange({ ...field, min: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Maximalwert</Label>
                      <Input
                        type="number"
                        placeholder="—"
                        value={field.max ?? ""}
                        onChange={(e) => onChange({ ...field, max: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {field.typ === "formula" && (
              <div className="space-y-1.5">
                <Label>Formel</Label>
                <FormulaInput
                  value={field.formel ?? ""}
                  onChange={(v) => onChange({ ...field, formel: v || undefined })}
                  fields={allFields.filter((f) => f.key !== field.key)}
                  placeholder="z.B. laenge * breite"
                />
                {orderIssues && orderIssues.length > 0 && (() => {
                  const deps = orderIssues.map((k) => {
                    const f = allFields.find((f) => f.key === k);
                    return { key: k, label: f?.label ?? k, breaking: f?.typ === "formula" };
                  });
                  const anyBreaking = deps.some((d) => d.breaking);
                  return (
                    <div className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-sm",
                      anyBreaking ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                    )}>
                      <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", anyBreaking ? "text-red-500" : "text-amber-600")} />
                      <div className={anyBreaking ? "text-red-800" : "text-amber-800"}>
                        <p className="font-medium">Berechnungsreihenfolge</p>
                        <p className={cn("mt-0.5", anyBreaking ? "text-red-700" : "text-amber-700")}>
                          {deps.map((d) => `„${d.label}"`).join(", ")}{" "}
                          {deps.length === 1 ? "steht" : "stehen"} weiter unten,{" "}
                          {anyBreaking
                            ? "das Ergebnis wird falsch berechnet."
                            : "zur Übersichtlichkeit nach oben verschieben."}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {field.typ === "select" && (
              <div className="space-y-1.5">
                <Label>Optionen</Label>
                <div className="space-y-2">
                  {(field.optionen ?? []).map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const opts = [...(field.optionen ?? [])];
                          opts[i] = e.target.value;
                          onChange({ ...field, optionen: opts });
                        }}
                        placeholder={`Option ${i + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const opts = [...(field.optionen ?? [])];
                          opts.splice(i, 1);
                          onChange({ ...field, optionen: opts });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onChange({ ...field, optionen: [...(field.optionen ?? []), ""] })}
                  >
                    <Plus className="h-4 w-4" />
                    Option hinzufügen
                  </Button>
                </div>
              </div>
            )}

            {["number", "text", "select", "boolean"].includes(field.typ) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Standardwert</Label>
                  {field.typ === "boolean" ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={Boolean(field.standard)}
                        onCheckedChange={(v) => onChange({ ...field, standard: v })}
                      />
                      <span className="text-sm text-muted-foreground">{field.standard ? "Ja" : "Nein"}</span>
                    </div>
                  ) : field.typ === "select" ? (
                    <Select
                      value={field.standard != null ? String(field.standard) : "__none__"}
                      onValueChange={(v) => onChange({ ...field, standard: v === "__none__" ? undefined : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kein Standard" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Kein Standard</SelectItem>
                        {(field.optionen ?? []).filter(Boolean).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.typ === "number" ? "number" : "text"}
                      placeholder="—"
                      value={field.standard != null ? String(field.standard) : ""}
                      onChange={(e) => onChange({
                        ...field,
                        standard: field.typ === "number"
                          ? (e.target.value ? Number(e.target.value) : undefined)
                          : (e.target.value || undefined),
                      })}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Pflichtfeld</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={Boolean(field.pflicht)}
                      onCheckedChange={(v) => onChange({ ...field, pflicht: v || undefined })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {field.pflicht ? "Muss ausgefüllt werden" : "Optional"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Feld entfernen
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface FieldsEditorProps {
  domainId: string;
  initialConfig: DomainConfig;
}

export function FieldsEditor({ domainId, initialConfig }: FieldsEditorProps) {
  const [config, setConfig] = useState<DomainConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);

  const updateField = useCallback((index: number, field: Datenfeld) => {
    setConfig((prev) => {
      const felder = [...prev.felder];
      felder[index] = field;
      return { ...prev, felder };
    });
    setSaved(false);
  }, []);

  const deleteField = useCallback((index: number) => {
    setConfig((prev) => {
      const felder = [...prev.felder];
      felder.splice(index, 1);
      return { ...prev, felder };
    });
    setSaved(false);
  }, []);

  const addField = useCallback(() => {
    setConfig((prev) => ({ ...prev, felder: [...prev.felder, newField()] }));
    setSaved(false);
  }, []);

  const moveField = useCallback((from: number, to: number) => {
    if (from === to) return;
    setConfig((prev) => {
      const felder = [...prev.felder];
      const [moved] = felder.splice(from, 1);
      felder.splice(to, 0, moved);
      return { ...prev, felder };
    });
    setSaved(false);
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config_json: JSON.stringify(config) }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      setSaved(true);
    } catch {
      setError("Fehler beim Speichern. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const allKeys = config.felder.map((f) => f.key);
  const hasErrors = config.felder.some((f) => !f.key || !f.label || validateKey(f.key)) ||
    allKeys.filter((k, i) => allKeys.indexOf(k) !== i).length > 0;

  const formulaIssues = detectFormulaOrderIssues(config.felder);
  const issuesByKey = new Map<string, string[]>();
  for (const issue of formulaIssues) {
    if (!issuesByKey.has(issue.fieldKey)) issuesByKey.set(issue.fieldKey, []);
    issuesByKey.get(issue.fieldKey)!.push(issue.dependsOn);
  }
  const affectedCount = issuesByKey.size;
  const hasEngineBreaking = formulaIssues.some((i) => i.isEngineBreaking);

  function applyFormulaFix() {
    setConfig((prev) => ({ ...prev, felder: fixFormulaOrder(prev.felder) }));
    setSaved(false);
  }

  const q = search.trim().toLowerCase();
  const filteredIndices = config.felder
    .map((f, i) => ({ f, i }))
    .filter(({ f }) =>
      !q ||
      f.label.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      FIELD_TYPE_CONFIG[f.typ].label.toLowerCase().includes(q)
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Felder durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <p className="text-sm text-muted-foreground shrink-0">
          {q
            ? `${filteredIndices.length} von ${config.felder.length} Feldern`
            : config.felder.length === 0
              ? "Noch keine Felder"
              : `${config.felder.length} Feld${config.felder.length !== 1 ? "er" : ""}`}
        </p>

        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-destructive">{error}</span>}
          {saved && !saving && <span className="text-sm text-emerald-600">Gespeichert ✓</span>}
          <Button onClick={save} loading={saving} disabled={hasErrors || saving}>
            <Save className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </div>

      {affectedCount > 0 && !q && (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3",
          hasEngineBreaking
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
        )}>
          <AlertTriangle className={cn("h-4 w-4 shrink-0", hasEngineBreaking ? "text-red-500" : "text-amber-600")} />
          <p className={cn("flex-1 text-sm", hasEngineBreaking ? "text-red-800" : "text-amber-800")}>
            <span className="font-medium">
              {affectedCount === 1
                ? "1 Berechnungsfeld referenziert Felder,"
                : `${affectedCount} Berechnungsfelder referenzieren Felder,`}{" "}
              {hasEngineBreaking
                ? "die weiter unten stehen. Das Ergebnis wird falsch berechnet."
                : "die zur Übersichtlichkeit weiter oben stehen sollten."}
            </span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "shrink-0",
              hasEngineBreaking
                ? "border-red-300 text-red-800 hover:bg-red-100"
                : "border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
            )}
            onClick={applyFormulaFix}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Reihenfolge automatisch korrigieren
          </Button>
        </div>
      )}

      {config.felder.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Lege dein erstes Feld an, z.B. die Länge oder das Material
          </p>
          <Button onClick={addField}>
            <Plus className="h-4 w-4" />
            Erstes Feld hinzufügen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!q && (
            <Button variant="outline" onClick={addField} className="w-full">
              <Plus className="h-4 w-4" />
              Weiteres Feld hinzufügen
            </Button>
          )}
          {filteredIndices.length === 0 && q ? (
            <div className="rounded-xl border-2 border-dashed py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Keine Felder für „{search}" gefunden.
              </p>
            </div>
          ) : (
            filteredIndices.map(({ f, i }) => (
              <FieldCard
                key={i}
                field={f}
                allFields={config.felder}
                onChange={(updated) => updateField(i, updated)}
                onDelete={() => deleteField(i)}
                orderIssues={issuesByKey.get(f.key)}
                draggable={!q}
                isDragOver={dragOver === i}
                onDragStart={() => { dragIndex.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (dragIndex.current !== null) moveField(dragIndex.current, i);
                  dragIndex.current = null;
                  setDragOver(null);
                }}
                onDragEnd={() => { dragIndex.current = null; setDragOver(null); }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
