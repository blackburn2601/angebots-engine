import { DashboardService } from "@/services/DashboardService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

export const GET = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);

  const rolle = ctx.type === "session" ? ctx.rolle : "SUPER_ADMIN";
  const stats = await DashboardService.getStats(rolle);
  return ok(stats);
});
