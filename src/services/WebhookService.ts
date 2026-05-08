import { prisma } from "@/lib/prisma";

export class WebhookService {
  static findAll() {
    return prisma.webhookUrl.findMany({ orderBy: { erstellt_am: "desc" } });
  }

  static create(data: { label: string; url: string; description?: string; aktiv?: boolean }) {
    return prisma.webhookUrl.create({ data });
  }

  static update(
    id: string,
    data: { label?: string; url?: string; description?: string | null; aktiv?: boolean }
  ) {
    return prisma.webhookUrl.update({ where: { id }, data });
  }

  static delete(id: string) {
    return prisma.webhookUrl.delete({ where: { id } });
  }
}
