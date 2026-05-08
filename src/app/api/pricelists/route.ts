import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { PricelistService } from "@/services/PricelistService";

const createSchema = z.object({ name: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const pl = await PricelistService.create(parsed.data.name);
  return NextResponse.json(pl, { status: 201 });
}
