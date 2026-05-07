import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ConfiguratorClient } from "./configurator-client";
import type { DomainConfig, PreisItem } from "@/types/domain";

export default async function ConfiguratorPage({ params }: { params: Promise<{ domain_id: string }> }) {
  await requireAuth();
  const { domain_id } = await params;

  const domain = await prisma.domain.findUnique({
    where: { id: domain_id },
    include: { pricelists: { include: { pricelist: true } } },
  });
  if (!domain) notFound();

  const config: DomainConfig = JSON.parse(domain.config_json);
  const pricelists = domain.pricelists
    .filter((dp) => dp.pricelist.aktiv)
    .map((dp) => ({
      id: dp.pricelist.id,
      name: dp.pricelist.name,
      items: (() => {
        try { return JSON.parse(dp.pricelist.items_json) as PreisItem[]; } catch { return []; }
      })(),
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
