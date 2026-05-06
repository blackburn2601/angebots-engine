import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  rolle: z.enum(["SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const rolle = (session.user as { rolle: string }).rolle;
  if (rolle !== "SUPER_ADMIN") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });

  const hash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { ...parsed.data, password: hash, muss_pw_aendern: true },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
