import { requireRole } from "@/lib/auth-helpers";
import { NewDomainForm } from "./new-domain-form";

export default async function NewDomainPage() {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  return (
    <div className="mx-auto max-w-lg p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Neue Domäne anlegen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gib deiner neuen Produktdomäne einen Namen
        </p>
      </div>
      <NewDomainForm />
    </div>
  );
}
