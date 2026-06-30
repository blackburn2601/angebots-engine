"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Code2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { DeveloperDoc } from "@/generated/developer-docs";
import styles from "./developer-docs.module.css";

interface DeveloperDocsClientProps {
  docs: DeveloperDoc[];
}

export function DeveloperDocsClient({ docs }: DeveloperDocsClientProps) {
  const [active, setActive] = useState(docs[0]?.slug ?? "");
  const [query, setQuery] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll-spy: highlight the doc currently in view.
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-15% 0px -75% 0px" }
    );
    docs.forEach(({ slug }) => {
      const el = document.getElementById(slug);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [docs]);

  const filtered = query.trim()
    ? docs.filter(({ title, html }) => {
        const q = query.toLowerCase();
        return title.toLowerCase().includes(q) || html.toLowerCase().includes(q);
      })
    : docs;

  return (
    <div className="flex min-h-screen">
      {/* Sticky sidebar nav */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen border-r bg-card overflow-y-auto py-6">
        <div className="px-2 mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 pr-7 h-8 text-xs"
              placeholder="Suchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                onClick={() => setQuery("")}
                aria-label="Suche zurücksetzen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {query ? `${filtered.length} Treffer` : "Inhaltsverzeichnis"}
        </p>
        <nav className="space-y-0.5 px-2">
          {filtered.map(({ slug, title }) => (
            <a
              key={slug}
              href={`#${slug}`}
              onClick={() => { setActive(slug); setQuery(""); }}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active === slug
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {title}
            </a>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Keine Treffer für &quot;{query}&quot;
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
                <Code2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Angebots-Engine</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Entwickler-Dokumentation</h1>
            <p className="mt-2 text-base text-muted-foreground max-w-xl">
              Vollständige technische Referenz — Architektur, Engine, API, Datenbank,
              Deployment und mehr.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Nur für Super-Admins sichtbar
            </div>
          </div>
        </div>

        {/* Stacked doc sections */}
        <div className="px-6 py-8 lg:px-10 max-w-4xl">
          {docs.map(({ slug, html }) => (
            <section key={slug} id={slug} className={cn("scroll-mt-6 mb-16", styles.doc)}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
