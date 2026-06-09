import { z } from "zod";
import { UserService } from "@/services/UserService";
import { ok, created, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";
import { withLogging } from "@/lib/api-logger";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  rolle: z.enum(["SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER"]),
});

export const GET = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const users = await UserService.findAll();
  return ok(users.map((u) => ({ id: u.id, name: u.name, email: u.email, rolle: u.rolle, aktiv: u.aktiv })));
});

export const POST = withLogging(async (req: Request) => {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("Missing or invalid input parameters", 400);

  const exists = await UserService.findByEmail(parsed.data.email);
  if (exists) return apiError("E-Mail bereits vergeben", 409);

  const user = await UserService.create(parsed.data);
  return created({ id: user.id, email: user.email });
}, { captureBody: true });
