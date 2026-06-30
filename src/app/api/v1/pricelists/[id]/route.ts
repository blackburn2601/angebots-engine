import { z } from "zod";
import { PricelistService } from "@/services/PricelistService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  aktiv: z.boolean().optional(),
  items_json: z.string().optional(),
  domainIds: z.array(z.string()).optional(),
});

export const GET = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);

  const { id } = await params;
  const pl = await PricelistService.findById(id);
  if (!pl) return apiError("Nicht gefunden", 404);

  return ok({ ...pl, items: PricelistService.parseItems(pl.items_json) });
});

export const PATCH = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  if (parsed.data.items_json !== undefined) {
    try { JSON.parse(parsed.data.items_json); } catch {
      return apiError("Ungültiges JSON in items_json", 400);
    }
  }

  const updated = await PricelistService.update(id, parsed.data);
  return ok(updated);
}, { captureBody: true });

export const DELETE = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  await PricelistService.delete(id);
  return ok({ ok: true });
});
