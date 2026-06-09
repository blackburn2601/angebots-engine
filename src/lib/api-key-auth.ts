import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Returns the API key ID on success, null on failure
export async function authenticateApiKey(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const rawKey = authHeader.slice(7);

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
      return candidate.id;
    }
  }
  return null;
}
