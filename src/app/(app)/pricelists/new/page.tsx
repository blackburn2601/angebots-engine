import { requireRole } from "@/lib/auth-helpers";
import { NewPricelistForm } from "./new-pricelist-form";

export default async function NewPricelistPage() {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  return (
    <div className="mx-auto max-w-lg p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Neue Preisliste</h1>
      </div>
      <NewPricelistForm />
    </div>
  );
}
