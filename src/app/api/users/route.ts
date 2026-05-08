import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { UserService } from "@/services/UserService";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  rolle: z.enum(["SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if ((session.user as { rolle: string }).rolle !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const exists = await UserService.findByEmail(parsed.data.email);
  if (exists) return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });

  const user = await UserService.create(parsed.data);
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
