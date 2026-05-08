import { auth } from "@/lib/auth";
import { EngineService } from "@/services/EngineService";
import { ok, apiError } from "@/lib/api-response";
import type { PreisItem } from "@/types/domain";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Ungültige Eingabe", 400);

  const inputs: Record<string, unknown> = body.inputs ?? {};
  const preisItems: PreisItem[] = Array.isArray(body.preis_items) ? body.preis_items : [];

  try {
    const result = await EngineService.run(id, inputs, preisItems);
    return ok(result);
  } catch {
    return apiError("Domäne nicht gefunden", 404);
  }
}
