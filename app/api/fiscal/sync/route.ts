// app/api/fiscal/sync/route.ts
// Manual + cron-triggered pull. Protected by Bearer token in
// Authorization header matching FISCAL_CRON_SECRET env var.
//
// Body (optional):
//   { "integration_id": "uuid" }  → sync a single integration
//   omitted or {}                  → sync ALL active integrations
//
// Response: { synced: number, errors: [] }

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/fiscal/adapters/registry.ts";
import { loadCredentials } from "@/lib/fiscal/credentials";
import { processUnprocessedEvents } from "@/lib/fiscal/normalizer.ts";
import type { FiscalProvider, ReceiptEvent } from "@/lib/fiscal/types.ts";

const DEFAULT_LOOKBACK_HOURS = 48;

type IntegrationRow = {
  id: string;
  restaurant_id: string;
  provider: FiscalProvider;
  config: Record<string, unknown>;
  last_synced_at: string | null;
};

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.FISCAL_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "FISCAL_CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorized();

  let body: { integration_id?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // empty body is fine
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  let query = supabase
    .from("fiscal_integrations")
    .select("id, restaurant_id, provider, config, last_synced_at")
    .eq("status", "active");

  if (body.integration_id) {
    query = query.eq("id", body.integration_id);
  }

  const { data: ints, error } = (await query) as {
    data: IntegrationRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    return NextResponse.json(
      { error: `query integrations: ${error.message}` },
      { status: 500 },
    );
  }

  const integrations = ints ?? [];
  const now = new Date();
  let synced = 0;
  const errors: Array<{ integration_id: string; error: string }> = [];

  for (const it of integrations) {
    const startedAt = new Date().toISOString();
    try {
      const adapter = getAdapter(it.provider);
      const creds = await loadCredentials(it.id);
      if (!creds) {
        errors.push({ integration_id: it.id, error: "no credentials set" });
        await supabase.from("fiscal_sync_logs").insert({
          integration_id: it.id,
          source: "pull",
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          errors: 1,
          error_message: "no credentials set",
        });
        continue;
      }
      const since = it.last_synced_at
        ? new Date(it.last_synced_at)
        : new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 3600 * 1000);

      const received: ReceiptEvent[] = [];
      for await (const ev of adapter.fetchReceipts(creds, it.config, {
        since,
      })) {
        received.push(ev);
      }

      if (received.length > 0) {
        const { error: insErr } = await supabase
          .from("fiscal_raw_events")
          .upsert(
            received.map((ev) => ({
              integration_id: it.id,
              external_id: ev.external_id,
              event_type: ev.event_type,
              payload: ev.payload as Record<string, unknown>,
            })),
            {
              onConflict: "integration_id,external_id,event_type",
              ignoreDuplicates: true,
            },
          );
        if (insErr) throw new Error(`insert raw_events: ${insErr.message}`);
      }

      await supabase
        .from("fiscal_integrations")
        .update({
          last_synced_at: now.toISOString(),
          last_error: null,
          status: "active",
        })
        .eq("id", it.id);

      await supabase.from("fiscal_sync_logs").insert({
        integration_id: it.id,
        source: "pull",
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        fetched: received.length,
        inserted: received.length,
      });

      synced += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ integration_id: it.id, error: msg });

      // Count consecutive failures in last 6 hours to decide whether
      // to escalate from 'active' to 'error'.
      const { data: recentErrors } = await supabase
        .from("fiscal_sync_logs")
        .select("id")
        .eq("integration_id", it.id)
        .eq("source", "pull")
        .gte(
          "started_at",
          new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        )
        .gt("errors", 0);
      const consecutive = Array.isArray(recentErrors)
        ? recentErrors.length + 1
        : 1;
      const nextStatus = consecutive >= 3 ? "error" : it.last_synced_at ? "active" : "pending_auth";

      await supabase
        .from("fiscal_integrations")
        .update({ status: nextStatus, last_error: msg })
        .eq("id", it.id);

      await supabase.from("fiscal_sync_logs").insert({
        integration_id: it.id,
        source: "pull",
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        errors: 1,
        error_message: msg,
        metadata: { consecutive_failures: consecutive },
      });
    }
  }

  // Normalize whatever was inserted this pass.
  try {
    await processUnprocessedEvents(500);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push({ integration_id: "normalizer", error: msg });
  }

  return NextResponse.json({ synced, errors });
}
