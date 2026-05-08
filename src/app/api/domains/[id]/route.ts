import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { DomainService } from "@/services/DomainService";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config_json: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  if (parsed.data.config_json) {
    try { JSON.parse(parsed.data.config_json); } catch {
      return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
    }
  }

  const domain = await DomainService.update(id, parsed.data);
  return NextResponse.json(domain);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const rolle = (session.user as { rolle: string }).rolle;
  if (rolle !== "SUPER_ADMIN") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  await DomainService.delete(id);
  return NextResponse.json({ ok: true });
}
