import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function authenticateApiKey(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const rawKey = authHeader.slice(7);

  // Find by prefix to narrow candidates
  const prefix = rawKey.slice(0, 17);
  const candidates = await prisma.apiKey.findMany({
    where: { key_prefix: prefix, aktiv: true },
  });

  for (const candidate of candidates) {
    const valid = await bcrypt.compare(rawKey, candidate.key_hash);
    if (valid) {
      await prisma.apiKey.update({
        where: { id: candidate.id },
        data: { letzter_zugriff: new Date() },
      });
      return true;
    }
  }
  return false;
}
