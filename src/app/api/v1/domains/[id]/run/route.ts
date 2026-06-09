import { EngineService } from "@/services/EngineService";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";
import type { PreisItem } from "@/types/domain";

export const POST = withLogging(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Missing or invalid input parameters", 400);

  const inputs: Record<string, unknown> = body.inputs ?? {};
  const preisItems: PreisItem[] = Array.isArray(body.preis_items) ? body.preis_items : [];

  try {
    const result = await EngineService.run(id, inputs, preisItems);
    return ok(result);
  } catch {
    return apiError("Domäne nicht gefunden", 404);
  }
}, { captureBody: true });
