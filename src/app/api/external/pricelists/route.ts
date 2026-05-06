import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const pricelists = await prisma.pricelist.findMany({
    where: { aktiv: true },
    select: { id: true, name: true, gueltig_ab: true, gueltig_bis: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(pricelists);
}
