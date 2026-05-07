import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PricelistEditor } from "./pricelist-editor";
import type { PreisItem } from "@/types/domain";

export default async function PricelistPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  const { id } = await params;

  const pricelist = await prisma.pricelist.findUnique({
    where: { id },
    include: {
      domains: { include: { domain: { select: { id: true, name: true } } } },
    },
  });
  if (!pricelist) notFound();

  const allDomains = await prisma.domain.findMany({ select: { id: true, name: true } });

  let items: PreisItem[] = [];
  try { items = JSON.parse(pricelist.items_json); } catch {}

  return (
    <div className="p-8">
      <PricelistEditor
        pricelist={{
          id: pricelist.id,
          name: pricelist.name,
          aktiv: pricelist.aktiv,
          gueltig_ab: pricelist.gueltig_ab?.toISOString() ?? null,
          gueltig_bis: pricelist.gueltig_bis?.toISOString() ?? null,
          items,
          domainIds: pricelist.domains.map((d) => d.domainId),
        }}
        allDomains={allDomains}
      />
    </div>
  );
}
