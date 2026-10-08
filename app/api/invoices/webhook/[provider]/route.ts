// app/api/invoices/webhook/[provider]/route.ts
// Inbound callback from the SDI intermediary ("supplier-invoice" event).
//
//   1. authenticate (shared secret header / HMAC, constant-time compare);
//   2. persist the event in sdi_inbound_events — UNIQUE(provider, event,
//      external_id) makes redeliveries idempotent;
//   3. answer 202 immediately and process after the response (next/server
//      `after`): parse → store → match → findings → food cost → notification.
// A failed processing stays in status "error"/"received" and is retried by
// the safety-net cron (/api/invoices/cron).

import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/invoices/providers/registry";
import { processInboundEvent } from "@/lib/invoices/server/sdi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BODY = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  if (!(await provider.verifyWebhook(request.headers, raw))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = provider.parseWebhook(body);
  if (parsed.kind !== "supplier_invoice" || !parsed.externalId) {
    return NextResponse.json({ ok: true, ignored: parsed.event });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("sdi_inbound_events")
    .insert({
      provider: provider.id,
      event: parsed.event.slice(0, 60),
      external_id: parsed.externalId.slice(0, 200),
      payload: body,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[invoices:webhook] store failed", error.message);
    // 500 → the provider retries the delivery.
    return NextResponse.json({ error: "store failed" }, { status: 500 });
  }

  const eventId = data.id as string;
  after(async () => {
    try {
      await processInboundEvent(eventId);
    } catch (err) {
      console.error("[invoices:webhook] processing failed", err);
    }
  });
  return NextResponse.json({ ok: true, received: true }, { status: 202 });
}
