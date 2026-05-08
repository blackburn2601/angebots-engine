import { prisma } from "@/lib/prisma";
import type { PreisItem } from "@/types/domain";

export class PricelistService {
  static findAll() {
    return prisma.pricelist.findMany({
      orderBy: { erstellt_am: "desc" },
      include: { _count: { select: { domains: true } } },
    });
  }

  static findById(id: string) {
    return prisma.pricelist.findUnique({ where: { id } });
  }

  static findByIdWithDomains(id: string) {
    return prisma.pricelist.findUnique({
      where: { id },
      include: { domains: { include: { domain: { select: { id: true, name: true } } } } },
    });
  }

  static findAllForDomains() {
    return prisma.domain.findMany({ select: { id: true, name: true } });
  }

  static create(name: string) {
    return prisma.pricelist.create({ data: { name } });
  }

  static async update(
    id: string,
    data: { name?: string; aktiv?: boolean; items_json?: string; domainIds?: string[] }
  ) {
    const { domainIds, ...rest } = data;
    await prisma.$transaction(async (tx) => {
      if (Object.keys(rest).length > 0) {
        await tx.pricelist.update({ where: { id }, data: rest });
      }
      if (domainIds !== undefined) {
        await tx.domainPricelist.deleteMany({ where: { pricelistId: id } });
        if (domainIds.length > 0) {
          await tx.domainPricelist.createMany({
            data: domainIds.map((domainId) => ({ domainId, pricelistId: id })),
          });
        }
      }
    });
    return prisma.pricelist.findUnique({ where: { id } });
  }

  static delete(id: string) {
    return prisma.pricelist.delete({ where: { id } });
  }

  static parseItems(itemsJson: string): PreisItem[] {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  }
}
