import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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

  const rawKey = `eak_live_${crypto.randomBytes(24).toString("hex")}`;
  const key_hash = await bcrypt.hash(rawKey, 10);
  const key_prefix = rawKey.slice(0, 17);

  await prisma.apiKey.create({
    data: { label: parsed.data.label, key_hash, key_prefix },
  });

  return NextResponse.json({ key: rawKey }, { status: 201 });
}
