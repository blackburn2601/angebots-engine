"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { runEngine } from "@/lib/engine";
import type { DomainConfig, PreisItem } from "@/types/domain";
import { AlertTriangle, XCircle, Package, CheckCircle2, Zap, MessageSquare } from "lucide-react";

interface SimulatorClientProps {
  config: DomainConfig;
  pricelists: Array<{ id: string; name: string; items: PreisItem[] }>;
}

export function SimulatorClient({ config, pricelists }: SimulatorClientProps) {
  const eingabeFelder = config.felder.filter((f) =>
    config.parameter.some((p) => p.feld === f.key)
  );

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    for (const f of eingabeFelder) {
      if (f.standard != null) defaults[f.key] = f.standard;
    }
    return defaults;
  });

  const [selectedPricelist, setSelectedPricelist] = useState(pricelists[0]?.id ?? "");

  const preisItems = pricelists.find((p) => p.id === selectedPricelist)?.items ?? [];

  const result = useMemo(
    () => runEngine(config, values, preisItems),
    [config, values, preisItems]
  );

  function setValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function formatValue(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") return v.toLocaleString("de-DE", { maximumFractionDigits: 4 });
    return String(v);
  }

  const kalkulationszeilen = result.activeKomponenten.map(({ komp, menge, artikel_nr }) => {
    const item = preisItems.find((i) => i.artikel_nr === artikel_nr);
    const ep = item?.ek_preis ?? 0;
    const gesamt = menge * ep;
    return { komp, menge, artikel_nr, item, ep, gesamt };
  });

  const gesamtpreis = kalkulationszeilen.reduce((sum, z) => sum + z.gesamt, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: input */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
          <h3 className="font-medium text-sm">Eingaben</h3>

          {pricelists.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Preisliste</Label>
              <Select value={selectedPricelist} onValueChange={setSelectedPricelist}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pricelists.map((pl) => (
                    <SelectItem key={pl.id} value={pl.id} className="text-xs">{pl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {eingabeFelder.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Formularfelder konfiguriert</p>
          ) : (
            eingabeFelder.map((f) => {
              const sichtbar = !f.sichtbar_wenn || (() => {
                const sw = f.sichtbar_wenn!;
                const left = result.values[sw.feld] ?? values[sw.feld];
                switch (sw.op) {
                  case "==": return left == sw.wert;
                  case "!=": return left != sw.wert;
                  default: return true;
                }
              })();

              if (!sichtbar) return null;

              return (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">
                    {f.label}
                    {f.einheit && <span className="text-muted-foreground ml-1">({f.einheit})</span>}
                  </Label>
                  {f.typ === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={Boolean(values[f.key])}
                        onCheckedChange={(v) => setValue(f.key, v)}
                      />
                      <span className="text-xs text-muted-foreground">{values[f.key] ? "Ja" : "Nein"}</span>
                    </div>
                  ) : f.typ === "select" ? (
                    <Select
                      value={String(values[f.key] ?? "")}
                      onValueChange={(v) => setValue(f.key, v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Wählen…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.optionen ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={f.typ === "number" ? "number" : "text"}
                      className="h-8 text-xs"
                      value={values[f.key] != null ? String(values[f.key]) : ""}
                      min={f.min}
                      max={f.max}
                      onChange={(e) => setValue(f.key, f.typ === "number" ? Number(e.target.value) : e.target.value)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {result.validierungen.length > 0 && (
          <div className="space-y-2">
            {result.validierungen.map((v, i) => (
              <Alert key={i} variant={v.typ === "fehler" ? "destructive" : "warning"}>
                {v.typ === "fehler" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertDescription className="text-xs">{v.meldung}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </div>

      {/* Right: results */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-rose-500" />
            Berechnete Werte
          </h3>
          {config.felder.filter((f) => ["formula", "output"].includes(f.typ)).length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine berechneten Felder</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {config.felder.filter((f) => ["formula", "output"].includes(f.typ)).map((f) => {
                const v = result.values[f.key];
                const fired = result.firedRules.find((r) => r.ziel_feld === f.key);
                return (
                  <div
                    key={f.key}
                    className={`rounded-lg border px-3 py-2 ${fired ? "border-rose-200 bg-rose-50" : "border-transparent bg-muted/50"}`}
                  >
                    <p className="text-xs text-muted-foreground truncate">{f.label}</p>
                    <p className="font-mono font-semibold text-sm mt-0.5 truncate">
                      {formatValue(v)}{f.einheit ? <span className="font-normal text-xs text-muted-foreground ml-1">{f.einheit}</span> : null}
                      {fired && <span className="ml-1 text-rose-500 text-xs">⚡</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {result.activeKomponenten.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-violet-500" />
              Aktive Komponenten
            </h3>
            <div className="space-y-2">
              {kalkulationszeilen.map(({ komp, menge, artikel_nr, item, ep, gesamt }) => (
                <div key={komp.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="font-medium">{komp.name}</span>
                    </div>
                    {artikel_nr && (
                      <div className="mt-0.5 text-muted-foreground">
                        <code>{artikel_nr}</code>
                        {item && <span> — {item.bezeichnung}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono">{formatValue(menge)} × {ep.toFixed(2)} €</div>
                    <div className="font-semibold">{gesamt.toFixed(2)} €</div>
                  </div>
                </div>
              ))}
              {preisItems.length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between px-3 text-sm font-semibold">
                    <span>Gesamt (EK)</span>
                    <span>{gesamtpreis.toFixed(2)} €</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {result.activeFreitext.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Freitext-Hinweise
            </h3>
            {result.activeFreitext.map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground">{r.text}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
