import { auth } from "@/lib/auth";
import { z } from "zod";
import { ApiKeyService } from "@/services/ApiKeyService";
import { ok, apiError } from "@/lib/api-response";

const createSchema = z.object({ label: z.string().min(1) });

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);
  if ((session.user as { rolle: string }).rolle !== "SUPER_ADMIN") {
    return apiError("Keine Berechtigung", 403);
  }

  const keys = await ApiKeyService.findAll();
  return ok(keys);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);
  if ((session.user as { rolle: string }).rolle !== "SUPER_ADMIN") {
    return apiError("Keine Berechtigung", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("Ungültige Eingabe", 400);

  const rawKey = await ApiKeyService.create(parsed.data.label);
  return ok({ key: rawKey }, 201);
}
