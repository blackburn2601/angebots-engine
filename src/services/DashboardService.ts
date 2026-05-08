import { prisma } from "@/lib/prisma";

export class DashboardService {
  static async getStats(rolle: string) {
    const canSeeUsers = rolle === "SUPER_ADMIN";
    const canSeeApiKeys = rolle === "SUPER_ADMIN";

    const [domains, pricelists, users, apiKeys, webhooks] = await Promise.all([
      prisma.domain.count(),
      prisma.pricelist.count(),
      canSeeUsers ? prisma.user.count() : Promise.resolve(null),
      canSeeApiKeys ? prisma.apiKey.count({ where: { aktiv: true } }) : Promise.resolve(null),
      prisma.webhookUrl.count({ where: { aktiv: true } }),
    ]);

    return { domains, pricelists, users, apiKeys, webhooks };
  }

  static getRecentDomains() {
    return prisma.domain.findMany({
      orderBy: { updated_at: "desc" },
      take: 5,
      select: { id: true, name: true, slug: true, updated_at: true },
    });
  }

  static getRecentLogs() {
    return prisma.apiLog.findMany({
      orderBy: { zeitstempel: "desc" },
      take: 8,
      select: {
        id: true,
        method: true,
        path: true,
        status_code: true,
        duration_ms: true,
        zeitstempel: true,
      },
    });
  }
}
