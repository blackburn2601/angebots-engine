import { requireAuth } from "@/lib/auth-helpers";
import { DomainService } from "@/services/DomainService";
import { PricelistService } from "@/services/PricelistService";
import { notFound } from "next/navigation";
import { ConfiguratorClient } from "./configurator-client";
import type { PreisItem } from "@/types/domain";

export default async function ConfiguratorPage({ params }: { params: Promise<{ domain_id: string }> }) {
  await requireAuth();
  const { domain_id } = await params;

  const domain = await DomainService.findByIdWithPricelists(domain_id);
  if (!domain) notFound();

  const config = DomainService.parseConfig(domain.config_json);

  const pricelists = domain.pricelists
    .filter((dp) => dp.pricelist.aktiv)
    .map((dp) => ({
      id: dp.pricelist.id,
      name: dp.pricelist.name,
      items: PricelistService.parseItems(dp.pricelist.items_json) as PreisItem[],
    }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{domain.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Konfiguriere ein Angebot</p>
      </div>
      <ConfiguratorClient domainId={domain_id} domainName={domain.name} config={config} pricelists={pricelists} />
    </div>
  );
}
