import { z } from "zod";
import { WebhookService } from "@/services/WebhookService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const patchSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  description: z.string().max(500).optional().nullable(),
  aktiv: z.boolean().optional(),
});

export const PATCH = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  const webhook = await WebhookService.update(id, parsed.data);
  return ok(webhook);
}, { captureBody: true });

export const DELETE = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  await WebhookService.delete(id);
  return ok({ ok: true });
});
