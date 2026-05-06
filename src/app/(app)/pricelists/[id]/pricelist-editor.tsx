"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plus, Trash2, Upload, Search } from "lucide-react";
import type { PreisItem } from "@/types/domain";
import Papa from "papaparse";

interface PricelistEditorProps {
  pricelist: {
    id: string;
    name: string;
    aktiv: boolean;
    gueltig_ab: string | null;
    gueltig_bis: string | null;
    items: PreisItem[];
    domainIds: string[];
  };
  allDomains: { id: string; name: string }[];
}

function newItem(): PreisItem {
  return { artikel_nr: "", bezeichnung: "", einheit: "Stk", ek_preis: 0, waehrung: "EUR", steuer_prozent: 19 };
}

export function PricelistEditor({ pricelist: initial, allDomains }: PricelistEditorProps) {
  const [name, setName] = useState(initial.name);
  const [aktiv, setAktiv] = useState(initial.aktiv);
  const [items, setItems] = useState<PreisItem[]>(initial.items);
  const [domainIds, setDomainIds] = useState<string[]>(initial.domainIds);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter(
    (i) =>
      i.artikel_nr.toLowerCase().includes(search.toLowerCase()) ||
      i.bezeichnung.toLowerCase().includes(search.toLowerCase())
  );

  function updateItem(index: number, field: keyof PreisItem, value: string | number) {
    const newItems = [...items];
    const globalIndex = items.indexOf(filtered[index]);
    newItems[globalIndex] = { ...newItems[globalIndex], [field]: value };
    setItems(newItems);
    setSaved(false);
  }

  function deleteItem(filteredIndex: number) {
    const globalIndex = items.indexOf(filtered[filteredIndex]);
    setItems(items.filter((_, i) => i !== globalIndex));
    setSaved(false);
  }

  function addItem() {
    setItems([...items, newItem()]);
    setSaved(false);
  }

  function handleCSV(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const imported: PreisItem[] = [];
        for (const row of results.data as Record<string, string>[]) {
          const artikel_nr = row.artikel_nr ?? row["Artikel-Nr"] ?? row.ArtikelNr ?? "";
          const bezeichnung = row.bezeichnung ?? row.Bezeichnung ?? "";
          const einheit = row.einheit ?? row.Einheit ?? "Stk";
          const ek_preis = parseFloat(row.ek_preis ?? row["EK-Preis"] ?? row.Preis ?? "0");
          if (artikel_nr) {
            imported.push({ artikel_nr, bezeichnung, einheit, ek_preis, waehrung: "EUR", steuer_prozent: 19 });
          }
        }
        setItems((prev) => {
          const existing = new Map(prev.map((i) => [i.artikel_nr, i]));
          for (const item of imported) existing.set(item.artikel_nr, item);
          return Array.from(existing.values());
        });
        setSaved(false);
      },
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/pricelists/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, aktiv, items_json: JSON.stringify(items), domainIds }),
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
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-destructive">{error}</span>}
          {saved && !saving && <span className="text-sm text-emerald-600">Gespeichert ✓</span>}
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </div>

      <Tabs defaultValue="artikel">
        <TabsList>
          <TabsTrigger value="artikel">Artikel ({items.length})</TabsTrigger>
          <TabsTrigger value="einstellungen">Einstellungen</TabsTrigger>
          <TabsTrigger value="domaenen">Domänen ({domainIds.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="artikel" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Artikel suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              CSV importieren
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleCSV(e.target.files[0]); }}
            />
            <Button size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Artikel
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              Noch keine Artikel — importiere eine CSV oder füge Artikel manuell hinzu
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="p-2 text-left font-medium text-muted-foreground w-32">Artikelnummer</th>
                    <th className="p-2 text-left font-medium text-muted-foreground">Bezeichnung</th>
                    <th className="p-2 text-left font-medium text-muted-foreground w-20">Einheit</th>
                    <th className="p-2 text-right font-medium text-muted-foreground w-28">EK-Preis</th>
                    <th className="p-2 text-right font-medium text-muted-foreground w-20">MwSt</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="p-1">
                        <Input
                          value={item.artikel_nr}
                          onChange={(e) => updateItem(i, "artikel_nr", e.target.value)}
                          className="h-7 text-xs font-mono"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={item.bezeichnung}
                          onChange={(e) => updateItem(i, "bezeichnung", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={item.einheit}
                          onChange={(e) => updateItem(i, "einheit", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          value={item.ek_preis}
                          onChange={(e) => updateItem(i, "ek_preis", parseFloat(e.target.value))}
                          className="h-7 text-xs text-right"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          value={item.steuer_prozent ?? 19}
                          onChange={(e) => updateItem(i, "steuer_prozent", parseInt(e.target.value))}
                          className="h-7 text-xs text-right"
                        />
                      </td>
                      <td className="p-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="einstellungen" className="space-y-4 mt-4 max-w-sm">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={aktiv} onCheckedChange={(v) => { setAktiv(v); setSaved(false); }} />
            <Label>{aktiv ? "Aktiv" : "Archiviert"}</Label>
          </div>
        </TabsContent>

        <TabsContent value="domaenen" className="space-y-3 mt-4">
          <p className="text-sm text-muted-foreground">
            Wähle für welche Domänen diese Preisliste verfügbar ist
          </p>
          {allDomains.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <Switch
                checked={domainIds.includes(d.id)}
                onCheckedChange={(v) => {
                  setDomainIds((prev) => v ? [...prev, d.id] : prev.filter((id) => id !== d.id));
                  setSaved(false);
                }}
              />
              <span className="text-sm">{d.name}</span>
              {domainIds.includes(d.id) && <Badge variant="success" className="text-xs">Zugewiesen</Badge>}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
