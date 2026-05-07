"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { UserRolle } from "@/lib/auth-helpers";
import { Input } from "@/components/ui/input";
import {
  BookOpen, LayoutGrid, FileText, Sliders, ShieldAlert, Package,
  ListChecks, PlayCircle, ShoppingCart, Key, Users, Zap,
  ArrowRight, CheckCircle2, XCircle, AlertTriangle, Code2,
  Hash, Type, ToggleLeft, List, FunctionSquare, Calculator,
  GripVertical, ChevronRight, Info, Layers, Globe, Lock, Search, X,
} from "lucide-react";

interface DocsClientProps {
  userRolle: UserRolle;
}

const ROLE_COLORS: Record<UserRolle, string> = {
  SUPER_ADMIN: "bg-rose-100 text-rose-700 border-rose-200",
  DOMAIN_ADMIN: "bg-violet-100 text-violet-700 border-violet-200",
  SELLER: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const ROLE_LABELS: Record<UserRolle, string> = {
  SUPER_ADMIN: "Super Admin",
  DOMAIN_ADMIN: "Domain Admin",
  SELLER: "Verkäufer",
};

function RoleBadge({ role }: { role: UserRolle }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", ROLE_COLORS[role])}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function SectionHeading({ id, icon: Icon, title, subtitle }: {
  id: string; icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string;
}) {
  return (
    <div id={id} className="flex items-start gap-4 scroll-mt-8">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function Callout({ type = "info", children }: { type?: "info" | "warning" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: { bg: "bg-blue-50 border-blue-200", icon: Info, iconColor: "text-blue-500" },
    warning: { bg: "bg-amber-50 border-amber-200", icon: AlertTriangle, iconColor: "text-amber-500" },
    tip: { bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2, iconColor: "text-emerald-500" },
  };
  const s = styles[type];
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", s.bg)}>
      <s.icon className={cn("h-4 w-4 mt-0.5 shrink-0", s.iconColor)} />
      <div className="text-sm text-foreground/80">{children}</div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-xl bg-muted border px-4 py-3 text-xs font-mono text-foreground overflow-x-auto">
      {children}
    </pre>
  );
}

function FieldTypeCard({ icon: Icon, color, name, description, example }: {
  icon: React.ComponentType<{ className?: string }>; color: string; name: string; description: string; example: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", color)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm">{name}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="rounded-lg bg-muted px-3 py-1.5">
        <span className="text-xs font-mono text-muted-foreground">{example}</span>
      </div>
    </div>
  );
}

function FlowStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          {number}
        </div>
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>
      <div className="pb-6">
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

const sections = [
  { id: "overview", label: "Überblick", icon: BookOpen },
  { id: "roles", label: "Rollen & Rechte", icon: Users },
  { id: "domains", label: "Domänen", icon: LayoutGrid },
  { id: "fields", label: "Felder & Typen", icon: Sliders },
  { id: "form", label: "Formular", icon: FileText },
  { id: "rules", label: "Regelwerk", icon: Zap },
  { id: "validations", label: "Validierungen", icon: ShieldAlert },
  { id: "components", label: "Komponenten", icon: Package },
  { id: "pricelists", label: "Preislisten", icon: ListChecks },
  { id: "simulator", label: "Simulator", icon: PlayCircle },
  { id: "configurator", label: "Konfigurator", icon: ShoppingCart },
  { id: "api", label: "API & Integration", icon: Globe },
];

// Keywords for each section used in search
const SECTION_KEYWORDS: Record<string, string[]> = {
  overview: ["überblick", "einführung", "architektur", "was ist"],
  roles: ["rollen", "berechtigungen", "rechte", "super admin", "domain admin", "verkäufer"],
  domains: ["domänen", "domain", "konfiguration", "bereiche", "duplizieren"],
  fields: ["felder", "typen", "formel", "ausgabe", "zahl", "text", "select", "boolean", "formula", "output"],
  form: ["formular", "sichtbarkeit", "pflichtfeld", "eingabe", "bedingung"],
  rules: ["regelwerk", "regeln", "berechnung", "wenn", "condition", "automatisch"],
  validations: ["validierungen", "fehler", "warnung", "prüfung", "error"],
  components: ["komponenten", "artikel", "kalkulation", "menge", "varianten"],
  pricelists: ["preislisten", "preis", "artikel", "einkaufspreis", "csv"],
  simulator: ["simulator", "test", "live", "eingaben", "berechnung prüfen"],
  configurator: ["konfigurator", "verkäufer", "angebot", "export"],
  api: ["api", "integration", "rest", "endpunkt", "auth", "key", "bearer"],
};

export function DocsClient({ userRolle }: DocsClientProps) {
  const [active, setActive] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  // Filter sections by search query
  const filteredSections = searchQuery.trim()
    ? sections.filter(({ id, label }) => {
        const q = searchQuery.toLowerCase();
        if (label.toLowerCase().includes(q)) return true;
        const keywords = SECTION_KEYWORDS[id] ?? [];
        return keywords.some((kw) => kw.includes(q) || q.includes(kw.substring(0, 4)));
      })
    : sections;

  return (
    <div className="flex min-h-screen">
      {/* Sticky sidebar nav */}
      <aside className="hidden lg:block w-56 shrink-0 sticky top-0 h-screen border-r bg-card overflow-y-auto py-6">
        {/* Search bar */}
        <div className="px-2 mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 pr-7 h-8 text-xs"
              placeholder="Suchen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {searchQuery ? `${filteredSections.length} Treffer` : "Inhaltsverzeichnis"}
        </p>
        <nav className="space-y-0.5 px-2">
          {filteredSections.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => { setActive(id); setSearchQuery(""); }}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active === id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </a>
          ))}
          {filteredSections.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Keine Treffer für &quot;{searchQuery}&quot;
            </div>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-violet-500/5 px-8 py-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Angebots-Engine</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Dokumentation</h1>
            <p className="mt-2 text-base text-muted-foreground max-w-xl">
              Alles was du wissen musst — von der Grundkonfiguration bis zur API-Integration.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Du bist angemeldet als</span>
                <RoleBadge role={userRolle} />
              </div>
              {/* Mobile search */}
              <div className="lg:hidden relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 w-52 h-8 text-xs"
                  placeholder="Dokumentation durchsuchen…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Decorative dots */}
          <div className="absolute right-8 top-8 grid grid-cols-6 gap-2 opacity-20">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary" />
            ))}
          </div>
        </div>

        <div className="px-8 py-10 space-y-16 max-w-4xl">

          {/* ── OVERVIEW ── */}
          <section className="space-y-6">
            <SectionHeading id="overview" icon={BookOpen} title="Überblick" subtitle="Was ist die Angebots-Engine und wie funktioniert sie?" />

            <p className="text-sm text-muted-foreground leading-relaxed">
              Die <strong className="text-foreground">Angebots-Engine</strong> ist ein konfigurierbares System zur automatisierten Angebotserstellung.
              Statt jedes Angebot manuell zu kalkulieren, definierst du einmal die Berechnungslogik — und der Konfigurator erledigt den Rest.
            </p>

            {/* Architecture visual */}
            <div className="rounded-2xl border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">Wie alles zusammenhängt</p>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {[
                  { icon: Sliders, label: "Felder", sub: "Daten & Formeln", color: "bg-blue-100 text-blue-600" },
                  { icon: FileText, label: "Formular", sub: "Eingabemaske", color: "bg-violet-100 text-violet-600" },
                  { icon: Zap, label: "Regelwerk", sub: "Berechnungen", color: "bg-amber-100 text-amber-600" },
                  { icon: ShieldAlert, label: "Validierung", sub: "Fehlerprüfung", color: "bg-rose-100 text-rose-600" },
                  { icon: Package, label: "Komponenten", sub: "Kalkulation", color: "bg-emerald-100 text-emerald-600" },
                ].map((item, i, arr) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", item.color)}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                    </div>
                    {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            <Callout type="tip">
              Beginne immer mit dem Anlegen der <strong>Felder</strong>, da alle anderen Bausteine (Formular, Regelwerk, Komponenten) auf Feldern aufbauen.
            </Callout>
          </section>

          <Separator />

          {/* ── ROLES ── */}
          <section className="space-y-6">
            <SectionHeading id="roles" icon={Users} title="Rollen & Berechtigungen" subtitle="Drei Rollen mit klar getrennten Zuständigkeiten" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* SUPER_ADMIN */}
              <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 shadow-md shadow-rose-200">
                    <Lock className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-rose-800">Super Admin</p>
                    <p className="text-[11px] text-rose-600">Vollzugriff</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {["Domänen verwalten", "Preislisten verwalten", "Benutzer anlegen/bearbeiten", "API-Keys erstellen", "Konfigurator nutzen"].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-rose-700">
                      <CheckCircle2 className="h-3 w-3 text-rose-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* DOMAIN_ADMIN */}
              <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 shadow-md shadow-violet-200">
                    <Layers className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-violet-800">Domain Admin</p>
                    <p className="text-[11px] text-violet-600">Konfiguration</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {["Domänen verwalten", "Preislisten verwalten", "Konfigurator nutzen"].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-violet-700">
                      <CheckCircle2 className="h-3 w-3 text-violet-500 shrink-0" /> {f}
                    </li>
                  ))}
                  {["Benutzer verwalten", "API-Keys erstellen"].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* SELLER */}
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 shadow-md shadow-emerald-200">
                    <ShoppingCart className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-emerald-800">Verkäufer</p>
                    <p className="text-[11px] text-emerald-600">Nutzung</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {["Konfigurator nutzen", "Angebote berechnen"].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                  {["Domänen konfigurieren", "Preislisten bearbeiten", "Benutzer verwalten"].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 border-b">
                  <tr>
                    <th className="p-3 text-left font-semibold text-muted-foreground">Bereich</th>
                    <th className="p-3 text-center font-semibold text-rose-600">Super Admin</th>
                    <th className="p-3 text-center font-semibold text-violet-600">Domain Admin</th>
                    <th className="p-3 text-center font-semibold text-emerald-600">Verkäufer</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["Konfigurator", true, true, true],
                    ["Domänen einsehen", true, true, true],
                    ["Domänen konfigurieren", true, true, false],
                    ["Preislisten", true, true, false],
                    ["Benutzer verwalten", true, false, false],
                    ["API-Keys", true, false, false],
                  ].map(([label, sa, da, s]) => (
                    <tr key={String(label)} className="hover:bg-muted/20">
                      <td className="p-3 font-medium text-foreground">{label}</td>
                      {[sa, da, s].map((v, i) => (
                        <td key={i} className="p-3 text-center">
                          {v
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                            : <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Separator />

          {/* ── DOMAINS ── */}
          <section className="space-y-6">
            <SectionHeading id="domains" icon={LayoutGrid} title="Domänen" subtitle="Abgeschlossene Konfigurationsbereiche für verschiedene Produktgruppen" />

            <div className="flex items-start gap-4 rounded-2xl border bg-card p-5">
              <div className="shrink-0">
                <LayoutGrid className="h-8 w-8 text-primary mt-1" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Eine <strong className="text-foreground">Domäne</strong> ist ein vollständig konfigurierter Berechnungsbereich — z.B. „Photovoltaikanlage" oder „Dachfenster".
                  Jede Domäne enthält eigene Felder, Formeln, Regeln und Komponenten.
                </p>
                <p className="text-sm text-muted-foreground">
                  Mehrere Domänen können mit denselben Preislisten verknüpft werden.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { icon: Sliders, label: "Felder", desc: "Variablen & Formeln definieren" },
                { icon: FileText, label: "Formular", desc: "Eingabefelder festlegen" },
                { icon: Zap, label: "Regelwerk", desc: "Berechnungsregeln" },
                { icon: ShieldAlert, label: "Validierungen", desc: "Fehler & Warnungen" },
                { icon: Package, label: "Komponenten", desc: "Artikel-Logik" },
                { icon: PlayCircle, label: "Simulator", desc: "Live-Test" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Callout type="info">
              <strong>Tipp:</strong> Du kannst eine bestehende Domäne duplizieren, um schnell eine ähnliche Konfiguration als Ausgangspunkt zu nutzen.
            </Callout>
          </section>

          <Separator />

          {/* ── FIELDS ── */}
          <section className="space-y-6">
            <SectionHeading id="fields" icon={Sliders} title="Felder & Typen" subtitle="Die Bausteine jeder Konfiguration — Eingaben, Berechnungen, Ausgaben" />

            <p className="text-sm text-muted-foreground leading-relaxed">
              Felder sind die <strong className="text-foreground">Variablen</strong> deiner Konfiguration. Jedes Feld hat einen eindeutigen Schlüssel (<code className="text-xs bg-muted px-1 rounded">key</code>),
              der in Formeln und Regeln referenziert wird.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldTypeCard
                icon={Hash}
                color="bg-blue-100 text-blue-600"
                name="Zahl (number)"
                description="Numerische Eingabe. Unterstützt Min/Max-Grenzen und Einheiten."
                example="laenge: 12.5  (Einheit: m)"
              />
              <FieldTypeCard
                icon={Type}
                color="bg-slate-100 text-slate-600"
                name="Text (text)"
                description="Freie Texteingabe für Namen, Beschreibungen oder Bezeichnungen."
                example="kundenname: 'Max Muster'"
              />
              <FieldTypeCard
                icon={List}
                color="bg-violet-100 text-violet-600"
                name="Auswahl (select)"
                description="Dropdown mit vordefinierten Optionen. Ideal für Materialien, Typen etc."
                example='dachtyp: "Satteldach" | "Flachdach"'
              />
              <FieldTypeCard
                icon={ToggleLeft}
                color="bg-emerald-100 text-emerald-600"
                name="Ja/Nein (boolean)"
                description="Schalter für binäre Entscheidungen."
                example="hat_speicher: true / false"
              />
              <FieldTypeCard
                icon={FunctionSquare}
                color="bg-amber-100 text-amber-600"
                name="Formel (formula)"
                description="Berechnet Werte automatisch aus anderen Feldern. Verwendung von Math.*-Funktionen möglich."
                example="dachflaeche: laenge * breite"
              />
              <FieldTypeCard
                icon={Calculator}
                color="bg-rose-100 text-rose-600"
                name="Ausgabe (output)"
                description="Nur-Lese-Feld, das vom Regelwerk beschrieben wird. Nicht im Formular sichtbar."
                example="preis_gesamt → wird durch Regeln gesetzt"
              />
            </div>

            <div className="rounded-2xl border bg-muted/30 p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" /> Formel-Syntax
              </p>
              <p className="text-xs text-muted-foreground">
                Formeln sind JavaScript-Ausdrücke. Feldschlüssel werden direkt als Variablen verwendet.
                Erlaubt sind: Arithmetik, Vergleiche, Math.*-Funktionen.
              </p>
              <CodeBlock>{`// Einfache Berechnung
laenge * breite

// Mit Math-Funktionen
Math.round(laenge * breite * 1.15)

// Bedingter Wert
dachflaeche > 50 ? dachflaeche * 1.1 : dachflaeche`}</CodeBlock>
            </div>

            <Callout type="warning">
              <strong>Reihenfolge beachten:</strong> Formelfelder werden von oben nach unten ausgewertet. Wenn Feld <code className="text-xs bg-white/60 px-1 rounded">B</code> das Feld <code className="text-xs bg-white/60 px-1 rounded">A</code> in seiner Formel referenziert, muss <code className="text-xs bg-white/60 px-1 rounded">A</code> weiter oben in der Liste stehen.
              Der <strong>Auto-Fix</strong>-Button im Felder-Tab sortiert die Felder automatisch in die korrekte Reihenfolge.
            </Callout>

            <div className="rounded-xl border bg-card p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" /> Drag & Drop Sortierung
              </p>
              <p className="text-xs text-muted-foreground">
                Felder können per Drag & Drop umsortiert werden. Beim Ziehen wird live geprüft, ob Formelabhängigkeiten verletzt werden. Ein orangefarbenes Banner weist auf Probleme hin.
              </p>
            </div>
          </section>

          <Separator />

          {/* ── FORM ── */}
          <section className="space-y-6">
            <SectionHeading id="form" icon={FileText} title="Formular" subtitle="Bestimmt welche Felder der Nutzer im Konfigurator eingeben kann" />

            <p className="text-sm text-muted-foreground">
              Nicht alle Felder sind Eingabefelder. Im Formular-Tab wählst du aus, welche Felder dem Nutzer angezeigt werden,
              in welcher Reihenfolge sie erscheinen, und ob einzelne Felder nur unter bestimmten Bedingungen sichtbar sind.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <p className="text-sm font-semibold">Sichtbarkeit steuern</p>
                <p className="text-xs text-muted-foreground">
                  Ein Feld kann mit <strong>„Sichtbar wenn"</strong> konditioniert werden. Es erscheint nur, wenn eine andere Variable einen bestimmten Wert hat.
                </p>
                <div className="rounded-lg bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
                  Zeige <strong>speicher_kapazitaet</strong><br />
                  wenn <strong>hat_speicher</strong> == true
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <p className="text-sm font-semibold">Reihenfolge anpassen</p>
                <p className="text-xs text-muted-foreground">
                  Formularfelder lassen sich per Drag & Drop in eine logische Eingabe-Reihenfolge bringen.
                  Pflichtfelder können als solche markiert werden.
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="rounded bg-muted px-2 py-1 text-[10px] font-medium">Pflichtfeld</div>
                  <div className="rounded bg-muted px-2 py-1 text-[10px] font-medium">Optional</div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── RULES ── */}
          <section className="space-y-6">
            <SectionHeading id="rules" icon={Zap} title="Regelwerk" subtitle="Automatische Berechnungen basierend auf Bedingungen" />

            <p className="text-sm text-muted-foreground leading-relaxed">
              Das Regelwerk erlaubt es, Felder <strong className="text-foreground">bedingt</strong> zu befüllen.
              Du definierst: „Wenn Bedingung X erfüllt ist, setze Feld Y auf Wert Z."
              Das System prüft die Regeln und gibt dem ersten zutreffenden Wert Vorrang (<em>erste zutreffende Regel gewinnt</em>).
            </p>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-sm font-semibold">Beispiel: Modulanzahl-Berechnung</p>
              <div className="space-y-2">
                {[
                  { cond: "dachflaeche ≥ 100", result: "24 Module" },
                  { cond: "dachflaeche ≥ 60", result: "14 Module" },
                  { cond: "dachflaeche ≥ 30", result: "8 Module" },
                  { cond: "(Standard)", result: "4 Module" },
                ].map(({ cond, result }, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <div className={cn(
                      "rounded-lg px-3 py-1.5 font-mono flex-1",
                      i === 3 ? "bg-muted text-muted-foreground" : "bg-primary/5 border border-primary/20 text-foreground"
                    )}>
                      {i < 3 ? `WENN ${cond}` : cond}
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 font-mono text-emerald-700 min-w-24 text-center">
                      {result}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Freitext-Regeln
              </p>
              <p className="text-xs text-muted-foreground">
                Neben Berechnungsregeln gibt es <strong>Freitext-Regeln</strong>: Texte, die dem Nutzer im Konfigurator angezeigt werden, wenn eine Bedingung zutrifft — z.B. Hinweise, Empfehlungen oder Warnmeldungen.
              </p>
            </div>
          </section>

          <Separator />

          {/* ── VALIDATIONS ── */}
          <section className="space-y-6">
            <SectionHeading id="validations" icon={ShieldAlert} title="Validierungen" subtitle="Fehler und Warnungen zum Schutz vor ungültigen Eingaben" />

            <p className="text-sm text-muted-foreground">
              Validierungen prüfen die Eingaben des Nutzers und zeigen Meldungen an, wenn Bedingungen erfüllt sind.
              Es gibt zwei Typen:
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <p className="font-semibold text-sm text-destructive">Fehler</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Blockiert das Absenden des Angebots. Der Nutzer muss die Eingabe korrigieren, bevor er fortfahren kann.
                </p>
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-mono">
                  WENN laenge &lt; 0 → „Länge darf nicht negativ sein"
                </div>
              </div>
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <p className="font-semibold text-sm text-amber-700">Warnung</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zeigt einen Hinweis an, blockiert aber nicht. Gut für Grenzwerte oder unübliche Kombinationen.
                </p>
                <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-mono">
                  WENN laenge &gt; 50 → „Sehr große Länge — prüfen?"
                </div>
              </div>
            </div>

            <Callout type="tip">
              Bedingungen können mit <strong>AND</strong> (alle müssen erfüllt sein) oder <strong>OR</strong> (mindestens eine muss erfüllt sein) verknüpft werden.
            </Callout>
          </section>

          <Separator />

          {/* ── COMPONENTS ── */}
          <section className="space-y-6">
            <SectionHeading id="components" icon={Package} title="Komponenten" subtitle="Verknüpfe Felder mit Preislisten-Artikeln für die automatische Kalkulation" />

            <p className="text-sm text-muted-foreground">
              Komponenten verbinden Berechnungen mit echten Artikeln aus deinen Preislisten. Jede Komponente wird aktiviert, wenn bestimmte Bedingungen erfüllt sind,
              und wählt basierend auf Varianten den passenden Artikel aus.
            </p>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aufbau einer Komponente</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="text-sm font-medium">Aktivierungsbedingung</p>
                    <p className="text-xs text-muted-foreground">Die Komponente wird nur in die Kalkulation aufgenommen, wenn alle Aktivierungsregeln erfüllt sind.</p>
                    <div className="mt-1 rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">hat_speicher == true</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="text-sm font-medium">Menge-Feld</p>
                    <p className="text-xs text-muted-foreground">Ein Feld, das angibt, wie oft dieser Artikel benötigt wird (z.B. Anzahl Module).</p>
                    <div className="mt-1 rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">menge_feld: anzahl_module</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="text-sm font-medium">Varianten</p>
                    <p className="text-xs text-muted-foreground">Je nach Bedingung wird ein anderer Artikel aus der Preisliste gewählt.</p>
                    <div className="mt-1 space-y-1">
                      <div className="rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">WENN modultyp == "Premium" → ART-001</div>
                      <div className="rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">Standard → ART-002</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Callout type="info">
              Im <strong>Simulator</strong> siehst du welche Komponenten aktiv sind, wie viele Einheiten berechnet werden und den resultierenden Einkaufspreis.
            </Callout>
          </section>

          <Separator />

          {/* ── PRICELISTS ── */}
          <section className="space-y-6">
            <SectionHeading id="pricelists" icon={ListChecks} title="Preislisten" subtitle="Verwalte Artikel mit Einkaufspreisen und verknüpfe sie mit Domänen" />

            <div className="flex items-start gap-4 rounded-2xl border bg-card p-5">
              <ListChecks className="h-8 w-8 text-primary mt-1 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Preislisten enthalten <strong className="text-foreground">Artikel mit Einkaufspreisen</strong>. Eine Domäne kann mit einer oder mehreren Preislisten verknüpft werden.
                  Im Simulator und Konfigurator wird automatisch die zugewiesene Preisliste für die Kalkulation verwendet.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 border-b">
                  <tr>
                    <th className="p-3 text-left font-semibold text-muted-foreground">Artikelnummer</th>
                    <th className="p-3 text-left font-semibold text-muted-foreground">Bezeichnung</th>
                    <th className="p-3 text-left font-semibold text-muted-foreground">Einheit</th>
                    <th className="p-3 text-right font-semibold text-muted-foreground">EK-Preis</th>
                    <th className="p-3 text-right font-semibold text-muted-foreground">MwSt</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["ART-001", "Solarmodul 400W Premium", "Stk", "189,00 €", "19%"],
                    ["ART-002", "Solarmodul 400W Standard", "Stk", "142,00 €", "19%"],
                    ["ART-010", "Wechselrichter 5kW", "Stk", "890,00 €", "19%"],
                  ].map(([nr, bez, eh, preis, mwst]) => (
                    <tr key={String(nr)} className="hover:bg-muted/20">
                      <td className="p-3 font-mono text-muted-foreground">{nr}</td>
                      <td className="p-3 font-medium">{bez}</td>
                      <td className="p-3 text-muted-foreground">{eh}</td>
                      <td className="p-3 text-right font-mono">{preis}</td>
                      <td className="p-3 text-right text-muted-foreground">{mwst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout type="tip">
              Preislisten können per <strong>CSV-Import</strong> befüllt werden. Exportiere deine bestehende Preisliste aus Excel und lade sie direkt hoch.
            </Callout>
          </section>

          <Separator />

          {/* ── SIMULATOR ── */}
          <section className="space-y-6">
            <SectionHeading id="simulator" icon={PlayCircle} title="Simulator" subtitle="Teste deine Konfiguration live — ohne echte Angebote zu erstellen" />

            <p className="text-sm text-muted-foreground">
              Der Simulator ist dein Testlabor. Gib beliebige Werte ein und sieh sofort welche Formeln, Regeln und Komponenten aktiv werden.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: Sliders, color: "bg-blue-100 text-blue-600", title: "Eingaben", desc: "Alle Formularfelder testweise befüllen" },
                { icon: Calculator, color: "bg-amber-100 text-amber-600", title: "Berechnete Werte", desc: "Formelfelder und Regelwerk-Ergebnisse in Kacheln" },
                { icon: Package, color: "bg-emerald-100 text-emerald-600", title: "Aktive Komponenten", desc: "Welche Artikel aktiv sind und was sie kosten" },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            <Callout type="tip">
              Validierungs-Fehler und Warnungen werden im Simulator live angezeigt — genau so wie sie später dem Nutzer im Konfigurator erscheinen.
            </Callout>
          </section>

          <Separator />

          {/* ── CONFIGURATOR ── */}
          <section className="space-y-6">
            <SectionHeading id="configurator" icon={ShoppingCart} title="Konfigurator" subtitle="Das Werkzeug für Verkäufer — Angebote in wenigen Klicks berechnen" />

            <p className="text-sm text-muted-foreground">
              Der Konfigurator ist die Nutzeroberfläche für den täglichen Einsatz. Verkäufer wählen eine Domäne, füllen das Formular aus und erhalten sofort eine vollständige Kalkulation.
            </p>

            <div className="space-y-0">
              <FlowStep number={1} title="Domäne auswählen" description="Wähle den passenden Konfigurationsbereich, z.B. Photovoltaikanlage oder Dachfenster." />
              <FlowStep number={2} title="Formular ausfüllen" description="Gib die projektspezifischen Werte ein. Dynamisch sichtbare Felder erscheinen je nach Kontext." />
              <FlowStep number={3} title="Kalkulation prüfen" description="Das System berechnet automatisch alle Werte, aktiviert die passenden Artikel und zeigt den Gesamtpreis." />
              <FlowStep number={4} title="Angebot exportieren" description="Das fertige Angebot kann exportiert oder als Vorlage gespeichert werden." />
            </div>

            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <RoleBadge role="SELLER" />
                <span className="text-xs text-muted-foreground">Für alle Rollen verfügbar</span>
              </div>
              <p className="text-xs text-emerald-700">
                Der Konfigurator ist für alle Nutzer zugänglich — Verkäufer, Domain-Admins und Super-Admins können Angebote erstellen.
              </p>
            </div>
          </section>

          <Separator />

          {/* ── API ── */}
          <section className="space-y-6">
            <SectionHeading id="api" icon={Globe} title="API & Integration" subtitle="Externe Systeme anbinden — nur für Super Admins" />

            <div className="flex items-center gap-2 mb-2">
              <RoleBadge role="SUPER_ADMIN" />
              <span className="text-xs text-muted-foreground">Nur für Super Admins</span>
            </div>

            <p className="text-sm text-muted-foreground">
              Die Angebots-Engine stellt eine REST-API bereit, über die externe Systeme Domänen und Preislisten lesen und Konfigurationen ausführen können.
              Zugriff erfolgt über <strong className="text-foreground">API-Keys</strong>, die im Admin-Bereich erstellt werden.
            </p>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verfügbare Endpunkte</p>
              <div className="space-y-2">
                {[
                  { method: "GET", path: "/api/external/domains", desc: "Alle aktiven Domänen abrufen" },
                  { method: "GET", path: "/api/external/domains/:id", desc: "Konfiguration einer Domäne" },
                  { method: "GET", path: "/api/external/pricelists", desc: "Alle aktiven Preislisten" },
                  { method: "GET", path: "/api/external/pricelists/:id", desc: "Artikel einer Preisliste" },
                ].map(({ method, path, desc }) => (
                  <div key={path} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-[10px] font-bold font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{method}</span>
                    <code className="text-xs font-mono text-foreground flex-1">{path}</code>
                    <span className="text-xs text-muted-foreground hidden sm:block">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Authentifizierung
              </p>
              <p className="text-xs text-muted-foreground">
                Alle API-Anfragen müssen einen gültigen API-Key im <code className="bg-muted px-1 rounded text-[11px]">Authorization</code>-Header mitsenden.
              </p>
              <CodeBlock>{`// HTTP-Header
Authorization: Bearer ae_live_xxxxxxxxxxxxxxxxxx

// Beispiel mit curl
curl https://deine-domain.de/api/external/domains \\
  -H "Authorization: Bearer ae_live_xxx..."`}</CodeBlock>
            </div>

            <Callout type="warning">
              API-Keys haben vollen Lesezugriff auf alle aktiven Domänen und Preislisten. Teile sie nicht öffentlich und widerrufe kompromittierte Keys sofort.
            </Callout>
          </section>

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
