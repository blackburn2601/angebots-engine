import { z } from "zod";
import { DomainService } from "@/services/DomainService";
import { ok, created, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const createSchema = z.object({ name: z.string().min(1).max(100) });

export const GET = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);

  const domains = await DomainService.findAll();
  return ok(domains);
});

export const POST = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN", "DOMAIN_ADMIN")) return apiError("Keine Berechtigung", 403);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  const domain = await DomainService.create(parsed.data.name);
  return created(domain);
}, { captureBody: true });
