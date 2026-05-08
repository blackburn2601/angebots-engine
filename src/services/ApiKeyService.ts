import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export class ApiKeyService {
  static findAll() {
    return prisma.apiKey.findMany({ orderBy: { erstellt_am: "desc" } });
  }

  static async create(label: string) {
    const rawKey = `eak_live_${crypto.randomBytes(24).toString("hex")}`;
    const key_hash = await bcrypt.hash(rawKey, 10);
    const key_prefix = rawKey.slice(0, 17);
    await prisma.apiKey.create({ data: { label, key_hash, key_prefix } });
    return rawKey;
  }

  static revoke(id: string) {
    return prisma.apiKey.update({ where: { id }, data: { aktiv: false } });
  }
}
