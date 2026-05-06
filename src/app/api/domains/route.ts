import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { slugify } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.domain.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const domain = await prisma.domain.create({
    data: { name: parsed.data.name, slug },
  });

  return NextResponse.json(domain, { status: 201 });
}
