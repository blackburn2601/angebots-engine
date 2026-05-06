import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { UserActions } from "./user-actions";
import { NewUserDialog } from "./new-user-dialog";

const ROLLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  DOMAIN_ADMIN: "Administrator",
  SELLER: "Verkäufer",
};

export default async function UsersPage() {
  await requireRole("SUPER_ADMIN");

  const users = await prisma.user.findMany({ orderBy: { erstellt_am: "asc" } });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Benutzerverwaltung</h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} Benutzer</p>
        </div>
        <NewUserDialog />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="p-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="p-3 text-left font-medium text-muted-foreground">E-Mail</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Rolle</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Letzter Login</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/20">
                <td className="p-3 font-medium">{user.name}</td>
                <td className="p-3 text-muted-foreground">{user.email}</td>
                <td className="p-3">
                  <Badge variant={user.rolle === "SUPER_ADMIN" ? "default" : "secondary"}>
                    {ROLLE_LABELS[user.rolle] ?? user.rolle}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant={user.aktiv ? "success" : "destructive"}>
                    {user.aktiv ? "Aktiv" : "Deaktiviert"}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground">{formatDateTime(user.letzter_login)}</td>
                <td className="p-3 text-right">
                  <UserActions userId={user.id} aktiv={user.aktiv} rolle={user.rolle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
