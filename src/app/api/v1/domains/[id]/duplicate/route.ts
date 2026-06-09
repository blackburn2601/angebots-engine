import { DomainService } from "@/services/DomainService";
import { created, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { id } = await params;
  try {
    const copy = await DomainService.duplicate(id);
    return created(copy);
  } catch {
    return apiError("Nicht gefunden", 404);
  }
});
