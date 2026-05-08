import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { ApiKeyService } from "@/services/ApiKeyService";

const createSchema = z.object({ label: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if ((session.user as { rolle: string }).rolle !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const rawKey = await ApiKeyService.create(parsed.data.label);
  return NextResponse.json({ key: rawKey }, { status: 201 });
}
