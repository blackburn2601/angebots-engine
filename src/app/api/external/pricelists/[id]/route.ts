import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkApiRateLimit(ip)) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });

  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const { id } = await params;
  const pl = await prisma.pricelist.findUnique({ where: { id } });
  if (!pl) return NextResponse.json({ error: "Preisliste nicht gefunden" }, { status: 404 });

  let items;
  try { items = JSON.parse(pl.items_json); } catch { items = []; }

  return NextResponse.json({ ...pl, items });
}
