import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

export default async function ConfiguratorIndexPage() {
  await requireAuth();

  const domains = await prisma.domain.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { pricelists: true } } },
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Konfigurator</h1>
        <p className="mt-1 text-sm text-muted-foreground">Wähle eine Domäne, um ein Angebot zu erstellen</p>
      </div>

      {domains.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          Noch keine Domänen konfiguriert
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((d) => (
            <Link key={d.id} href={`/configurator/${d.id}`}>
              <div className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{d.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {d._count.pricelists} Preisliste{d._count.pricelists !== 1 ? "n" : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
