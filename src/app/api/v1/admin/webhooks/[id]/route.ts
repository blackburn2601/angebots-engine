import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";
import { WebhookService } from "@/services/WebhookService";
import { ok, apiError } from "@/lib/api-response";

const patchSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  description: z.string().max(500).optional().nullable(),
  aktiv: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("Ungültige Eingabe", 400);

  const webhook = await WebhookService.update(id, parsed.data);
  return ok(webhook);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");

  const { id } = await params;
  await WebhookService.delete(id);
  return ok({ ok: true });
}
