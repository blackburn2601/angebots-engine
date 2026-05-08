import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { DomainService } from "@/services/DomainService";
import { withLogging } from "@/lib/api-logger";

async function handler(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkApiRateLimit(ip)) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });

  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const domains = await DomainService.findAll();
  return NextResponse.json(
    domains.map((d) => ({ id: d.id, name: d.name, slug: d.slug, updated_at: d.updated_at }))
  );
}

export const GET = withLogging(handler);
