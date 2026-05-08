import { requireRole } from "@/lib/auth-helpers";
import { DomainService } from "@/services/DomainService";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, LayoutGrid, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DomainConfig } from "@/types/domain";
import { formatDate } from "@/lib/utils";
import { DomainCardActions } from "./domain-card-actions";

function getDomainStats(configJson: string) {
  try {
    const config: DomainConfig = JSON.parse(configJson);
    const felder = config.felder?.length ?? 0;
    const regelwerk = config.regelwerk?.filter((r) => !("typ" in r && r.typ === "freitext")).length ?? 0;
    const komponenten = config.komponenten?.length ?? 0;

    const outputFelder = config.felder?.filter((f) => f.typ === "output").map((f) => f.key) ?? [];
    const regelZiele = config.regelwerk
      ?.filter((r) => !("typ" in r && r.typ === "freitext"))
      .map((r) => ("ziel_feld" in r ? r.ziel_feld : null))
      .filter(Boolean) ?? [];

    const fehlendRegel = outputFelder.filter((k) => !regelZiele.includes(k)).length;

    return { felder, regelwerk, komponenten, fehlendRegel };
  } catch {
    return { felder: 0, regelwerk: 0, komponenten: 0, fehlendRegel: 0 };
  }
}

export default async function DomainsPage() {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER");

  const domains = await DomainService.findAllWithCount();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Domänen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Konfiguriere Produktbereiche für die Angebotserstellung
          </p>
        </div>
        <Link href="/domains/new">
          <Button>
            <Plus className="h-4 w-4" />
            Neue Domäne
          </Button>
        </Link>
      </div>

      {domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <LayoutGrid className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold">Noch keine Domänen</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Erstelle deine erste Domäne, um loszulegen
          </p>
          <Link href="/domains/new" className="mt-4">
            <Button>
              <Plus className="h-4 w-4" />
              Erste Domäne anlegen
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain) => {
            const stats = getDomainStats(domain.config_json);
            return (
              <div
                key={domain.id}
                className="group relative flex flex-col rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/domains/${domain.id}/dashboard`}
                  className="absolute inset-0 rounded-xl z-0"
                  aria-label={`${domain.name} konfigurieren`}
                />

                <div className="relative z-10 p-5 pointer-events-none">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-semibold">{domain.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Aktualisiert {formatDate(domain.updated_at)}
                      </p>
                    </div>
                    {stats.fehlendRegel > 0 ? (
                      <Badge variant="warning">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {stats.fehlendRegel} Warnung{stats.fehlendRegel > 1 ? "en" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        OK
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-lg font-semibold">{stats.felder}</p>
                      <p className="text-xs text-muted-foreground">Felder</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-lg font-semibold">{stats.regelwerk}</p>
                      <p className="text-xs text-muted-foreground">Regeln</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-lg font-semibold">{stats.komponenten}</p>
                      <p className="text-xs text-muted-foreground">Komp.</p>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex gap-2 px-5 pb-5">
                  <Link href={`/domains/${domain.id}/dashboard`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full gap-1.5">
                      <Settings2 className="h-3.5 w-3.5" />
                      Konfigurieren
                    </Button>
                  </Link>
                  <DomainCardActions domainId={domain.id} domainName={domain.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
