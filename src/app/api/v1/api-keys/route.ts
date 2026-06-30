import { z } from "zod";
import { ApiKeyService } from "@/services/ApiKeyService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const createSchema = z.object({ label: z.string().min(1) });

export const GET = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const keys = await ApiKeyService.findAll();
  return ok(keys);
});

export const POST = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  const rawKey = await ApiKeyService.create(parsed.data.label);
  return ok({ key: rawKey }, 201);
}, { captureBody: true });
