import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  aktiv: z.boolean().optional(),
  items_json: z.string().optional(),
  domainIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const { domainIds, ...rest } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(rest).length > 0) {
      await tx.pricelist.update({ where: { id }, data: rest });
    }
    if (domainIds !== undefined) {
      await tx.domainPricelist.deleteMany({ where: { pricelistId: id } });
      if (domainIds.length > 0) {
        await tx.domainPricelist.createMany({
          data: domainIds.map((domainId) => ({ domainId, pricelistId: id })),
        });
      }
    }
  });

  const updated = await prisma.pricelist.findUnique({ where: { id } });
  return NextResponse.json(updated);
}
