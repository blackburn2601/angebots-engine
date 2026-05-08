import { DomainService } from "@/services/DomainService";
import { requireRole } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { FormEditor } from "./form-editor";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  const { id } = await params;

  const domain = await DomainService.findById(id);
  if (!domain) notFound();

  const config = DomainService.parseConfig(domain.config_json);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Formular</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lege fest, welche Felder dem Nutzer im Konfigurator angezeigt werden und in welcher Reihenfolge
        </p>
      </div>
      <FormEditor domainId={id} initialConfig={config} />
    </div>
  );
}
