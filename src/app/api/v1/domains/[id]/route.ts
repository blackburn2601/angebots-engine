import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { DomainService } from "@/services/DomainService";
import { ok, apiError } from "@/lib/api-response";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config_json: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const { id } = await params;
  const domain = await DomainService.findByIdWithPricelists(id);
  if (!domain) return apiError("Nicht gefunden", 404);

  return ok({
    id: domain.id,
    name: domain.name,
    slug: domain.slug,
    config_json: domain.config_json,
    updated_at: domain.updated_at,
    pricelist_ids: domain.pricelists.map((p) => p.pricelistId),
  });
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

  if (parsed.data.config_json) {
    try { JSON.parse(parsed.data.config_json); } catch {
      return apiError("Ungültiges JSON", 400);
    }
  }

  const domain = await DomainService.update(id, parsed.data);
  return ok(domain);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const rolle = (session.user as { rolle: string }).rolle;
  if (rolle !== "SUPER_ADMIN") return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  await DomainService.delete(id);
  return ok({ ok: true });
}
