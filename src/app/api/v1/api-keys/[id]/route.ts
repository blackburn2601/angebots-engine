import { auth } from "@/lib/auth";
import { ApiKeyService } from "@/services/ApiKeyService";
import { ok, apiError } from "@/lib/api-response";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);
  if ((session.user as { rolle: string }).rolle !== "SUPER_ADMIN") {
    return apiError("Keine Berechtigung", 403);
  }

  const { id } = await params;
  await ApiKeyService.revoke(id);
  return ok({ ok: true });
}
