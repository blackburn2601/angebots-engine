import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ListChecks } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function PricelistsPage() {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");

  const pricelists = await prisma.pricelist.findMany({
    orderBy: { erstellt_am: "desc" },
    include: { _count: { select: { domains: true } } },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Preislisten</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verwalte Artikelpreise für die Kalkulation</p>
        </div>
        <Link href="/pricelists/new">
          <Button>
            <Plus className="h-4 w-4" />
            Neue Preisliste
          </Button>
        </Link>
      </div>

      {pricelists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
          <ListChecks className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="font-semibold">Noch keine Preislisten</h3>
          <p className="mt-1 text-sm text-muted-foreground">Erstelle deine erste Preisliste</p>
          <Link href="/pricelists/new" className="mt-4">
            <Button><Plus className="h-4 w-4" />Erste Preisliste</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Gültig von</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Gültig bis</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Positionen</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Domänen</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {pricelists.map((pl) => {
                let itemCount = 0;
                try { itemCount = JSON.parse(pl.items_json).length; } catch {}
                return (
                  <tr key={pl.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{pl.name}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(pl.gueltig_ab)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(pl.gueltig_bis)}</td>
                    <td className="p-3">{itemCount}</td>
                    <td className="p-3">{pl._count.domains}</td>
                    <td className="p-3">
                      <Badge variant={pl.aktiv ? "success" : "secondary"}>
                        {pl.aktiv ? "Aktiv" : "Archiviert"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/pricelists/${pl.id}`}>
                        <Button variant="ghost" size="sm">Bearbeiten</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
