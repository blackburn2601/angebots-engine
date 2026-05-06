import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  rolle: z.enum(["SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER"]).optional(),
  aktiv: z.boolean().optional(),
  muss_pw_aendern: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const sessionRolle = (session.user as { rolle: string }).rolle;
  const sessionId = session.user.id;

  const { id } = params;

  // Users can update their own password; super admin can update anyone
  const isSelf = sessionId === id;
  if (!isSelf && sessionRolle !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    data.password = await bcrypt.hash(parsed.data.password, 12);
    data.muss_pw_aendern = false;
    delete data.password;
    // actually keep the hash
    const hash = await bcrypt.hash(parsed.data.password, 12);
    (data as { password?: string }).password = hash;
  }

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ id: user.id });
}
