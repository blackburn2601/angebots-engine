import { ApiKeyService } from "@/services/ApiKeyService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

export const DELETE = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  await ApiKeyService.revoke(id);
  return ok({ ok: true });
});
