"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Save, ArrowUp, ArrowDown,
  AlertTriangle, MessageSquare, Zap, GripVertical
} from "lucide-react";
import type {
  DomainConfig, RegelGruppe, StrukturierteRegel, FreitextRegel,
  RegelBedingung, Datenfeld
} from "@/types/domain";
import { cn } from "@/lib/utils";

const OPS: Record<string, string[]> = {
  number: ["<", "<=", ">", ">=", "==", "!="],
  formula: ["<", "<=", ">", ">=", "==", "!="],
  output: ["<", "<=", ">", ">=", "==", "!="],
  text: ["==", "!=", "enthält"],
  select: ["==", "!="],
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

function getOpsForField(field: Datenfeld | undefined): string[] {
  if (!field) return ["==", "!=", "<", "<=", ">", ">="];
  return OPS[field.typ] ?? ["=="];
}

interface ConditionRowProps {
  condition: RegelBedingung;
  fields: Datenfeld[];
  onChange: (c: RegelBedingung) => void;
  onDelete: () => void;
}

function ConditionRow({ condition, fields, onChange, onDelete }: ConditionRowProps) {
  const selectedField = fields.find((f) => f.key === condition.feld);
  const ops = getOpsForField(selectedField);

  return (
    <div className="flex items-center gap-2">
      <Select value={condition.feld} onValueChange={(v) => {
        const f = fields.find((f) => f.key === v);
        onChange({ ...condition, feld: v, wert: f?.typ === "boolean" ? true : undefined });
      }}>
        <SelectTrigger className="flex-1 h-8 text-xs">
          <SelectValue placeholder="Feld wählen" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key} className="text-xs">
              {f.label} <span className="text-muted-foreground">({f.key})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={condition.op} onValueChange={(v) => onChange({ ...condition, op: v })}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((op) => (
            <SelectItem key={op} value={op} className="text-xs">{OP_LABELS[op] ?? op}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedField?.typ === "boolean" ? (
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
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue placeholder="Wert wählen" />
          </SelectTrigger>
          <SelectContent>
            {(selectedField.optionen ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="flex-1 h-8 text-xs"
          placeholder="Wert"
          value={condition.wert != null ? String(condition.wert) : ""}
          onChange={(e) => {
            const raw = e.target.value;
            const num = Number(raw);
            onChange({ ...condition, wert: raw === "" ? undefined : (!isNaN(num) && raw !== "" ? num : raw) });
          }}
        />
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface RuleRowProps {
  rule: StrukturierteRegel;
  fields: Datenfeld[];
  index: number;
  total: number;
  isFallback: boolean;
  onChange: (r: StrukturierteRegel) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}

function RuleRow({ rule, fields, index, total, isFallback, onChange, onDelete, onMove }: RuleRowProps) {
  return (
    <div className={cn("rounded-lg border p-3 space-y-2", isFallback && "border-dashed bg-muted/30")}>
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        {isFallback ? (
          <Badge variant="outline" className="text-xs">Standardwert</Badge>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground font-medium">WENN</span>
            <Select
              value={rule.verknuepfung ?? "AND"}
              onValueChange={(v: "AND" | "OR") => onChange({ ...rule, verknuepfung: v })}
            >
              <SelectTrigger className="h-6 w-20 text-xs px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND" className="text-xs">alle (UND)</SelectItem>
                <SelectItem value="OR" className="text-xs">eine (ODER)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Bedingung zutrifft:</span>
          </div>
        )}
        <div className="ml-auto flex gap-1">
          {!isFallback && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove("up")}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index >= total - 2} onClick={() => onMove("down")}>
                <ArrowDown className="h-3 w-3" />
              </Button>
            </>
          )}
          {!isFallback && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {!isFallback && (
        <div className="space-y-1.5 pl-6">
          {rule.bedingungen.map((cond, ci) => (
            <ConditionRow
              key={ci}
              condition={cond}
              fields={fields}
              onChange={(c) => {
                const bs = [...rule.bedingungen];
                bs[ci] = c;
                onChange({ ...rule, bedingungen: bs });
              }}
              onDelete={() => {
                const bs = rule.bedingungen.filter((_, i) => i !== ci);
                onChange({ ...rule, bedingungen: bs });
              }}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => onChange({ ...rule, bedingungen: [...rule.bedingungen, { feld: "", op: "==", wert: "" }] })}
          >
            <Plus className="h-3 w-3" />
            Bedingung
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 pl-6">
        <span className="text-xs font-medium text-muted-foreground shrink-0">DANN:</span>
        <Input
          className="flex-1 h-8 text-xs"
          placeholder="Wert (z.B. 4 oder 0.8)"
          value={rule.dann != null ? String(rule.dann) : ""}
          onChange={(e) => {
            const raw = e.target.value;
            const num = Number(raw);
            onChange({ ...rule, dann: raw === "" ? "" : (!isNaN(num) && raw !== "" ? num : raw) });
          }}
        />
      </div>
    </div>
  );
}

interface RegelGruppeCardProps {
  gruppe: RegelGruppe;
  fields: Datenfeld[];
  onChange: (g: RegelGruppe) => void;
  onDelete: () => void;
}

function RegelGruppeCard({ gruppe, fields, onChange, onDelete }: RegelGruppeCardProps) {
  const [open, setOpen] = useState(false);
  const targetField = fields.find((f) => f.key === gruppe.ziel_feld);

  const hasFallback = gruppe.regeln.length > 0 && gruppe.regeln[gruppe.regeln.length - 1].bedingungen.length === 0;
  const fallbackAtEnd = !hasFallback || true;

  function addRule() {
    const fallback = hasFallback ? gruppe.regeln[gruppe.regeln.length - 1] : null;
    const others = hasFallback ? gruppe.regeln.slice(0, -1) : gruppe.regeln;
    const newRule: StrukturierteRegel = { verknuepfung: "AND", bedingungen: [{ feld: "", op: "==", wert: "" }], dann: "" };
    const newRegeln = fallback ? [...others, newRule, fallback] : [...others, newRule];
    onChange({ ...gruppe, regeln: newRegeln });
  }

  function addFallback() {
    const fallback: StrukturierteRegel = { bedingungen: [], dann: "" };
    onChange({ ...gruppe, regeln: [...gruppe.regeln, fallback] });
  }

  function updateRule(index: number, rule: StrukturierteRegel) {
    const regeln = [...gruppe.regeln];
    regeln[index] = rule;
    onChange({ ...gruppe, regeln });
  }

  function deleteRule(index: number) {
    onChange({ ...gruppe, regeln: gruppe.regeln.filter((_, i) => i !== index) });
  }

  function moveRule(index: number, dir: "up" | "down") {
    const regeln = [...gruppe.regeln];
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= regeln.length) return;
    [regeln[index], regeln[target]] = [regeln[target], regeln[index]];
    onChange({ ...gruppe, regeln });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn("rounded-xl border bg-card shadow-sm", open && "shadow-md")}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center gap-3 p-4 hover:bg-muted/20 rounded-xl">
            <Zap className="h-4 w-4 text-rose-500 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {targetField?.label ?? gruppe.ziel_feld}
                </span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{gruppe.ziel_feld}</code>
              </div>
              <span className="text-xs text-muted-foreground">
                {gruppe.regeln.length} Regel{gruppe.regeln.length !== 1 ? "n" : ""}
                {!hasFallback && " — "}
              </span>
            </div>
            {!hasFallback && (
              <Badge variant="warning">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Kein Standardwert
              </Badge>
            )}
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4 space-y-2">
            {!hasFallback && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Kein Standardwert definiert — ohne Standardwert bleibt das Feld leer wenn keine Regel passt.{" "}
                  <button className="underline" onClick={addFallback}>Jetzt hinzufügen →</button>
                </AlertDescription>
              </Alert>
            )}

            {gruppe.regeln.map((rule, i) => {
              const isFallback = rule.bedingungen.length === 0;
              return (
                <RuleRow
                  key={i}
                  rule={rule}
                  fields={fields}
                  index={i}
                  total={gruppe.regeln.length}
                  isFallback={isFallback}
                  onChange={(r) => updateRule(i, r)}
                  onDelete={() => deleteRule(i)}
                  onMove={(dir) => moveRule(i, dir)}
                />
              );
            })}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={addRule}>
                <Plus className="h-3.5 w-3.5" />
                Wenn-Dann Regel
              </Button>
              {!hasFallback && (
                <Button variant="outline" size="sm" onClick={addFallback}>
                  <Plus className="h-3.5 w-3.5" />
                  Standardwert
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface RulesEditorProps {
  domainId: string;
  initialConfig: DomainConfig;
}

function normalizeBooleanConditions(cfg: DomainConfig): DomainConfig {
  return {
    ...cfg,
    regelwerk: cfg.regelwerk.map((r) => {
      if ("typ" in r && r.typ === "freitext") return r;
      const gruppe = r as RegelGruppe;
      return {
        ...gruppe,
        regeln: gruppe.regeln.map((regel) => ({
          ...regel,
          bedingungen: regel.bedingungen.map((b) => {
            const field = cfg.felder.find((f) => f.key === b.feld);
            if (field?.typ === "boolean" && typeof b.wert !== "boolean") {
              return { ...b, wert: b.wert === false || b.wert === "false" ? false : true };
            }
            return b;
          }),
        })),
      };
    }),
  };
}

export function RulesEditor({ domainId, initialConfig }: RulesEditorProps) {
  const [config, setConfig] = useState<DomainConfig>(() => normalizeBooleanConditions(initialConfig));
  const [activeTab, setActiveTab] = useState<"wenn-dann" | "freitext">("wenn-dann");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [newFreitext, setNewFreitext] = useState("");

  const outputFelder = config.felder.filter((f) => f.typ === "output");
  const alleFelder = config.felder;
  const regelGruppen = config.regelwerk.filter((r): r is RegelGruppe => !("typ" in r && r.typ === "freitext"));
  const freitextRegeln = config.regelwerk.filter((r): r is FreitextRegel => "typ" in r && r.typ === "freitext");
  const regelZiele = regelGruppen.map((g) => g.ziel_feld);
  const ohneRegel = outputFelder.filter((f) => !regelZiele.includes(f.key));

  function addRegelGruppe(feldKey: string) {
    const newGruppe: RegelGruppe = {
      ziel_feld: feldKey,
      auswertung: "erste_zutreffende",
      regeln: [
        { verknuepfung: "AND", bedingungen: [{ feld: "", op: "==", wert: "" }], dann: "" },
        { bedingungen: [], dann: "" },
      ],
    };
    setConfig((prev) => ({ ...prev, regelwerk: [...prev.regelwerk, newGruppe] }));
    setSaved(false);
  }

  function updateGruppe(index: number, gruppe: RegelGruppe) {
    const rw = [...config.regelwerk];
    const gruppenIndizes = rw
      .map((r, i) => (!("typ" in r && r.typ === "freitext") ? i : -1))
      .filter((i) => i >= 0);
    rw[gruppenIndizes[index]] = gruppe;
    setConfig((prev) => ({ ...prev, regelwerk: rw }));
    setSaved(false);
  }

  function deleteGruppe(index: number) {
    const rw = [...config.regelwerk];
    const gruppenIndizes = rw
      .map((r, i) => (!("typ" in r && r.typ === "freitext") ? i : -1))
      .filter((i) => i >= 0);
    rw.splice(gruppenIndizes[index], 1);
    setConfig((prev) => ({ ...prev, regelwerk: rw }));
    setSaved(false);
  }

  function addFreitext() {
    if (!newFreitext.trim()) return;
    const rule: FreitextRegel = { typ: "freitext", text: newFreitext.trim(), aktiv_wenn: null };
    setConfig((prev) => ({ ...prev, regelwerk: [...prev.regelwerk, rule] }));
    setNewFreitext("");
    setSaved(false);
  }

  function deleteFreitext(index: number) {
    const rw = [...config.regelwerk];
    const ftIndizes = rw
      .map((r, i) => ("typ" in r && r.typ === "freitext" ? i : -1))
      .filter((i) => i >= 0);
    rw.splice(ftIndizes[index], 1);
    setConfig((prev) => ({ ...prev, regelwerk: rw }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config_json: JSON.stringify(config) }),
      });
      if (!res.ok) throw new Error("Fehler");
      setSaved(true);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-destructive">{error}</span>}
          {saved && !saving && <span className="text-sm text-emerald-600">Gespeichert ✓</span>}
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setActiveTab("wenn-dann")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "wenn-dann" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Zap className="h-3.5 w-3.5 text-rose-500" />
          Wenn-Dann Regeln
          {regelGruppen.length > 0 && <span className="rounded-full bg-muted px-1.5 text-xs">{regelGruppen.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab("freitext")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "freitext" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
          Freitext-Hinweise
          {freitextRegeln.length > 0 && <span className="rounded-full bg-muted px-1.5 text-xs">{freitextRegeln.length}</span>}
        </button>
      </div>

      {outputFelder.length === 0 && activeTab === "wenn-dann" ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Noch keine berechneten Felder (Typ: Ergebnis) unter{" "}
            <a href="fields" className="underline">Felder</a> angelegt
          </p>
        </div>
      ) : activeTab === "wenn-dann" ? (
        <div className="space-y-4">
          <div className="space-y-3">
            {regelGruppen.map((gruppe, i) => (
              <RegelGruppeCard
                key={gruppe.ziel_feld}
                gruppe={gruppe}
                fields={alleFelder}
                onChange={(g) => updateGruppe(i, g)}
                onDelete={() => deleteGruppe(i)}
              />
            ))}
          </div>

          {ohneRegel.length > 0 && (
            <div className="rounded-xl border-2 border-dashed p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Felder ohne Regel — füge eine Regelgruppe hinzu:
              </p>
              <div className="flex flex-wrap gap-2">
                {ohneRegel.map((f) => (
                  <Button key={f.key} variant="outline" size="sm" onClick={() => addRegelGruppe(f.key)}>
                    <Plus className="h-3.5 w-3.5" />
                    Regel für „{f.label}"
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Freitext-Hinweise
              <Badge variant="secondary" className="text-xs">Werden an KI übergeben</Badge>
            </h3>
            <div className="space-y-2">
              {freitextRegeln.map((regel, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
                  <p className="flex-1 text-sm">{regel.text}</p>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteFreitext(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="rounded-xl border bg-card p-3 space-y-2">
                <Label className="text-xs">Neuer Freitext-Hinweis</Label>
                <Textarea
                  placeholder="z.B.: Bei Hanglage muss die bergseitige Stütze 30 cm tiefer fundiert werden…"
                  value={newFreitext}
                  onChange={(e) => setNewFreitext(e.target.value)}
                  rows={3}
                />
                <Button size="sm" variant="outline" onClick={addFreitext} disabled={!newFreitext.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                  Hinweis hinzufügen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
