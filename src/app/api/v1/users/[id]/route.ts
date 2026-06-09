import { z } from "zod";
import { UserService } from "@/services/UserService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  rolle: z.enum(["SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER"]).optional(),
  aktiv: z.boolean().optional(),
  muss_pw_aendern: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const PATCH = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);

  const { id } = await params;
  const isSelf = ctx.type === "session" && ctx.userId === id;
  if (!isSelf && !hasRole(ctx, "SUPER_ADMIN")) {
    return apiError("Keine Berechtigung", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  if (ctx.type === "session" && ctx.rolle !== "SUPER_ADMIN") {
    if (parsed.data.rolle !== undefined || parsed.data.aktiv !== undefined || parsed.data.muss_pw_aendern !== undefined) {
      return apiError("Keine Berechtigung", 403);
    }
  }

  const user = await UserService.update(id, parsed.data as Record<string, unknown>);
  return ok({ id: (user as { id: string }).id });
}, { captureBody: true });
