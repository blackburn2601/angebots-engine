import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { NewApiKeyDialog } from "./new-api-key-dialog";
import { RevokeKeyButton } from "./revoke-key-button";

export default async function ApiKeysPage() {
  await requireRole("SUPER_ADMIN");

  const keys = await prisma.apiKey.findMany({ orderBy: { erstellt_am: "desc" } });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API-Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Für externe Systeme wie n8n — Authentifizierung via Bearer Token
          </p>
        </div>
        <NewApiKeyDialog />
      </div>

      {keys.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          Noch keine API-Keys — erstelle einen für n8n oder andere externe Systeme
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">Label</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Präfix</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Erstellt</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Letzter Zugriff</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium">{key.label}</td>
                  <td className="p-3">
                    <code className="rounded bg-muted px-2 py-0.5 text-xs">{key.key_prefix}…</code>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(key.erstellt_am)}</td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(key.letzter_zugriff)}</td>
                  <td className="p-3">
                    <Badge variant={key.aktiv ? "success" : "destructive"}>
                      {key.aktiv ? "Aktiv" : "Widerrufen"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    {key.aktiv && <RevokeKeyButton keyId={key.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
