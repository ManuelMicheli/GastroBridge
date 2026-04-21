// lib/fiscal/normalizer.ts
// Process unprocessed fiscal_raw_events rows by dispatching to the
// correct adapter's normalize() and UPSERTing fiscal_receipts +
// fiscal_receipt_items + fiscal_pos_items.
//
// Invoked by:
//   - webhook route handler after INSERT (inline, sync)
//   - edge fn "fiscal-sync" after pull (batch)
//   - catch-up cron for rows with processed_at IS NULL

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "./adapters/registry.ts";
import type { FiscalProvider, NormalizedReceipt } from "./types.ts";

type LooseClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => LooseQuery;
};
type LooseQuery = {
  select: (cols: string) => LooseQuery;
  update: (values: Record<string, unknown>) => LooseQuery;
  insert: (values: unknown) => LooseQuery;
  upsert: (values: unknown, opts?: Record<string, unknown>) => LooseQuery;
  delete: () => LooseQuery;
  eq: (col: string, val: unknown) => LooseQuery;
  in: (col: string, vals: unknown[]) => LooseQuery;
  is: (col: string, val: unknown) => LooseQuery;
  order: (col: string, opts?: { ascending?: boolean }) => LooseQuery;
  limit: (n: number) => LooseQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  single: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  then: <T>(
    onFulfilled?: (value: {
      data: unknown;
      error: { message: string } | null;
    }) => T,
  ) => Promise<T>;
};

function loose(): LooseClient {
  return createAdminClient() as unknown as LooseClient;
}

type RawEventRow = {
  id: number;
  integration_id: string;
  external_id: string;
  event_type: string;
  payload: unknown;
  processed_at: string | null;
};

type IntegrationRow = {
  id: string;
  restaurant_id: string;
  provider: FiscalProvider;
  config: Record<string, unknown>;
};

export interface NormalizeResult {
  processed: number;
  errors: Array<{ id: number; error: string }>;
}

export async function processUnprocessedEvents(
  limit = 100,
): Promise<NormalizeResult> {
  const supabase = loose();

  const { data: rawEvents, error: evErr } = (await supabase
    .from("fiscal_raw_events")
    .select("id, integration_id, external_id, event_type, payload, processed_at")
    .is("processed_at", null)
    .order("received_at", { ascending: true })
    .limit(limit)) as { data: RawEventRow[] | null; error: { message: string } | null };

  if (evErr) throw new Error(`fetch unprocessed events: ${evErr.message}`);
  const events = rawEvents ?? [];
  if (events.length === 0) return { processed: 0, errors: [] };

  const integrationIds = Array.from(new Set(events.map((e) => e.integration_id)));
  const { data: intsData, error: intErr } = (await supabase
    .from("fiscal_integrations")
    .select("id, restaurant_id, provider, config")
    .in("id", integrationIds)) as {
    data: IntegrationRow[] | null;
    error: { message: string } | null;
  };
  if (intErr) throw new Error(`fetch integrations: ${intErr.message}`);

  const byId = new Map<string, IntegrationRow>();
  for (const i of intsData ?? []) byId.set(i.id, i);

  const errors: NormalizeResult["errors"] = [];
  let processed = 0;

  for (const ev of events) {
    try {
      const integration = byId.get(ev.integration_id);
      if (!integration)
        throw new Error(`integration ${ev.integration_id} not found`);
      const adapter = getAdapter(integration.provider);
      const normalized = adapter.normalize(
        {
          external_id: ev.external_id,
          event_type: ev.event_type as
            | "receipt.created"
            | "receipt.voided"
            | "receipt.refunded",
          payload: ev.payload,
        },
        integration,
      );
      if (!normalized) throw new Error("adapter.normalize returned null");

      await upsertReceipt(integration, normalized);
      await supabase
        .from("fiscal_raw_events")
        .update({
          processed_at: new Date().toISOString(),
          process_error: null,
        })
        .eq("id", ev.id);
      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ id: ev.id, error: msg });
      await supabase
        .from("fiscal_raw_events")
        .update({ process_error: msg })
        .eq("id", ev.id);
    }
  }

  if (processed > 0) {
    await supabase.rpc("refresh_fiscal_aggregates");
  }

  return { processed, errors };
}

async function upsertReceipt(
  integration: IntegrationRow,
  n: NormalizedReceipt,
): Promise<void> {
  const supabase = loose();

  const { data: existing } = await supabase
    .from("fiscal_receipts")
    .select("id")
    .eq("integration_id", integration.id)
    .eq("external_id", n.external_id)
    .maybeSingle();

  let receiptId: string;
  if (existing) {
    receiptId = (existing as { id: string }).id;
    const { error } = await supabase
      .from("fiscal_receipts")
      .update({
        issued_at: n.issued_at,
        business_day: n.business_day,
        status: n.status,
        subtotal_cents: n.subtotal_cents,
        vat_cents: n.vat_cents,
        total_cents: n.total_cents,
        payment_method: n.payment_method,
        operator_name: n.operator_name,
        table_ref: n.table_ref,
        covers: n.covers,
        metadata: n.metadata,
      })
      .eq("id", receiptId);
    if (error) throw new Error(`update receipt: ${error.message}`);
    await supabase.from("fiscal_receipt_items").delete().eq("receipt_id", receiptId);
  } else {
    const { data: inserted, error } = await supabase
      .from("fiscal_receipts")
      .insert({
        restaurant_id: integration.restaurant_id,
        integration_id: integration.id,
        external_id: n.external_id,
        issued_at: n.issued_at,
        business_day: n.business_day,
        status: n.status,
        subtotal_cents: n.subtotal_cents,
        vat_cents: n.vat_cents,
        total_cents: n.total_cents,
        payment_method: n.payment_method,
        operator_name: n.operator_name,
        table_ref: n.table_ref,
        covers: n.covers,
        metadata: n.metadata,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert receipt: ${error.message}`);
    receiptId = (inserted as { id: string }).id;
  }

  if (n.items.length > 0) {
    const { error } = await supabase.from("fiscal_receipt_items").insert(
      n.items.map((it) => ({
        receipt_id: receiptId,
        line_number: it.line_number,
        pos_item_id: it.pos_item_id,
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
        subtotal_cents: it.subtotal_cents,
        vat_rate: it.vat_rate,
        discount_cents: it.discount_cents,
        is_voided: it.is_voided,
      })),
    );
    if (error) throw new Error(`insert items: ${error.message}`);

    const lineItems = n.items.filter(
      (it): it is typeof it & { pos_item_id: string } => !!it.pos_item_id,
    );
    for (const it of lineItems) {
      await supabase.from("fiscal_pos_items").upsert(
        {
          integration_id: integration.id,
          pos_item_id: it.pos_item_id,
          name: it.name,
          category: it.category,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "integration_id,pos_item_id" },
      );
    }
  }
}
