import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { PricelistService } from "@/services/PricelistService";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  aktiv: z.boolean().optional(),
  items_json: z.string().optional(),
  domainIds: z.array(z.string()).optional(),
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

  if (parsed.data.items_json !== undefined) {
    try { JSON.parse(parsed.data.items_json); } catch {
      return NextResponse.json({ error: "Ungültiges JSON in items_json" }, { status: 400 });
    }
  }

  const updated = await PricelistService.update(id, parsed.data);
  return NextResponse.json(updated);
}
