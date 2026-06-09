import { z } from "zod";
import { DomainService } from "@/services/DomainService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config_json: z.string().optional(),
});

export const GET = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);

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
});

export const PATCH = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  if (parsed.data.config_json) {
    try { JSON.parse(parsed.data.config_json); } catch {
      return apiError("Ungültiges JSON", 400);
    }
  }

  const domain = await DomainService.update(id, parsed.data);
  return ok(domain);
}, { captureBody: true });

export const DELETE = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  await DomainService.delete(id);
  return ok({ ok: true });
});
