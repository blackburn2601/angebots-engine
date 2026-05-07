import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const rolle = (session.user as { rolle: string }).rolle;
  if (!["SUPER_ADMIN", "DOMAIN_ADMIN"].includes(rolle)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const source = await prisma.domain.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const newName = `${source.name} (Kopie)`;
  const baseSlug = slugify(newName);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.domain.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const copy = await prisma.domain.create({
    data: { name: newName, slug, config_json: source.config_json },
  });

  return NextResponse.json(copy, { status: 201 });
}
