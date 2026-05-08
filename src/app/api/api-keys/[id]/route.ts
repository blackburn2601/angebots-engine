import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ApiKeyService } from "@/services/ApiKeyService";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if ((session.user as { rolle: string }).rolle !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  await ApiKeyService.revoke(id);
  return NextResponse.json({ ok: true });
}
