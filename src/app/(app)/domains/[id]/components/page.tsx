import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { ComponentsEditor } from "./components-editor";
import type { DomainConfig } from "@/types/domain";

export default async function ComponentsPage({ params }: { params: { id: string } }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  const { id } = params;

  const domain = await prisma.domain.findUnique({
    where: { id },
    include: { pricelists: { include: { pricelist: true } } },
  });
  if (!domain) notFound();

  const config: DomainConfig = JSON.parse(domain.config_json);

  const allePricelists = domain.pricelists.map((dp) => dp.pricelist);
  const alleArtikel = allePricelists.flatMap((pl) => {
    try {
      return JSON.parse(pl.items_json) as { artikel_nr: string; bezeichnung: string }[];
    } catch {
      return [];
    }
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Komponenten</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Definiere welche Produkte ins Angebot kommen, wann und welchen Artikel aus der Preisliste sie verwenden
        </p>
      </div>
      <ComponentsEditor domainId={id} initialConfig={config} alleArtikel={alleArtikel} />
    </div>
  );
}
