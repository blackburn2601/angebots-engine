import { z } from "zod";
import { DomainService } from "@/services/DomainService";
import { created, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const duplicateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const POST = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const body = await req.json().catch(() => null);
  const parsed = duplicateSchema.safeParse(body ?? {});
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  const { id } = await params;
  try {
    const copy = await DomainService.duplicate(id, parsed.data.name);
    return created(copy);
  } catch {
    return apiError("Nicht gefunden", 404);
  }
}, { captureBody: true });
