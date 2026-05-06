"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { runEngine } from "@/lib/engine";
import type { DomainConfig, PreisItem } from "@/types/domain";
import { AlertTriangle, XCircle, Send, Package, CheckCircle2 } from "lucide-react";

interface ConfiguratorClientProps {
  domainId: string;
  domainName: string;
  config: DomainConfig;
  pricelists: Array<{ id: string; name: string; items: PreisItem[] }>;
}

export function ConfiguratorClient({ domainId, domainName, config, pricelists }: ConfiguratorClientProps) {
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
  const [kunde, setKunde] = useState({ name: "", email: "", adresse: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preisItems = pricelists.find((p) => p.id === selectedPricelist)?.items ?? [];

  const result = useMemo(
    () => runEngine(config, values, preisItems),
    [config, values, preisItems]
  );

  const hasErrors = result.validierungen.some((v) => v.typ === "fehler");

  function setValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const kalkulationszeilen = result.activeKomponenten.map(({ komp, menge, artikel_nr }) => {
    const item = preisItems.find((i) => i.artikel_nr === artikel_nr);
    const ep = item?.ek_preis ?? 0;
    return { komp, menge, artikel_nr, item, ep, gesamt: menge * ep };
  });
  const gesamtpreis = kalkulationszeilen.reduce((sum, z) => sum + z.gesamt, 0);

  async function handleSubmit() {
    if (hasErrors || !kunde.name) return;
    setSubmitting(true);
    const payload = {
      domain_id: domainId,
      pricelist_id: selectedPricelist,
      kunde,
      eingaben: values,
    };
    // placeholder — later: POST to n8n webhook
    console.log("Konfigurator-Payload:", payload);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
        <h2 className="text-xl font-semibold">Angebot wird erstellt</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Das Angebot für {kunde.name} wurde übermittelt
        </p>
        <Button className="mt-6" onClick={() => setSubmitted(false)}>
          Neues Angebot erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kundendaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Max Mustermann"
                  value={kunde.name}
                  onChange={(e) => setKunde((k) => ({ ...k, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  placeholder="max@beispiel.de"
                  value={kunde.email}
                  onChange={(e) => setKunde((k) => ({ ...k, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Adresse</Label>
              <Input
                placeholder="Musterstraße 1, 90402 Nürnberg"
                value={kunde.adresse}
                onChange={(e) => setKunde((k) => ({ ...k, adresse: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Konfiguration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pricelists.length > 1 && (
              <div className="space-y-1.5">
                <Label>Preisliste</Label>
                <Select value={selectedPricelist} onValueChange={setSelectedPricelist}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pricelists.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {eingabeFelder.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Formularfelder konfiguriert</p>
            ) : (
              eingabeFelder.map((f) => {
                const sichtbar = !f.sichtbar_wenn || (() => {
                  const sw = f.sichtbar_wenn!;
                  const left = result.values[sw.feld] ?? values[sw.feld];
                  return sw.op === "==" ? left == sw.wert : left != sw.wert;
                })();
                if (!sichtbar) return null;

                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label>
                      {f.label}
                      {f.einheit && <span className="text-muted-foreground ml-1">({f.einheit})</span>}
                      {f.pflicht && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {f.typ === "boolean" ? (
                      <div className="flex items-center gap-2">
                        <Switch checked={Boolean(values[f.key])} onCheckedChange={(v) => setValue(f.key, v)} />
                        <span className="text-sm text-muted-foreground">{values[f.key] ? "Ja" : "Nein"}</span>
                      </div>
                    ) : f.typ === "select" ? (
                      <Select value={String(values[f.key] ?? "")} onValueChange={(v) => setValue(f.key, v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Bitte wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.optionen ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.typ === "number" ? "number" : "text"}
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

            {result.validierungen.map((v, i) => (
              <Alert key={i} variant={v.typ === "fehler" ? "destructive" : "warning"}>
                {v.typ === "fehler" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertDescription>{v.meldung}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-violet-500" />
              Angebots-Vorschau
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.activeKomponenten.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine aktiven Komponenten</p>
            ) : (
              <div className="space-y-2">
                {kalkulationszeilen.map(({ komp, menge, artikel_nr, item, gesamt }) => (
                  <div key={komp.id} className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <div className="font-medium">{komp.name}</div>
                      {artikel_nr && <div className="text-muted-foreground font-mono">{artikel_nr}</div>}
                      {item && <div className="text-muted-foreground">{item.bezeichnung}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-muted-foreground">{menge} × {item?.ek_preis?.toFixed(2) ?? "?"} €</div>
                      <div className="font-semibold">{gesamt.toFixed(2)} €</div>
                    </div>
                  </div>
                ))}
                {preisItems.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Gesamt (EK)</span>
                      <span>{gesamtpreis.toFixed(2)} €</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          disabled={hasErrors || !kunde.name || submitting}
          loading={submitting}
          onClick={handleSubmit}
        >
          <Send className="h-4 w-4" />
          Angebot erstellen
        </Button>
        {!kunde.name && (
          <p className="text-xs text-muted-foreground text-center">Kundenname ist erforderlich</p>
        )}
      </div>
    </div>
  );
}
