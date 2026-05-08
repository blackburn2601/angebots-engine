import { auth } from "@/lib/auth";
import { z } from "zod";
import { UserService } from "@/services/UserService";
import { ok, created, apiError } from "@/lib/api-response";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  rolle: z.enum(["SUPER_ADMIN", "DOMAIN_ADMIN", "SELLER"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Nicht angemeldet", 401);
  if ((session.user as { rolle: string }).rolle !== "SUPER_ADMIN") {
    return apiError("Keine Berechtigung", 403);
  }

  const users = await UserService.findAll();
  return ok(users.map((u) => ({ id: u.id, name: u.name, email: u.email, rolle: u.rolle, aktiv: u.aktiv })));
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

  const exists = await UserService.findByEmail(parsed.data.email);
  if (exists) return apiError("E-Mail bereits vergeben", 409);

  const user = await UserService.create(parsed.data);
  return created({ id: user.id, email: user.email });
}
