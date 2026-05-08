import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { UserService } from "@/services/UserService";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  rolle: z.enum(["SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER"]).optional(),
  aktiv: z.boolean().optional(),
  muss_pw_aendern: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const sessionRolle = (session.user as { rolle: string }).rolle;
  const sessionId = session.user.id;
  const { id } = await params;

  const isSelf = sessionId === id;
  if (!isSelf && sessionRolle !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  if (sessionRolle !== "SUPER_ADMIN") {
    if (parsed.data.rolle !== undefined || parsed.data.aktiv !== undefined || parsed.data.muss_pw_aendern !== undefined) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
  }

  const user = await UserService.update(id, parsed.data as Record<string, unknown>);
  return NextResponse.json({ id: (user as { id: string }).id });
}
