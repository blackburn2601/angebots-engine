import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { DomainService } from "@/services/DomainService";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkApiRateLimit(ip)) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });

  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const { id } = await params;
  const domain = await DomainService.findByIdWithPricelists(id);
  if (!domain) return NextResponse.json({ error: "Domäne nicht gefunden" }, { status: 404 });

  return NextResponse.json({
    id: domain.id,
    name: domain.name,
    slug: domain.slug,
    updated_at: domain.updated_at,
    pricelist_ids: domain.pricelists.map((p) => p.pricelistId),
    config: DomainService.parseConfig(domain.config_json),
  });
}
