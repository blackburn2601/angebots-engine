import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { DomainService } from "@/services/DomainService";
import { ok, created, apiError } from "@/lib/api-response";

const createSchema = z.object({ name: z.string().min(1).max(100) });

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);

  const domains = await DomainService.findAll();
  return ok(domains);
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

  const domain = await DomainService.create(parsed.data.name);
  return created(domain);
}
