import { requireAuth } from "@/lib/auth-helpers";
import { canManageUsers, canManageApiKeys, canManagePricelists } from "@/lib/auth-helpers";
import { DashboardService } from "@/services/DashboardService";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid, ListChecks, ShoppingCart, Users, Key, Activity,
  Zap, Plus, ArrowRight, TrendingUp, Clock, CheckCircle2,
  Webhook, BookOpen, LayoutDashboard,
} from "lucide-react";

function greeting(name: string) {
  const hour = new Date().getUTCHours() + 1;
  if (hour >= 5 && hour < 11) return `Guten Morgen, ${name}!`;
  if (hour >= 11 && hour < 18) return `Guten Tag, ${name}!`;
  if (hour >= 18 && hour < 22) return `Guten Abend, ${name}!`;
  return `Hallo, ${name}!`;
}

export default async function DashboardPage() {
  const user = await requireAuth();

  const [stats, recentDomains, recentLogs] = await Promise.all([
    DashboardService.getStats(user.rolle),
    DashboardService.getRecentDomains(),
    DashboardService.getRecentLogs(),
  ]);

  const statsCards = [
    {
      icon: LayoutGrid,
      label: "Domänen",
      value: stats.domains,
      href: "/domains",
      color: "bg-blue-50 text-blue-600",
      available: true,
    },
    {
      icon: ListChecks,
      label: "Preislisten",
      value: stats.pricelists,
      href: "/pricelists",
      color: "bg-violet-50 text-violet-600",
      available: canManagePricelists(user.rolle),
    },
    {
      icon: Users,
      label: "Benutzer",
      value: stats.users ?? "–",
      href: "/admin/users",
      color: "bg-emerald-50 text-emerald-600",
      available: canManageUsers(user.rolle),
    },
    {
      icon: Key,
      label: "API-Keys",
      value: stats.apiKeys ?? "–",
      href: "/admin/api-keys",
      color: "bg-amber-50 text-amber-600",
      available: canManageApiKeys(user.rolle),
    },
    {
      icon: Webhook,
      label: "Webhooks",
      value: stats.webhooks,
      href: "/admin/webhooks",
      color: "bg-rose-50 text-rose-600",
      available: canManageUsers(user.rolle) || canManagePricelists(user.rolle),
    },
  ].filter((c) => c.available);

  const quickActions = [
    { icon: Plus, label: "Neue Domäne", href: "/domains/new", color: "bg-blue-500 hover:bg-blue-600" },
    { icon: ShoppingCart, label: "Konfigurator", href: "/configurator", color: "bg-violet-500 hover:bg-violet-600" },
    { icon: BookOpen, label: "Dokumentation", href: "/docs", color: "bg-emerald-500 hover:bg-emerald-600" },
    ...(canManagePricelists(user.rolle) ? [{ icon: ListChecks, label: "Neue Preisliste", href: "/pricelists/new", color: "bg-amber-500 hover:bg-amber-600" }] : []),
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-violet-500/5 p-6 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{greeting(user.name ?? "")}</h1>
            <p className="mt-1 text-muted-foreground">
              Du bist angemeldet als <strong>{user.email}</strong> –{" "}
              <span className="inline-block rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-medium">
                {user.rolle.replace(/_/g, " ")}
              </span>
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/configurator">
              <Button>
                <ShoppingCart className="h-4 w-4" />
                Konfigurator öffnen
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute right-6 bottom-4 grid grid-cols-5 gap-1.5 opacity-20 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary" />
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Übersicht
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statsCards.map(({ icon: Icon, label, value, href, color }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg mb-3 ${color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors">{label}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Zuletzt bearbeitet
            </h2>
            <Link href="/domains" className="text-xs text-primary hover:underline flex items-center gap-1">
              Alle anzeigen <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {recentDomains.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <LayoutGrid className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Noch keine Domänen vorhanden
              </div>
            ) : (
              <ul className="divide-y">
                {recentDomains.map((domain) => (
                  <li key={domain.id}>
                    <Link
                      href={`/domains/${domain.id}/fields`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <LayoutGrid className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">{domain.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{domain.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(domain.updated_at).toLocaleDateString("de-DE")}
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canManageApiKeys(user.rolle) && recentLogs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Letzte API-Anfragen
                </h2>
                <Link href="/admin/logs" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Alle Logs <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <ul className="divide-y">
                  {recentLogs.map((log) => (
                    <li key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${
                        log.method === "GET" ? "bg-blue-100 text-blue-700" :
                        log.method === "POST" ? "bg-emerald-100 text-emerald-700" :
                        "bg-muted text-muted-foreground"
                      }`}>{log.method}</span>
                      <span className="font-mono flex-1 truncate text-muted-foreground">{log.path}</span>
                      {log.status_code && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          log.status_code < 300 ? "bg-emerald-100 text-emerald-700" :
                          log.status_code < 500 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>{log.status_code}</span>
                      )}
                      {log.duration_ms != null && (
                        <span className="text-muted-foreground">{log.duration_ms}ms</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4" /> Schnellzugriff
          </h2>
          <div className="space-y-2">
            {quickActions.map(({ icon: Icon, label, href, color }) => (
              <Link key={href} href={href}>
                <div className={`rounded-xl p-4 text-white cursor-pointer transition-all duration-150 ${color} flex items-center gap-3 hover:scale-[1.01] hover:shadow-md`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">{label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 opacity-70" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
