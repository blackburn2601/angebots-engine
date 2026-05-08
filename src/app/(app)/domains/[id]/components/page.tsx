import { DomainService } from "@/services/DomainService";
import { PricelistService } from "@/services/PricelistService";
import { requireRole } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { ComponentsEditor } from "./components-editor";

export default async function ComponentsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  const { id } = await params;

  const domain = await DomainService.findByIdWithPricelists(id);
  if (!domain) notFound();

  const config = DomainService.parseConfig(domain.config_json);

  const alleArtikel = domain.pricelists.flatMap((dp) =>
    PricelistService.parseItems(dp.pricelist.items_json).map((item) => ({
      artikel_nr: item.artikel_nr,
      bezeichnung: item.bezeichnung,
    }))
  );

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
