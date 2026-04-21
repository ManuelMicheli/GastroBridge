// app/api/fiscal/webhooks/[provider]/route.ts
// POS webhook receiver.
// Caller must include header `x-gb-integration-id: <uuid>` so we can
// load the matching fiscal_integrations row + its webhook_secret.
// Signature header is provider-specific — delegated to adapter.verifyWebhook.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/fiscal/adapters/registry.ts";
import { processUnprocessedEvents } from "@/lib/fiscal/normalizer.ts";
import type { FiscalProvider } from "@/lib/fiscal/types.ts";

const ALLOWED_PROVIDERS: readonly FiscalProvider[] = [
  "tilby",
  "cassa_in_cloud",
  "lightspeed",
  "scloby",
  "tcpos",
  "revo",
  "simphony",
  "hiopos",
  "generic_webhook",
];

function isFiscalProvider(p: string): p is FiscalProvider {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(p);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isFiscalProvider(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }

  const integrationId = request.headers.get("x-gb-integration-id");
  if (!integrationId) {
    return NextResponse.json(
      { error: "missing x-gb-integration-id header" },
      { status: 400 },
    );
  }

  const body = await request.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: integration, error: intErr } = await supabase
    .from("fiscal_integrations")
    .select("id, restaurant_id, provider, status, webhook_secret, config")
    .eq("id", integrationId)
    .eq("provider", provider)
    .maybeSingle();

  if (intErr || !integration) {
    return NextResponse.json({ error: "integration not found" }, { status: 404 });
  }
  if (integration.status !== "active") {
    return NextResponse.json({ error: "integration not active" }, { status: 403 });
  }

  const adapter = getAdapter(provider);
  const secret = integration.webhook_secret ?? "";
  const headerBag: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headerBag[k.toLowerCase()] = v;
  });

  if (!adapter.verifyWebhook || !adapter.parseWebhook) {
    return NextResponse.json(
      { error: "provider does not support webhook ingestion" },
      { status: 400 },
    );
  }
  if (!adapter.verifyWebhook(headerBag, body, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events;
  try {
    events = adapter.parseWebhook(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `parseWebhook failed: ${msg}` },
      { status: 400 },
    );
  }

  if (events.length === 0) {
    return NextResponse.json({ accepted: 0 });
  }

  const rows = events.map((ev) => ({
    integration_id: integration.id,
    external_id: ev.external_id,
    event_type: ev.event_type,
    payload: ev.payload as Record<string, unknown>,
  }));

  // Idempotent: dedupe on (integration_id, external_id, event_type)
  const { error: insErr } = await supabase
    .from("fiscal_raw_events")
    .upsert(rows, {
      onConflict: "integration_id,external_id,event_type",
      ignoreDuplicates: true,
    });

  if (insErr) {
    return NextResponse.json(
      { error: `insert raw_events: ${insErr.message}` },
      { status: 500 },
    );
  }

  // Inline normalize. Bounded limit avoids long requests; leftover rows
  // catch-up via cron-triggered sync route.
  try {
    await processUnprocessedEvents(Math.min(rows.length * 2, 50));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { accepted: rows.length, normalized: false, error: msg },
      { status: 202 },
    );
  }

  return NextResponse.json({ accepted: rows.length, normalized: true });
}
