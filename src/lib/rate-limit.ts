import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remainingMs?: number }> {
  const since = new Date(Date.now() - WINDOW_MS);
  const attempts = await prisma.loginAttempt.count({
    where: {
      ip,
      success: false,
      zeitstempel: { gte: since },
    },
  });

  if (attempts >= MAX_ATTEMPTS) {
    const oldest = await prisma.loginAttempt.findFirst({
      where: { ip, success: false, zeitstempel: { gte: since } },
      orderBy: { zeitstempel: "asc" },
    });
    const remainingMs = oldest
      ? WINDOW_MS - (Date.now() - oldest.zeitstempel.getTime())
      : WINDOW_MS;
    return { allowed: false, remainingMs };
  }

  return { allowed: true };
}

export async function recordLoginAttempt(ip: string, email: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { ip, email, success } });

  // cleanup old records
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({ where: { zeitstempel: { lt: cutoff } } });
}
