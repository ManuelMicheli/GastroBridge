// lib/fiscal/reorder.ts
// Server-side queries and actions for reorder suggestions.

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReorderUrgency } from "@/types/database";

export interface ReorderSuggestionRow {
  id: string;
  restaurant_id: string;
  product_id: string | null;
  category_id: string | null;
  suggested_qty: number | null;
  suggested_unit: string | null;
  estimated_coverage_days: number | null;
  urgency: ReorderUrgency;
  reason: string;
  preferred_supplier_id: string | null;
  snapshot: Record<string, unknown>;
  state: "open" | "acted" | "dismissed" | "expired";
  created_at: string;
  expires_at: string;
  category_name: string | null;
  product_name: string | null;
  supplier_name: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

async function rls(): Promise<Loose> {
  const c = await createClient();
  return c as Loose;
}

export async function listReorderSuggestions(
  restaurantId: string,
  state: "open" | "acted" | "dismissed" | "expired" = "open",
): Promise<ReorderSuggestionRow[]> {
  const supabase = await rls();
  const { data: rows } = await supabase
    .from("reorder_suggestions")
    .select(
      "id, restaurant_id, product_id, category_id, suggested_qty, suggested_unit, estimated_coverage_days, urgency, reason, preferred_supplier_id, snapshot, state, created_at, expires_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("state", state)
    .order("urgency", { ascending: false })
    .order("created_at", { ascending: false });

  const list = (rows ?? []) as Omit<
    ReorderSuggestionRow,
    "category_name" | "product_name" | "supplier_name"
  >[];
  if (list.length === 0) return [];

  const categoryIds = Array.from(
    new Set(list.map((r) => r.category_id).filter((v): v is string => !!v)),
  );
  const productIds = Array.from(
    new Set(list.map((r) => r.product_id).filter((v): v is string => !!v)),
  );
  const supplierIds = Array.from(
    new Set(
      list.map((r) => r.preferred_supplier_id).filter((v): v is string => !!v),
    ),
  );

  const [cats, prods, supps] = await Promise.all([
    categoryIds.length
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] }),
    supplierIds.length
      ? supabase.from("suppliers").select("id, company_name").in("id", supplierIds)
      : Promise.resolve({ data: [] }),
  ]);

  const catMap = new Map(
    ((cats.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );
  const prodMap = new Map(
    ((prods.data ?? []) as { id: string; name: string }[]).map((p) => [
      p.id,
      p.name,
    ]),
  );
  const suppMap = new Map(
    ((supps.data ?? []) as { id: string; company_name: string }[]).map((s) => [
      s.id,
      s.company_name,
    ]),
  );

  return list.map((r) => ({
    ...r,
    category_name: r.category_id ? (catMap.get(r.category_id) ?? null) : null,
    product_name: r.product_id ? (prodMap.get(r.product_id) ?? null) : null,
    supplier_name: r.preferred_supplier_id
      ? (suppMap.get(r.preferred_supplier_id) ?? null)
      : null,
  }));
}

export async function dismissSuggestion(id: string): Promise<void> {
  const supabase = await rls();
  const { error } = await supabase
    .from("reorder_suggestions")
    .update({ state: "dismissed" })
    .eq("id", id);
  if (error) throw new Error(`dismiss: ${error.message}`);
  revalidatePath("/finanze/ordini-consigliati");
  revalidatePath("/finanze");
}

export async function actSuggestion(id: string): Promise<void> {
  const supabase = await rls();
  const { error } = await supabase
    .from("reorder_suggestions")
    .update({ state: "acted" })
    .eq("id", id);
  if (error) throw new Error(`act: ${error.message}`);
  revalidatePath("/finanze/ordini-consigliati");
  revalidatePath("/finanze");
}

export async function regenerateSuggestions(): Promise<number> {
  const admin = createAdminClient() as Loose;
  const { data } = await admin.rpc("generate_reorder_suggestions");
  return typeof data === "number" ? data : 0;
}
