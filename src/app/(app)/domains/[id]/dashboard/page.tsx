import { DomainService } from "@/services/DomainService";
import { requireRole } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2, AlertTriangle, XCircle, ArrowRight, Play,
  ListChecks, Settings2, Zap, Package
} from "lucide-react";
import type { DomainConfig, RegelGruppe } from "@/types/domain";

interface CheckItem {
  label: string;
  status: "ok" | "warning" | "error";
  message: string;
  action?: { href: string; label: string };
}

function buildHealthCheck(config: DomainConfig, pricelistCount: number): CheckItem[] {
  const checks: CheckItem[] = [];

  const eingabeFelder = config.felder?.filter((f) =>
    ["number", "text", "select", "boolean"].includes(f.typ)
  ) ?? [];
  checks.push({
    label: "Eingabefelder",
    status: eingabeFelder.length > 0 ? "ok" : "error",
    message: eingabeFelder.length > 0
      ? `${eingabeFelder.length} Eingabefeld${eingabeFelder.length !== 1 ? "er" : ""} definiert`
      : "Mindestens ein Eingabefeld ist erforderlich",
    action: eingabeFelder.length === 0 ? { href: "fields", label: "Felder anlegen" } : undefined,
  });

  const parameter = config.parameter ?? [];
  checks.push({
    label: "Formular",
    status: parameter.length > 0 ? "ok" : "warning",
    message: parameter.length > 0
      ? `${parameter.length} Formularfeld${parameter.length !== 1 ? "er" : ""} konfiguriert`
      : "Noch keine Formularfelder definiert",
    action: parameter.length === 0 ? { href: "form", label: "Formular konfigurieren" } : undefined,
  });

  const outputFelder = config.felder?.filter((f) => f.typ === "output").map((f) => f.key) ?? [];
  const regelGruppen = (config.regelwerk ?? []).filter(
    (r): r is RegelGruppe => !("typ" in r && r.typ === "freitext")
  );
  const regelZiele = regelGruppen.map((r) => r.ziel_feld);
  const ohneRegel = outputFelder.filter((k) => !regelZiele.includes(k));
  const ohneKorrektFallback = regelGruppen.filter((g) => {
    const letzte = g.regeln[g.regeln.length - 1];
    return !letzte || letzte.bedingungen.length > 0;
  });

  if (outputFelder.length === 0) {
    checks.push({ label: "Regelwerk", status: "ok", message: "Keine berechneten Felder, kein Regelwerk benötigt" });
  } else if (ohneRegel.length > 0) {
    checks.push({
      label: "Regelwerk",
      status: "error",
      message: `${ohneRegel.length} Feld${ohneRegel.length !== 1 ? "er" : ""} ohne Regel: ${ohneRegel.join(", ")}`,
      action: { href: "rules", label: "Regelwerk öffnen" },
    });
  } else if (ohneKorrektFallback.length > 0) {
    checks.push({
      label: "Regelwerk",
      status: "warning",
      message: `${ohneKorrektFallback.length} Regelgruppe${ohneKorrektFallback.length !== 1 ? "n" : ""} ohne Standardwert`,
      action: { href: "rules", label: "Regelwerk öffnen" },
    });
  } else {
    checks.push({ label: "Regelwerk", status: "ok", message: `${regelGruppen.length} Regelgruppe${regelGruppen.length !== 1 ? "n" : ""} korrekt konfiguriert` });
  }

  const komponenten = config.komponenten ?? [];
  const ohneVariante = komponenten.filter((k) => !k.varianten?.length);
  if (komponenten.length === 0) {
    checks.push({
      label: "Komponenten",
      status: "warning",
      message: "Noch keine Komponenten angelegt",
      action: { href: "components", label: "Komponenten anlegen" },
    });
  } else if (ohneVariante.length > 0) {
    checks.push({
      label: "Komponenten",
      status: "warning",
      message: `${ohneVariante.length} Komponente${ohneVariante.length !== 1 ? "n" : ""} ohne Variante`,
      action: { href: "components", label: "Komponenten bearbeiten" },
    });
  } else {
    checks.push({ label: "Komponenten", status: "ok", message: `${komponenten.length} Komponente${komponenten.length !== 1 ? "n" : ""} konfiguriert` });
  }

  checks.push({
    label: "Preislisten",
    status: pricelistCount > 0 ? "ok" : "warning",
    message: pricelistCount > 0
      ? `${pricelistCount} Preisliste${pricelistCount !== 1 ? "n" : ""} zugewiesen`
      : "Keine Preisliste zugewiesen",
    action: pricelistCount === 0 ? { href: "/pricelists", label: "Preisliste zuweisen" } : undefined,
  });

  return checks;
}

export default async function DomainDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER");
  const { id } = await params;

  const domain = await DomainService.findByIdWithCount(id);
  if (!domain) notFound();

  const config: DomainConfig = DomainService.parseConfig(domain.config_json);
  const checks = buildHealthCheck(config, domain._count.pricelists);
  const errors = checks.filter((c) => c.status === "error");
  const warnings = checks.filter((c) => c.status === "warning");
  const allOk = errors.length === 0 && warnings.length === 0;

  const statusIcon = {
    ok: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Konfigurationsstand</p>
          {allOk ? (
            <div className="mt-1 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">Alles in Ordnung</span>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              {errors.length > 0 ? (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="font-semibold text-destructive">
                    {errors.length} Fehler, {warnings.length} Warnung{warnings.length !== 1 ? "en" : ""}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="font-semibold text-amber-700">
                    {warnings.length} Hinweis{warnings.length !== 1 ? "e" : ""}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/domains/${id}/simulator`}>
            <Button variant="outline" size="sm">
              <Play className="h-4 w-4" />
              Simulator
            </Button>
          </Link>
          <Link href={`/configurator/${id}`}>
            <Button size="sm">
              <Zap className="h-4 w-4" />
              Konfigurator
            </Button>
          </Link>
        </div>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <Alert variant={errors.length > 0 ? "destructive" : "warning"} className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {errors.length > 0
              ? "Kritische Fehler müssen behoben werden"
              : "Empfehlungen für eine vollständige Konfiguration"}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {[...errors, ...warnings].map((check) => (
                <li key={check.label} className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    <strong>{check.label}:</strong> {check.message}
                    {check.action && (
                      <Link
                        href={check.action.href.startsWith("/") ? check.action.href : `/domains/${id}/${check.action.href}`}
                        className="ml-2 underline underline-offset-2"
                      >
                        {check.action.label} →
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((check) => (
          <div key={check.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              {statusIcon[check.status]}
              <span className="font-medium text-sm">{check.label}</span>
              <Badge
                variant={check.status === "ok" ? "success" : check.status === "warning" ? "warning" : "destructive"}
                className="ml-auto"
              >
                {check.status === "ok" ? "OK" : check.status === "warning" ? "Hinweis" : "Fehler"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{check.message}</p>
            {check.action && (
              <Link
                href={check.action.href.startsWith("/") ? check.action.href : `/domains/${id}/${check.action.href}`}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {check.action.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { href: "fields", label: "Felder bearbeiten", icon: Settings2 },
          { href: "form", label: "Formular konfigurieren", icon: ListChecks },
          { href: "rules", label: "Regelwerk", icon: Zap },
          { href: "components", label: "Komponenten", icon: Package },
        ].map((action) => (
          <Link key={action.href} href={`/domains/${id}/${action.href}`}>
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm transition-shadow hover:shadow-md cursor-pointer">
              <action.icon className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">{action.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
