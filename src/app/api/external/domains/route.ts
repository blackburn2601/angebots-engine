import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { prisma } from "@/lib/prisma";
import { withLogging } from "@/lib/api-logger";

async function handler(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkApiRateLimit(ip)) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });

  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const domains = await prisma.domain.findMany({
    select: { id: true, name: true, slug: true, updated_at: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(domains);
}

export const GET = withLogging(handler);
