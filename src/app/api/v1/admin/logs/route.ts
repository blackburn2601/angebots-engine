import { prisma } from "@/lib/prisma";
import { ok, apiError } from "@/lib/api-response";
import { getRequestAuth, hasRole } from "@/lib/request-auth";

export async function GET(req: Request) {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));
  const method = searchParams.get("method") ?? undefined;
  const statusCode = searchParams.get("status") ? parseInt(searchParams.get("status")!, 10) : undefined;
  const pathFilter = searchParams.get("path") ?? undefined;

  const where = {
    ...(method ? { method } : {}),
    ...(statusCode ? { status_code: statusCode } : {}),
    ...(pathFilter ? { path: { contains: pathFilter } } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.apiLog.findMany({
      where,
      orderBy: { zeitstempel: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.apiLog.count({ where }),
  ]);

  return ok({ logs, total, page, limit });
}

export async function DELETE(req: Request) {
  const ctx = await getRequestAuth(req);
  if (!ctx) return apiError("Not logged in", 401);
  if (!hasRole(ctx, "SUPER_ADMIN")) return apiError("Keine Berechtigung", 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await prisma.apiLog.delete({ where: { id } });
    return ok({ ok: true });
  }

  await prisma.apiLog.deleteMany({});
  return ok({ ok: true, cleared: true });
}
