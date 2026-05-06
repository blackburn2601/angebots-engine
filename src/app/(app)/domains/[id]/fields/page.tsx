import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { FieldsEditor } from "./fields-editor";
import type { DomainConfig } from "@/types/domain";

export default async function FieldsPage({ params }: { params: { id: string } }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  const { id } = params;

  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) notFound();

  const config: DomainConfig = JSON.parse(domain.config_json);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Felder</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Definiere alle Datenfelder dieser Domäne — Eingaben, Berechnungen und Ergebnisse
        </p>
      </div>
      <FieldsEditor domainId={id} initialConfig={config} />
    </div>
  );
}
