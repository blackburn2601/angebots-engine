import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkApiRateLimit(ip)) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });

  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const { id } = params;
  const domain = await prisma.domain.findUnique({
    where: { id },
    include: { pricelists: { select: { pricelistId: true } } },
  });

  if (!domain) return NextResponse.json({ error: "Domäne nicht gefunden" }, { status: 404 });

  let config;
  try { config = JSON.parse(domain.config_json); } catch { config = {}; }

  return NextResponse.json({
    id: domain.id,
    name: domain.name,
    slug: domain.slug,
    updated_at: domain.updated_at,
    pricelist_ids: domain.pricelists.map((p) => p.pricelistId),
    config,
  });
}
