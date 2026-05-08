import { auth } from "@/lib/auth";
import { DashboardService } from "@/services/DashboardService";
import { ok, apiError } from "@/lib/api-response";

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const rolle = (session.user as { rolle: string }).rolle;
  const stats = await DashboardService.getStats(rolle);
  return ok(stats);
}
