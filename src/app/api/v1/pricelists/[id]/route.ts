import { auth } from "@/lib/auth";
import { z } from "zod";
import { PricelistService } from "@/services/PricelistService";
import { ok, apiError } from "@/lib/api-response";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  aktiv: z.boolean().optional(),
  items_json: z.string().optional(),
  domainIds: z.array(z.string()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const { id } = await params;
  const pl = await PricelistService.findById(id);
  if (!pl) return apiError("Nicht gefunden", 404);

  return ok({ ...pl, items: PricelistService.parseItems(pl.items_json) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return apiError("Keine Berechtigung", 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Ungültige Eingabe", 400);

  if (parsed.data.items_json !== undefined) {
    try { JSON.parse(parsed.data.items_json); } catch {
      return apiError("Ungültiges JSON in items_json", 400);
    }
  }

  const updated = await PricelistService.update(id, parsed.data);
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return apiError("Keine Berechtigung", 403);
  }

  const { id } = await params;
  await PricelistService.delete(id);
  return ok({ ok: true });
}
