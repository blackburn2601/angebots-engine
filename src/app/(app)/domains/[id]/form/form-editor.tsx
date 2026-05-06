"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, GripVertical, Hash, Type, List, ToggleLeft } from "lucide-react";
import type { DomainConfig, Datenfeld, FeldTyp } from "@/types/domain";

const EINGABE_TYPEN: FeldTyp[] = ["number", "text", "select", "boolean"];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  number: Hash,
  text: Type,
  select: List,
  boolean: ToggleLeft,
};

interface FormEditorProps {
  domainId: string;
  initialConfig: DomainConfig;
}

export function FormEditor({ domainId, initialConfig }: FormEditorProps) {
  const [config, setConfig] = useState<DomainConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);

  const eingabeFelder = config.felder.filter((f) => EINGABE_TYPEN.includes(f.typ));
  const parameterKeys = config.parameter.map((p) => p.feld);
  const verfuegbar = eingabeFelder.filter((f) => !parameterKeys.includes(f.key));

  function addParameter(key: string) {
    setConfig((prev) => ({
      ...prev,
      parameter: [...prev.parameter, { feld: key }],
    }));
    setSaved(false);
  }

  function removeParameter(key: string) {
    setConfig((prev) => ({
      ...prev,
      parameter: prev.parameter.filter((p) => p.feld !== key),
    }));
    setSaved(false);
  }

  function moveParameter(from: number, to: number) {
    if (from === to) return;
    const params = [...config.parameter];
    const [moved] = params.splice(from, 1);
    params.splice(to, 0, moved);
    setConfig((prev) => ({ ...prev, parameter: params }));
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

  function getField(key: string): Datenfeld | undefined {
    return config.felder.find((f) => f.key === key);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {config.parameter.length === 0
            ? "Noch keine Formularfelder"
            : `${config.parameter.length} Feld${config.parameter.length !== 1 ? "er" : ""} im Formular`}
        </p>
        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-destructive">{error}</span>}
          {saved && !saving && <span className="text-sm text-emerald-600">Gespeichert ✓</span>}
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </div>

      {eingabeFelder.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Lege zuerst Eingabefelder unter{" "}
            <a href="fields" className="underline">Felder</a> an
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {config.parameter.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Noch keine Felder im Formular. Füge Felder aus der Liste unten hinzu.
                </p>
              </div>
            ) : (
              config.parameter.map((param, i) => {
                const field = getField(param.feld);
                const Icon = TYPE_ICON[field?.typ ?? "number"] ?? Hash;
                return (
                  <div
                    key={param.feld}
                    draggable
                    onDragStart={() => { dragIndex.current = i; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => {
                      if (dragIndex.current !== null) moveParameter(dragIndex.current, i);
                      dragIndex.current = null;
                      setDragOver(null);
                    }}
                    onDragEnd={() => { dragIndex.current = null; setDragOver(null); }}
                    className={`flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors cursor-grab active:cursor-grabbing ${dragOver === i ? "border-primary bg-primary/5" : ""}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{field?.label ?? param.feld}</span>
                      <code className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{param.feld}</code>
                    </div>
                    {field?.pflicht && <Badge variant="outline" className="text-xs">Pflicht</Badge>}
                    {field?.standard != null && (
                      <Badge variant="secondary" className="text-xs">
                        Standard: {String(field.standard)}
                      </Badge>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => removeParameter(param.feld)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {verfuegbar.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-medium">Feld hinzufügen</p>
              <div className="flex gap-2">
                <Select onValueChange={addParameter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Feld auswählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {verfuegbar.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label} <span className="text-muted-foreground">({f.key})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {verfuegbar.length === 0 && eingabeFelder.length > 0 && config.parameter.length === eingabeFelder.length && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Alle verfügbaren Eingabefelder sind bereits im Formular
            </p>
          )}
        </>
      )}
    </div>
  );
}
