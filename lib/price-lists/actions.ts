/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PriceListSchema, PriceListUpdateSchema, type PriceListInput, type PriceListUpdateInput } from "./schemas";
import type { PriceListRow, Result } from "./types";

/**
 * Upsert a custom price entry for a product under a relationship.
 * Supplier-only (enforced by RLS). Uses ON CONFLICT (relationship_id, product_id).
 */
export async function upsertPriceListEntry(input: PriceListInput): Promise<Result<PriceListRow>> {
  const parsed = PriceListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("supplier_price_lists")
    .upsert(
      {
        relationship_id: parsed.data.relationship_id,
        product_id:      parsed.data.product_id,
        custom_price:    parsed.data.custom_price,
        custom_min_qty:  parsed.data.custom_min_qty ?? null,
        valid_from:      parsed.data.valid_from ?? null,
        valid_to:        parsed.data.valid_to ?? null,
        notes:           parsed.data.notes ?? null,
      },
      { onConflict: "relationship_id,product_id" },
    )
    .select("*")
    .single() as { data: PriceListRow | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "Errore salvataggio listino" };
  revalidatePath(`/supplier/clienti/${parsed.data.relationship_id}/listino`);
  return { ok: true, data };
}

export async function updatePriceListEntry(id: string, input: PriceListUpdateInput): Promise<Result> {
  const parsed = PriceListUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("supplier_price_lists")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/supplier/clienti");
  return { ok: true, data: undefined };
}

export async function deletePriceListEntry(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_price_lists")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/supplier/clienti");
  return { ok: true, data: undefined };
}
