import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { SimulatorClient } from "./simulator-client";
import type { DomainConfig } from "@/types/domain";

export default async function SimulatorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER");
  const { id } = await params;

  const domain = await prisma.domain.findUnique({
    where: { id },
    include: { pricelists: { include: { pricelist: true } } },
  });
  if (!domain) notFound();

  const config: DomainConfig = JSON.parse(domain.config_json);

  const allePricelists = domain.pricelists.map((dp) => ({
    id: dp.pricelist.id,
    name: dp.pricelist.name,
    items: (() => {
      try { return JSON.parse(dp.pricelist.items_json); } catch { return []; }
    })(),
  }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Live-Simulator</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Teste die Konfiguration mit eigenen Werten — vollständig im Browser
        </p>
      </div>
      <SimulatorClient config={config} pricelists={allePricelists} />
    </div>
  );
}
