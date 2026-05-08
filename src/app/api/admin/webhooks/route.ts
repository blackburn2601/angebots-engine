import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";
import { WebhookService } from "@/services/WebhookService";

const webhookSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url(),
  description: z.string().max(500).optional(),
  aktiv: z.boolean().optional().default(true),
});

export async function GET() {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");
  const webhooks = await WebhookService.findAll();
  return NextResponse.json(webhooks);
}

export async function POST(req: NextRequest) {
  await requireRole("SUPER_ADMIN", "DOMAIN_ADMIN");

  const body = await req.json();
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const webhook = await WebhookService.create(parsed.data);
  return NextResponse.json(webhook, { status: 201 });
}
