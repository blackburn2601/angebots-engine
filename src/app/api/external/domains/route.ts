import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authorized = await authenticateApiKey(req.headers.get("authorization"));
  if (!authorized) return NextResponse.json({ error: "Ungültiger oder fehlender API-Key" }, { status: 401 });

  const domains = await prisma.domain.findMany({
    select: { id: true, name: true, slug: true, updated_at: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(domains);
}
