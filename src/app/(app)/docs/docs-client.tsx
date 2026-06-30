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
  Database, Webhook, Terminal,
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
  { id: "pricelists", label: "Preislisten", icon: ListChecks },
  { id: "components", label: "Komponenten", icon: Package },
  { id: "simulator", label: "Simulator", icon: PlayCircle },
  { id: "configurator", label: "Konfigurator", icon: ShoppingCart },
  { id: "api", label: "API v1", icon: Globe },
  { id: "database", label: "Datenbank", icon: Database },
];

// Keywords for each section used in search
const SECTION_KEYWORDS: Record<string, string[]> = {
  overview: ["überblick", "einführung", "architektur", "was ist", "reihenfolge", "schritt"],
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
  api: ["api", "integration", "rest", "endpunkt", "auth", "key", "bearer", "v1", "headless", "cors", "engine", "run", "n8n", "webhook", "curl"],
  database: ["datenbank", "postgresql", "postgres", "docker", "migration", "prisma", "sql"],
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
              Alles was du wissen musst, von der Grundkonfiguration bis zur API-Integration.
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
              Statt jedes Angebot manuell zu kalkulieren, definierst du einmal die Berechnungslogik, und der Konfigurator erledigt den Rest.
            </p>

            {/* Architecture visual */}
            <div className="rounded-2xl border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">Konfigurationsreihenfolge</p>
              <div className="space-y-0">
                <FlowStep number={1} title="Felder anlegen" description="Alle Variablen der Domäne definieren: Eingaben (number, text, select, boolean), Formeln (formula) und Ausgaben (output). Formeln und Ausgaben werden durch Regelwerk befüllt." />
                <FlowStep number={2} title="Formular konfigurieren" description="Festlegen welche Felder der Nutzer sieht, in welcher Reihenfolge und ob Felder nur unter bestimmten Bedingungen sichtbar sind." />
                <FlowStep number={3} title="Regelwerk aufbauen" description="Berechnungsregeln für output-Felder definieren: Welcher Wert wird gesetzt, wenn welche Bedingung zutrifft." />
                <FlowStep number={4} title="Validierungen hinzufügen" description="Fehler und Warnungen definieren, die bei ungültigen Eingaben angezeigt werden sollen." />
                <FlowStep number={5} title="Preisliste anlegen und verknüpfen" description="Artikel mit Einkaufspreisen importieren und die Preisliste der Domäne zuweisen. Voraussetzung für Komponenten." />
                <FlowStep number={6} title="Komponenten konfigurieren" description="Felder mit Preislisten-Artikeln verknüpfen. Jede Komponente wird nur aktiviert wenn ihre Bedingungen erfüllt sind." />
                <FlowStep number={7} title="Im Simulator testen" description="Testdaten eingeben und prüfen ob alle Berechnungen, Regeln und Komponenten wie erwartet funktionieren." />
              </div>
            </div>

            <Callout type="warning">
              Die Reihenfolge ist wichtig: Felder zuerst, Preislisten vor Komponenten. Ohne Felder kann kein Formular, Regelwerk oder Komponenten konfiguriert werden.
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
                  Eine <strong className="text-foreground">Domäne</strong> ist ein vollständig konfigurierter Berechnungsbereich, z.B. „Photovoltaikanlage" oder „Dachfenster".
                  Jede Domäne enthält eigene Felder, Formeln, Regeln und Komponenten.
                </p>
                <p className="text-sm text-muted-foreground">
                  Mehrere Domänen können mit denselben Preislisten verknüpft werden.
                </p>
              </div>
            </div>

            <Callout type="tip">
              <strong>Tipp:</strong> Du kannst eine bestehende Domäne duplizieren, um schnell eine ähnliche Konfiguration als Ausgangspunkt zu nutzen. Die vollständige Konfigurationsreihenfolge findest du im <a href="#overview" className="underline font-medium">Überblick</a>.
            </Callout>
          </section>

          <Separator />

          {/* ── FIELDS ── */}
          <section className="space-y-6">
            <SectionHeading id="fields" icon={Sliders} title="Felder & Typen" subtitle="Die Bausteine jeder Konfiguration: Eingaben, Berechnungen, Ausgaben" />

            <Callout type="info">
              <strong>Schritt 1 von 7.</strong> Felder sind die Grundlage. Alle anderen Bausteine (Formular, Regelwerk, Komponenten) referenzieren Felder. Lege hier zuerst alle Variablen der Domäne an, bevor du weiter konfigurierst.
            </Callout>

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

            <Callout type="info">
              <strong>Schritt 2 von 7.</strong> Alle Felder müssen bereits angelegt sein. Im Formular-Tab wählst du aus, welche davon der Nutzer sieht.
            </Callout>

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

            <Callout type="info">
              <strong>Schritt 3 von 7.</strong> Das Regelwerk befüllt <strong>output</strong>-Felder basierend auf Bedingungen. Output-Felder müssen zuerst im Felder-Tab angelegt worden sein.
            </Callout>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Das Regelwerk erlaubt es, Felder <strong className="text-foreground">bedingt</strong> zu befüllen.
              Du definierst: „Wenn Bedingung X erfüllt ist, setze Feld Y auf Wert Z."
              Das System prüft die Regeln von oben nach unten und gibt dem <strong className="text-foreground">ersten zutreffenden Wert Vorrang</strong>. Die restlichen Regeln werden dann nicht mehr geprüft.
            </p>

            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Wie die Engine Regeln auswertet</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex gap-3 items-start">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</div>
                  <p><strong className="text-foreground">Eingaben</strong> des Nutzers werden eingesammelt (alle Formularfelder).</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</div>
                  <p><strong className="text-foreground">Formelfelder</strong> (<code className="bg-muted px-1 rounded">formula</code>) werden berechnet, in der Reihenfolge wie sie in der Feldliste stehen (oben nach unten).</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</div>
                  <p><strong className="text-foreground">Regelgruppen</strong> werden ausgewertet: Für jedes <code className="bg-muted px-1 rounded">output</code>-Feld wird die erste passende Regel angewendet. Trifft keine Regel zu, greift der Standardwert.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">4</div>
                  <p><strong className="text-foreground">Freitext-Regeln</strong> werden geprüft: Alle Regeln, bei denen die Bedingung zutrifft, erzeugen einen Hinweistext für den Nutzer. Es gewinnt nicht nur eine, sondern alle passenden Texte werden angezeigt.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">5</div>
                  <p><strong className="text-foreground">Validierungen</strong> werden geprüft: Fehler blockieren das Absenden, Warnungen werden als Hinweis angezeigt.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">6</div>
                  <p><strong className="text-foreground">Komponenten</strong> werden aktiviert: Jede Komponente prüft ihre Aktivierungsbedingung. Wenn sie zutrifft, wird der passende Artikel aus der Preisliste ausgewählt und mit dem Menge-Feld multipliziert.</p>
                </div>
              </div>
            </div>

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
                Neben Berechnungsregeln gibt es <strong>Freitext-Regeln</strong>: Texte, die dem Nutzer im Konfigurator angezeigt werden, wenn eine Bedingung zutrifft, z.B. Hinweise, Empfehlungen oder Warnmeldungen.
                Im Gegensatz zu Berechnungsregeln (wo nur die erste Regel gewinnt) werden <strong>alle zutreffenden Freitext-Regeln</strong> gleichzeitig angezeigt.
              </p>
            </div>
          </section>

          <Separator />

          {/* ── VALIDATIONS ── */}
          <section className="space-y-6">
            <SectionHeading id="validations" icon={ShieldAlert} title="Validierungen" subtitle="Fehler und Warnungen zum Schutz vor ungültigen Eingaben" />

            <Callout type="info">
              <strong>Schritt 4 von 7.</strong> Validierungen referenzieren Felder. Alle relevanten Felder müssen zuerst angelegt sein.
            </Callout>

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
                  WENN laenge &gt; 50 → „Sehr große Länge, prüfen?"
                </div>
              </div>
            </div>

            <Callout type="tip">
              Bedingungen können mit <strong>AND</strong> (alle müssen erfüllt sein) oder <strong>OR</strong> (mindestens eine muss erfüllt sein) verknüpft werden.
            </Callout>
          </section>

          <Separator />

          {/* ── PRICELISTS ── */}
          <section className="space-y-6">
            <SectionHeading id="pricelists" icon={ListChecks} title="Preislisten" subtitle="Verwalte Artikel mit Einkaufspreisen und verknüpfe sie mit Domänen" />

            <Callout type="info">
              <strong>Schritt 5 von 7.</strong> Preislisten müssen vor den Komponenten angelegt sein, da Komponenten Artikel aus einer Preisliste referenzieren.
            </Callout>

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

          {/* ── COMPONENTS ── */}
          <section className="space-y-6">
            <SectionHeading id="components" icon={Package} title="Komponenten" subtitle="Verknüpfe Felder mit Preislisten-Artikeln für die automatische Kalkulation" />

            <Callout type="warning">
              <strong>Schritt 6 von 7. Voraussetzung:</strong> Eine Preisliste muss bereits angelegt und der Domäne zugewiesen sein. Außerdem muss ein Feld existieren, das die Menge liefert (z.B. <code className="bg-white/60 px-1 rounded text-[11px]">anzahl_module</code>).
            </Callout>

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

          {/* ── SIMULATOR ── */}
          <section className="space-y-6">
            <SectionHeading id="simulator" icon={PlayCircle} title="Simulator" subtitle="Teste deine Konfiguration live, ohne echte Angebote zu erstellen" />

            <Callout type="info">
              <strong>Schritt 7 von 7.</strong> Der Simulator zeigt das vollständige Ergebnis der Engine: berechnete Felder, aktive Komponenten, Validierungsmeldungen und Freitext-Regeln auf einen Blick.
            </Callout>

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
              Validierungs-Fehler und Warnungen werden im Simulator live angezeigt, genau so wie sie später dem Nutzer im Konfigurator erscheinen.
            </Callout>
          </section>

          <Separator />

          {/* ── CONFIGURATOR ── */}
          <section className="space-y-6">
            <SectionHeading id="configurator" icon={ShoppingCart} title="Konfigurator" subtitle="Das Werkzeug für Verkäufer: Angebote in wenigen Klicks berechnen" />

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
                Der Konfigurator ist für alle Nutzer zugänglich. Verkäufer, Domain-Admins und Super-Admins können Angebote erstellen.
              </p>
            </div>
          </section>

          <Separator />

          {/* ── API ── */}
          <section className="space-y-6">
            <SectionHeading id="api" icon={Globe} title="REST API v1" subtitle="Vollständige headless API für externe Systeme, Automatisierungen und eigene Frontends" />

            <div className="flex items-center gap-2">
              <RoleBadge role="SUPER_ADMIN" />
              <span className="text-xs text-muted-foreground">API-Keys werden nur von Super Admins erstellt</span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Alle Funktionen der Angebots-Engine sind über eine versionierte REST-API unter <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/api/v1/</code> erreichbar.
              Externe Systeme wie <strong className="text-foreground">n8n</strong>, eigene Frontends oder andere Werkzeuge können darüber vollständig auf Domänen, Preislisten, Benutzer und die Berechnungs-Engine zugreifen.
              CORS ist aktiviert, die erlaubten Origins werden per Umgebungsvariable gesteuert.
            </p>

            {/* Auth */}
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Authentifizierung
              </p>
              <p className="text-xs text-muted-foreground">
                API-Keys werden im Admin-Bereich erstellt. Jede Anfrage muss den Key als Bearer-Token im <code className="bg-muted px-1 rounded text-[11px]">Authorization</code>-Header übermitteln.
              </p>
              <CodeBlock>{`Authorization: Bearer ae_live_xxxxxxxxxxxxxxxxxx

# Beispiel mit curl
curl https://deine-domain.de/api/v1/domains \\
  -H "Authorization: Bearer ae_live_xxx..."`}</CodeBlock>
            </div>

            {/* Engine endpoint highlight */}
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold">Engine-Endpunkt: der Kern der Integration</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mit <code className="bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded font-mono">POST /api/v1/domains/:id/run</code> führst du die vollständige Berechnungslogik einer Domäne aus,
                inklusive Regelwerk, Formeln, Validierungen und Komponenten-Kalkulation.
                Das Ergebnis entspricht exakt dem, was der Simulator im Browser anzeigt.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Request</p>
                  <CodeBlock>{`POST /api/v1/domains/:id/run

{
  "inputs": {
    "leistung_kwp": 10,
    "dachtyp": "satteldach",
    "hat_speicher": true
  },
  "preis_items": [
    {
      "id": "ART-001",
      "name": "Modul 400W",
      "ek_preis": 120.00
    }
  ]
}`}</CodeBlock>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Response</p>
                  <CodeBlock>{`{
  "data": {
    "outputs": {
      "preis_gesamt": 2880,
      "anzahl_module": 24
    },
    "components": [
      {
        "id": "komp_1",
        "active": true,
        "menge": 24,
        "ek_preis": 120.00
      }
    ],
    "validations": [],
    "texts": []
  }
}`}</CodeBlock>
                </div>
              </div>
            </div>

            {/* Endpoint table */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alle Endpunkte im Überblick</p>

              {([
                {
                  group: "Domänen",
                  color: "bg-blue-100 text-blue-700",
                  endpoints: [
                    { method: "GET", path: "/api/v1/domains", desc: "Alle Domänen abrufen" },
                    { method: "POST", path: "/api/v1/domains", desc: "Neue Domäne erstellen" },
                    { method: "GET", path: "/api/v1/domains/:id", desc: "Einzelne Domäne abrufen" },
                    { method: "PATCH", path: "/api/v1/domains/:id", desc: "Domäne aktualisieren" },
                    { method: "DELETE", path: "/api/v1/domains/:id", desc: "Domäne löschen" },
                    { method: "POST", path: "/api/v1/domains/:id/duplicate", desc: "Domäne duplizieren" },
                    { method: "POST", path: "/api/v1/domains/:id/run", desc: "Regelwerk ausführen (Engine)" },
                  ],
                },
                {
                  group: "Preislisten",
                  color: "bg-violet-100 text-violet-700",
                  endpoints: [
                    { method: "GET", path: "/api/v1/pricelists", desc: "Alle Preislisten" },
                    { method: "POST", path: "/api/v1/pricelists", desc: "Neue Preisliste erstellen" },
                    { method: "GET", path: "/api/v1/pricelists/:id", desc: "Preisliste mit Artikeln" },
                    { method: "PATCH", path: "/api/v1/pricelists/:id", desc: "Preisliste aktualisieren" },
                    { method: "DELETE", path: "/api/v1/pricelists/:id", desc: "Preisliste löschen" },
                  ],
                },
                {
                  group: "Benutzer",
                  color: "bg-emerald-100 text-emerald-700",
                  endpoints: [
                    { method: "GET", path: "/api/v1/users", desc: "Alle Benutzer (Super Admin)" },
                    { method: "POST", path: "/api/v1/users", desc: "Benutzer anlegen (Super Admin)" },
                    { method: "PATCH", path: "/api/v1/users/:id", desc: "Benutzer bearbeiten (Super Admin)" },
                  ],
                },
                {
                  group: "API-Keys",
                  color: "bg-amber-100 text-amber-700",
                  endpoints: [
                    { method: "GET", path: "/api/v1/api-keys", desc: "Alle API-Keys (Super Admin)" },
                    { method: "POST", path: "/api/v1/api-keys", desc: "Neuen Key erstellen (Super Admin)" },
                    { method: "DELETE", path: "/api/v1/api-keys/:id", desc: "Key widerrufen (Super Admin)" },
                  ],
                },
                {
                  group: "Dashboard & Admin",
                  color: "bg-slate-100 text-slate-700",
                  endpoints: [
                    { method: "GET", path: "/api/v1/dashboard/stats", desc: "Statistik-Übersicht" },
                    { method: "GET", path: "/api/v1/admin/logs", desc: "API-Anfragen-Log" },
                    { method: "DELETE", path: "/api/v1/admin/logs", desc: "Log leeren" },
                    { method: "GET", path: "/api/v1/admin/webhooks", desc: "Webhooks abrufen" },
                    { method: "POST", path: "/api/v1/admin/webhooks", desc: "Webhook anlegen" },
                    { method: "PATCH", path: "/api/v1/admin/webhooks/:id", desc: "Webhook aktualisieren" },
                    { method: "DELETE", path: "/api/v1/admin/webhooks/:id", desc: "Webhook löschen" },
                  ],
                },
              ] as { group: string; color: string; endpoints: { method: string; path: string; desc: string }[] }[]).map(({ group, color, endpoints }) => (
                <div key={group} className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/40 border-b">
                    <p className="text-xs font-semibold text-muted-foreground">{group}</p>
                  </div>
                  <div className="divide-y">
                    {endpoints.map(({ method, path, desc }) => {
                      const methodColor =
                        method === "GET" ? "bg-blue-100 text-blue-700" :
                        method === "POST" ? "bg-emerald-100 text-emerald-700" :
                        method === "PATCH" ? "bg-amber-100 text-amber-700" :
                        method === "DELETE" ? "bg-red-100 text-red-700" : color;
                      return (
                        <div key={`${method}-${path}`} className="flex items-center gap-3 px-4 py-2">
                          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 w-14 text-center ${methodColor}`}>{method}</span>
                          <code className="text-xs font-mono text-foreground flex-1 truncate">{path}</code>
                          <span className="text-xs text-muted-foreground hidden sm:block shrink-0">{desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Callout type="warning">
              API-Keys haben vollen Zugriff auf alle Daten und Operationen der Engine. Teile sie nicht öffentlich und widerrufe kompromittierte Keys sofort im Admin-Bereich unter <strong>Admin → API-Keys</strong>.
            </Callout>
          </section>

          <Separator />

          {/* ── DATABASE ── */}
          <section className="space-y-6">
            <SectionHeading id="database" icon={Database} title="Datenbank & Infrastruktur" subtitle="PostgreSQL via Docker, produktionsreif von Anfang an" />

            <p className="text-sm text-muted-foreground leading-relaxed">
              Die Angebots-Engine verwendet <strong className="text-foreground">PostgreSQL 16</strong> als Datenbank.
              Für die lokale Entwicklung wird die Datenbank über Docker bereitgestellt, kein manuelles Installieren erforderlich.
            </p>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" /> Datenbank starten
              </p>
              <CodeBlock>{`# PostgreSQL-Container starten (einmalig oder nach Neustart)
docker compose up -d

# Status prüfen
docker compose ps

# Logs ansehen
docker compose logs postgres`}</CodeBlock>
              <p className="text-xs text-muted-foreground">
                Die Daten werden in einem Docker-Volume gespeichert und bleiben auch nach einem Neustart erhalten.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: Database, color: "bg-blue-100 text-blue-600", title: "PostgreSQL 16", desc: "Produktions­bewährte relationale Datenbank" },
                { icon: Layers, color: "bg-violet-100 text-violet-600", title: "Prisma ORM", desc: "Typsicherer Datenbankzugriff mit Migrationen" },
                { icon: Package, color: "bg-emerald-100 text-emerald-600", title: "Docker Volume", desc: "Persistente Datenspeicherung ohne manuelle Verwaltung" },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold">Verbindungsparameter (lokal)</p>
              <CodeBlock>{`# .env
DATABASE_URL="postgresql://angebots:secret@localhost:5432/angebots_engine"

# Docker Compose Standard-Zugangsdaten
Host:     localhost
Port:     5432
Benutzer: angebots
Passwort: secret
Datenbank: angebots_engine`}</CodeBlock>
              <p className="text-xs text-muted-foreground">
                Für Produktionsumgebungen sollte <code className="bg-muted px-1 rounded text-[11px]">DATABASE_URL</code> auf eine gesicherte externe Datenbankinstanz zeigen.
              </p>
            </div>

            <Callout type="info">
              Domänen-Konfigurationen und Preislisten-Artikel werden als JSON in der Datenbank gespeichert. Die Berechnungs-Engine liest diese Daten zur Laufzeit, Schemaänderungen an der Konfigurationsstruktur erfordern daher keine Datenbankmigrationen.
            </Callout>
          </section>

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
