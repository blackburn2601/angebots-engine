import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Code2, RefreshCw, Database, Globe, Key, Users, Webhook } from "lucide-react";
import { ConfigViewerClient } from "./config-viewer-client";

export default async function ConfigPage() {
  await requireRole("SUPER_ADMIN");

  // Gather application-wide configuration (no secrets!)
  const [domains, pricelists, users, apiKeys, webhooks, appSettings] =
    await Promise.all([
      prisma.domain.count(),
      prisma.pricelist.count(),
      prisma.user.count(),
      prisma.apiKey.count({ where: { aktiv: true } }),
      prisma.webhookUrl.findMany({ select: { id: true, label: true, url: true, aktiv: true } }),
      prisma.appSetting.findMany(),
    ]);

  const config = {
    meta: {
      app: "angebots-engine",
      version: "0.1.0",
      environment: process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    },
    stats: {
      domains,
      pricelists,
      users,
      api_keys_active: apiKeys,
    },
    webhooks: webhooks.map((w) => ({
      id: w.id,
      label: w.label,
      url: w.url,
      aktiv: w.aktiv,
    })),
    settings: Object.fromEntries(appSettings.map((s) => [s.key, s.value])),
    features: {
      api_logging: true,
      webhook_management: true,
      config_viewer: true,
      global_dashboard: true,
      docs_search: true,
    },
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Code2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">JSON Config Viewer</h1>
          <p className="text-sm text-muted-foreground">Gesamte App-Konfiguration als JSON</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Globe, label: "Domänen", value: domains, color: "text-blue-500 bg-blue-50" },
          { icon: Database, label: "Preislisten", value: pricelists, color: "text-violet-500 bg-violet-50" },
          { icon: Users, label: "Benutzer", value: users, color: "text-emerald-500 bg-emerald-50" },
          { icon: Key, label: "Aktive API-Keys", value: apiKeys, color: "text-amber-500 bg-amber-50" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <ConfigViewerClient config={config} />
    </div>
  );
}
