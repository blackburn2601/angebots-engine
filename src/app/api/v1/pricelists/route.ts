import { auth } from "@/lib/auth";
import { z } from "zod";
import { PricelistService } from "@/services/PricelistService";
import { ok, created, apiError } from "@/lib/api-response";

const createSchema = z.object({ name: z.string().min(1) });

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const pricelists = await PricelistService.findAll();
  return ok(pricelists);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return apiError("Keine Berechtigung", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("Ungültige Eingabe", 400);

  const pl = await PricelistService.create(parsed.data.name);
  return created(pl);
}
