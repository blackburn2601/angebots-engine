import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { DomainConfig } from "@/types/domain";

export class DomainService {
  static findAll() {
    return prisma.domain.findMany({ orderBy: { updated_at: "desc" } });
  }

  static findAllWithCount() {
    return prisma.domain.findMany({
      orderBy: { erstellt_am: "desc" },
      include: { _count: { select: { pricelists: true } } },
    });
  }

  static findAllForConfigurator() {
    return prisma.domain.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { pricelists: true } } },
    });
  }

  static findById(id: string) {
    return prisma.domain.findUnique({ where: { id } });
  }

  static findByIdWithPricelists(id: string) {
    return prisma.domain.findUnique({
      where: { id },
      include: { pricelists: { include: { pricelist: true } } },
    });
  }

  static findByIdWithCount(id: string) {
    return prisma.domain.findUnique({
      where: { id },
      include: { _count: { select: { pricelists: true } } },
    });
  }

  static async create(name: string) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.domain.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    return prisma.domain.create({ data: { name, slug } });
  }

  static update(id: string, data: { name?: string; config_json?: string }) {
    return prisma.domain.update({ where: { id }, data });
  }

  static delete(id: string) {
    return prisma.domain.delete({ where: { id } });
  }

  static async duplicate(id: string, name?: string) {
    const source = await prisma.domain.findUniqueOrThrow({ where: { id } });
    const newName = name?.trim() || `${source.name} (Kopie)`;
    const baseSlug = slugify(newName);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.domain.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    return prisma.domain.create({
      data: { name: newName, slug, config_json: source.config_json },
    });
  }

  static parseConfig(configJson: string): DomainConfig {
    try {
      return JSON.parse(configJson);
    } catch {
      return { felder: [], parameter: [], validierungen: [], regelwerk: [], komponenten: [] };
    }
  }
}
