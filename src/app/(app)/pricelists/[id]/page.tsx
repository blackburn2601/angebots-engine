import { requireRole } from "@/lib/auth-helpers";
import { PricelistService } from "@/services/PricelistService";
import { DomainService } from "@/services/DomainService";
import { notFound } from "next/navigation";
import { PricelistEditor } from "./pricelist-editor";

export default async function PricelistPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  const { id } = await params;

  const [pricelist, allDomains] = await Promise.all([
    PricelistService.findByIdWithDomains(id),
    PricelistService.findAllForDomains(),
  ]);
  if (!pricelist) notFound();

  return (
    <div className="p-8">
      <PricelistEditor
        pricelist={{
          id: pricelist.id,
          name: pricelist.name,
          aktiv: pricelist.aktiv,
          gueltig_ab: pricelist.gueltig_ab?.toISOString() ?? null,
          gueltig_bis: pricelist.gueltig_bis?.toISOString() ?? null,
          items: PricelistService.parseItems(pricelist.items_json),
          domainIds: pricelist.domains.map((d) => d.domainId),
        }}
        allDomains={allDomains}
      />
    </div>
  );
}
