import { z } from "zod";
import { WebhookService } from "@/services/WebhookService";
import { ok, created, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const webhookSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url(),
  description: z.string().max(500).optional(),
  aktiv: z.boolean().optional().default(true),
});

export const GET = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const webhooks = await WebhookService.findAll();
  return ok(webhooks);
});

export const POST = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const body = await req.json().catch(() => null);
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  const webhook = await WebhookService.create(parsed.data);
  return created(webhook);
}, { captureBody: true });
