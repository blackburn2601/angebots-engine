import { auth } from "@/lib/auth";
import { DomainService } from "@/services/DomainService";
import { created, apiError } from "@/lib/api-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return apiError("Keine Berechtigung", 403);
  }

  const { id } = await params;
  try {
    const copy = await DomainService.duplicate(id);
    return created(copy);
  } catch {
    return apiError("Nicht gefunden", 404);
  }
}
