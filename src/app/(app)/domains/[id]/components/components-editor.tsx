"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Save, Package,
  AlertTriangle, CheckCircle2
} from "lucide-react";
import type { DomainConfig, Komponente, Variante, AktivierungsRegel } from "@/types/domain";
import { cn } from "@/lib/utils";

interface ArtikelInfo {
  artikel_nr: string;
  bezeichnung: string;
}

function newKomponente(): Komponente {
  return {
    id: `komp-${Date.now()}`,
    name: "",
    menge_feld: "",
    aktivierung: [],
    varianten: [],
    abhaengigkeiten: [],
    konflikte: [],
  };
}

interface KomponenteCardProps {
  komp: Komponente;
  alleKomponenten: Komponente[];
  alleFelder: DomainConfig["felder"];
  alleArtikel: ArtikelInfo[];
  onChange: (k: Komponente) => void;
  onDelete: () => void;
}

function KomponenteCard({ komp, alleKomponenten, alleFelder, alleArtikel, onChange, onDelete }: KomponenteCardProps) {
  const [open, setOpen] = useState(!komp.name);
  const [tab, setTab] = useState<"base" | "aktivierung" | "varianten" | "abhaengigkeiten">("base");

  const mengenFelder = alleFelder.filter((f) => ["number", "formula", "output"].includes(f.typ));

  const hasWarning = !komp.menge_feld || komp.varianten.length === 0;

  function addVariante() {
    onChange({ ...komp, varianten: [...komp.varianten, { artikel_nr: "" }] });
  }

  function updateVariante(i: number, v: Variante) {
    const vs = [...komp.varianten];
    vs[i] = v;
    onChange({ ...komp, varianten: vs });
  }

  function deleteVariante(i: number) {
    onChange({ ...komp, varianten: komp.varianten.filter((_, idx) => idx !== i) });
  }

  function addAktivierung() {
    onChange({
      ...komp,
      aktivierung: [...komp.aktivierung, { feld: "", op: "==", wert: "", verknuepfung: "AND" }],
    });
  }

  function updateAktivierung(i: number, a: AktivierungsRegel) {
    const as = [...komp.aktivierung];
    as[i] = a;
    onChange({ ...komp, aktivierung: as });
  }

  const tabs = [
    { id: "base", label: "Grunddaten" },
    { id: "aktivierung", label: `Aktivierung${komp.aktivierung.length ? ` (${komp.aktivierung.length})` : ""}` },
    { id: "varianten", label: `Varianten${komp.varianten.length ? ` (${komp.varianten.length})` : ""}` },
    { id: "abhaengigkeiten", label: "Abhängigkeiten" },
  ] as const;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn("rounded-xl border bg-card shadow-sm", open && "shadow-md")}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center gap-3 p-4 hover:bg-muted/20 rounded-xl">
            <Package className="h-4 w-4 text-violet-500 shrink-0" />
            <div className="flex-1">
              <span className="font-medium text-sm">{komp.name || <span className="italic text-muted-foreground">Kein Name</span>}</span>
              {komp.menge_feld && (
                <code className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  Menge: {komp.menge_feld}
                </code>
              )}
            </div>
            {hasWarning ? (
              <Badge variant="warning">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Unvollständig
              </Badge>
            ) : (
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                OK
              </Badge>
            )}
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            <div className="flex gap-0 border-b px-4 pt-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "px-3 pb-2 pt-1 text-xs font-medium border-b-2 transition-colors",
                    tab === t.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {tab === "base" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input
                        placeholder="z.B. Stütze, Solaranlage"
                        value={komp.name}
                        onChange={(e) => onChange({ ...komp, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Interner Bezeichner</Label>
                      <Input
                        placeholder="z.B. stuetze"
                        value={komp.id}
                        onChange={(e) => onChange({ ...komp, id: e.target.value.toLowerCase().replace(/\s/g, "-") })}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mengenfeld — welches Feld liefert die Stückzahl?</Label>
                    <Select value={komp.menge_feld} onValueChange={(v) => onChange({ ...komp, menge_feld: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Feld wählen…" />
                      </SelectTrigger>
                      <SelectContent>
                        {mengenFelder.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label} <span className="text-muted-foreground">({f.key})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Dieser Wert wird mit dem Preis aus der Preisliste multipliziert
                    </p>
                  </div>
                </>
              )}

              {tab === "aktivierung" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Wann soll diese Komponente ins Angebot kommen?
                    Leer = immer aktiv
                  </p>
                  {komp.aktivierung.map((regel, i) => {
                    const selectedField = alleFelder.find((f) => f.key === regel.feld);
                    const opsForType: Record<string, string[]> = {
                      number: ["==", "!=", "<", "<=", ">", ">="],
                      formula: ["==", "!=", "<", "<=", ">", ">="],
                      output: ["==", "!=", "<", "<=", ">", ">="],
                      text: ["==", "!="],
                      select: ["==", "!="],
                      boolean: ["=="],
                    };
                    const availableOps = selectedField ? (opsForType[selectedField.typ] ?? ["==", "!="]) : ["==", "!=", "<", "<=", ">", ">="];
                    return (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={regel.feld} onValueChange={(v) => {
                        const f = alleFelder.find((f) => f.key === v);
                        const defaultOp = f?.typ === "boolean" ? "==" : (opsForType[f?.typ ?? ""] ?? ["=="])[0];
                        const defaultWert = f?.typ === "boolean" ? true : undefined;
                        updateAktivierung(i, { ...regel, feld: v, op: defaultOp, wert: defaultWert });
                      }}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="Feld" />
                        </SelectTrigger>
                        <SelectContent>
                          {alleFelder.map((f) => (
                            <SelectItem key={f.key} value={f.key} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={regel.op} onValueChange={(v) => updateAktivierung(i, { ...regel, op: v })}>
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOps.map((op) => (
                            <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedField?.typ === "boolean" ? (
                        <Select
                          value={String(regel.wert ?? "true")}
                          onValueChange={(v) => updateAktivierung(i, { ...regel, wert: v === "true" })}
                        >
                          <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true" className="text-xs">Ja</SelectItem>
                            <SelectItem value="false" className="text-xs">Nein</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : selectedField?.typ === "select" ? (
                        <Select
                          value={String(regel.wert ?? "")}
                          onValueChange={(v) => updateAktivierung(i, { ...regel, wert: v })}
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
                          type={["number", "formula", "output"].includes(selectedField?.typ ?? "") ? "number" : "text"}
                          placeholder="Wert"
                          value={regel.wert != null ? String(regel.wert) : ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = Number(raw);
                            updateAktivierung(i, { ...regel, wert: raw === "" ? undefined : (!isNaN(num) && raw !== "" ? num : raw) });
                          }}
                        />
                      )}
                      <Select value={regel.verknuepfung} onValueChange={(v: "AND" | "OR") => updateAktivierung(i, { ...regel, verknuepfung: v })}>
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND" className="text-xs">UND</SelectItem>
                          <SelectItem value="OR" className="text-xs">ODER</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => onChange({ ...komp, aktivierung: komp.aktivierung.filter((_, idx) => idx !== i) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={addAktivierung}>
                    <Plus className="h-3.5 w-3.5" />
                    Bedingung hinzufügen
                  </Button>
                </div>
              )}

              {tab === "varianten" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Welcher Artikel aus der Preisliste wird verwendet — je nach Konfiguration
                  </p>
                  {komp.varianten.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {!v.standard ? (
                        <>
                          <span className="text-xs text-muted-foreground shrink-0">WENN</span>
                          <Select value={v.wenn_feld ?? ""} onValueChange={(fk) => updateVariante(i, { ...v, wenn_feld: fk })}>
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue placeholder="Feld" />
                            </SelectTrigger>
                            <SelectContent>
                              {alleFelder.map((f) => (
                                <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={v.op ?? "=="} onValueChange={(op) => updateVariante(i, { ...v, op })}>
                            <SelectTrigger className="w-20 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["==", "!="].map((op) => (
                                <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="flex-1 h-8 text-xs"
                            placeholder="Wert"
                            value={String(v.wert ?? "")}
                            onChange={(e) => updateVariante(i, { ...v, wert: e.target.value })}
                          />
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs">Standard</Badge>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">→</span>
                      <Input
                        className="flex-1 h-8 text-xs font-mono"
                        placeholder="Artikelnummer"
                        value={v.artikel_nr}
                        onChange={(e) => updateVariante(i, { ...v, artikel_nr: e.target.value })}
                        list={`artikel-list-${komp.id}`}
                      />
                      <datalist id={`artikel-list-${komp.id}`}>
                        {alleArtikel.map((a) => (
                          <option key={a.artikel_nr} value={a.artikel_nr}>{a.bezeichnung}</option>
                        ))}
                      </datalist>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => deleteVariante(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addVariante}>
                      <Plus className="h-3.5 w-3.5" />
                      Wenn-Variante
                    </Button>
                    {!komp.varianten.some((v) => v.standard) && (
                      <Button variant="outline" size="sm" onClick={() => onChange({ ...komp, varianten: [...komp.varianten, { standard: true, artikel_nr: "" }] })}>
                        <Plus className="h-3.5 w-3.5" />
                        Standard-Artikel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {tab === "abhaengigkeiten" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Welche Komponenten werden automatisch aktiviert, wenn diese aktiv ist?
                  </p>
                  {komp.abhaengigkeiten.map((ab, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select
                        value={ab.komponente_id}
                        onValueChange={(v) => {
                          const abs = [...komp.abhaengigkeiten];
                          abs[i] = { komponente_id: v };
                          onChange({ ...komp, abhaengigkeiten: abs });
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="Komponente wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {alleKomponenten.filter((k) => k.id !== komp.id).map((k) => (
                            <SelectItem key={k.id} value={k.id} className="text-xs">{k.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => onChange({ ...komp, abhaengigkeiten: komp.abhaengigkeiten.filter((_, idx) => idx !== i) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => onChange({ ...komp, abhaengigkeiten: [...komp.abhaengigkeiten, { komponente_id: "" }] })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Abhängigkeit hinzufügen
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ComponentsEditorProps {
  domainId: string;
  initialConfig: DomainConfig;
  alleArtikel: ArtikelInfo[];
}

export function ComponentsEditor({ domainId, initialConfig, alleArtikel }: ComponentsEditorProps) {
  const [config, setConfig] = useState<DomainConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function addKomponente() {
    setConfig((prev) => ({ ...prev, komponenten: [...prev.komponenten, newKomponente()] }));
    setSaved(false);
  }

  function updateKomponente(i: number, k: Komponente) {
    const komponenten = [...config.komponenten];
    komponenten[i] = k;
    setConfig((prev) => ({ ...prev, komponenten }));
    setSaved(false);
  }

  function deleteKomponente(i: number) {
    setConfig((prev) => ({ ...prev, komponenten: prev.komponenten.filter((_, idx) => idx !== i) }));
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {config.komponenten.length === 0
            ? "Noch keine Komponenten"
            : `${config.komponenten.length} Komponente${config.komponenten.length !== 1 ? "n" : ""}`}
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

      {config.komponenten.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <Package className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Noch keine Komponenten — lege deine erste Produktkomponente an
          </p>
          <Button onClick={addKomponente}>
            <Plus className="h-4 w-4" />
            Erste Komponente hinzufügen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button variant="outline" onClick={addKomponente} className="w-full">
            <Plus className="h-4 w-4" />
            Neue Komponente hinzufügen
          </Button>
          {config.komponenten.map((komp, i) => (
            <KomponenteCard
              key={komp.id}
              komp={komp}
              alleKomponenten={config.komponenten}
              alleFelder={config.felder}
              alleArtikel={alleArtikel}
              onChange={(k) => updateKomponente(i, k)}
              onDelete={() => deleteKomponente(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
