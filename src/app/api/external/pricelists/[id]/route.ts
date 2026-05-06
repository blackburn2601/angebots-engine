import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const { id } = params;
  const pl = await prisma.pricelist.findUnique({ where: { id } });
  if (!pl) return NextResponse.json({ error: "Preisliste nicht gefunden" }, { status: 404 });

  let items;
  try { items = JSON.parse(pl.items_json); } catch { items = []; }

  return NextResponse.json({ ...pl, items });
}
