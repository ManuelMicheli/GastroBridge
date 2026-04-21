// lib/fiscal/queries.ts
// Server-side data access for the restaurant Cassetto Fiscale UI.
// Uses the user-context Supabase client so RLS applies — callers see only
// rows for restaurants they own.

import { createClient } from "@/lib/supabase/server";
import type {
  FiscalIntegrationStatus,
  FiscalProvider,
  FiscalReceiptStatus,
} from "./types";

export interface DailySummaryRow {
  business_day: string;
  receipts_count: number;
  revenue_cents: number;
  vat_cents: number;
  covers: number;
  avg_ticket_cents: number;
}

export interface FoodCostRow {
  business_day: string;
  revenue_cents: number;
  spend_cents: number;
  food_cost_pct: number | null;
}

export interface IntegrationRow {
  id: string;
  restaurant_id: string;
  provider: FiscalProvider;
  status: FiscalIntegrationStatus;
  display_name: string | null;
  config: Record<string, unknown>;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface ReceiptListRow {
  id: string;
  external_id: string;
  issued_at: string;
  business_day: string;
  status: FiscalReceiptStatus;
  total_cents: number;
  payment_method: string | null;
  covers: number | null;
  operator_name: string | null;
  integration_id: string;
}

export interface ReceiptDetail extends ReceiptListRow {
  restaurant_id: string;
  subtotal_cents: number;
  vat_cents: number;
  table_ref: string | null;
  metadata: Record<string, unknown>;
  items: Array<{
    line_number: number;
    pos_item_id: string | null;
    name: string;
    category: string | null;
    quantity: number;
    unit_price_cents: number;
    subtotal_cents: number;
    vat_rate: number | null;
    discount_cents: number;
    is_voided: boolean;
  }>;
}

export interface FiscalOverview {
  enabled: boolean;
  integrations: IntegrationRow[];
  daily: DailySummaryRow[];
  foodCost: FoodCostRow[];
  latestReceipts: ReceiptListRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loose() {
  const c = await createClient();
  return c as any;
}

export async function getFiscalEnabled(restaurantId: string): Promise<boolean> {
  const supabase = await loose();
  const { data } = await supabase
    .from("restaurant_preferences")
    .select("fiscal_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return Boolean(data?.fiscal_enabled);
}

export async function listIntegrations(
  restaurantId: string,
): Promise<IntegrationRow[]> {
  const supabase = await loose();
  const { data } = await supabase
    .from("fiscal_integrations_safe")
    .select(
      "id, restaurant_id, provider, status, display_name, config, last_synced_at, last_error, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });
  return (data ?? []) as IntegrationRow[];
}

export async function getDailySummary(
  restaurantId: string,
  days = 30,
): Promise<DailySummaryRow[]> {
  const supabase = await loose();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from("fiscal_daily_summary")
    .select(
      "business_day, receipts_count, revenue_cents, vat_cents, covers, avg_ticket_cents",
    )
    .eq("restaurant_id", restaurantId)
    .gte("business_day", since.toISOString().slice(0, 10))
    .order("business_day", { ascending: true });
  return (data ?? []) as DailySummaryRow[];
}

export async function getFoodCost(
  restaurantId: string,
  days = 30,
): Promise<FoodCostRow[]> {
  const supabase = await loose();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from("fiscal_food_cost")
    .select("business_day, revenue_cents, spend_cents, food_cost_pct")
    .eq("restaurant_id", restaurantId)
    .gte("business_day", since.toISOString().slice(0, 10))
    .order("business_day", { ascending: true });
  return (data ?? []) as FoodCostRow[];
}

export async function getLatestReceipts(
  restaurantId: string,
  limit = 20,
  opts: {
    since?: string;
    until?: string;
    integrationId?: string;
    status?: FiscalReceiptStatus;
  } = {},
): Promise<ReceiptListRow[]> {
  const supabase = await loose();
  let q = supabase
    .from("fiscal_receipts")
    .select(
      "id, external_id, issued_at, business_day, status, total_cents, payment_method, covers, operator_name, integration_id",
    )
    .eq("restaurant_id", restaurantId)
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (opts.since) q = q.gte("business_day", opts.since);
  if (opts.until) q = q.lte("business_day", opts.until);
  if (opts.integrationId) q = q.eq("integration_id", opts.integrationId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data ?? []) as ReceiptListRow[];
}

export async function getReceiptById(
  restaurantId: string,
  receiptId: string,
): Promise<ReceiptDetail | null> {
  const supabase = await loose();
  const { data } = await supabase
    .from("fiscal_receipts")
    .select(
      "id, restaurant_id, external_id, issued_at, business_day, status, subtotal_cents, vat_cents, total_cents, payment_method, operator_name, table_ref, covers, metadata, integration_id",
    )
    .eq("id", receiptId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!data) return null;

  const { data: items } = await supabase
    .from("fiscal_receipt_items")
    .select(
      "line_number, pos_item_id, name, category, quantity, unit_price_cents, subtotal_cents, vat_rate, discount_cents, is_voided",
    )
    .eq("receipt_id", receiptId)
    .order("line_number", { ascending: true });

  return { ...(data as Omit<ReceiptDetail, "items">), items: items ?? [] };
}

export async function getFiscalOverview(
  restaurantId: string,
): Promise<FiscalOverview> {
  const [enabled, integrations, daily, foodCost, latestReceipts] =
    await Promise.all([
      getFiscalEnabled(restaurantId),
      listIntegrations(restaurantId),
      getDailySummary(restaurantId, 30),
      getFoodCost(restaurantId, 30),
      getLatestReceipts(restaurantId, 10),
    ]);
  return { enabled, integrations, daily, foodCost, latestReceipts };
}

export async function getRestaurantsForCurrentUser(): Promise<
  Array<{ id: string; name: string; is_primary: boolean }>
> {
  const supabase = await loose();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("restaurants")
    .select("id, name, is_primary")
    .eq("profile_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as Array<{ id: string; name: string; is_primary: boolean }>;
}
