/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getRestaurantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

/**
 * Create a minimal order row from the catalog-based cart.
 * We only persist the header (restaurant_id + total + status + notes) — we
 * don't insert order_items because those have FK constraints to the
 * marketplace products/suppliers tables which our catalog items bypass.
 */
export async function createCatalogOrder(input: {
  total: number;
  supplierCount: number;
  itemCount: number;
  summary: string; // multiline text stored in notes
}): Promise<Result<{ id: string }>> {
  if (!Number.isFinite(input.total) || input.total < 0) {
    return { ok: false, error: "Totale non valido" };
  }

  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { ok: false, error: "Ristorante non trovato" };

  const supabase = await createClient();
  const notes = [
    `Ordine da ${input.supplierCount} fornitore${input.supplierCount === 1 ? "" : "i"}, ${input.itemCount} articoli`,
    "",
    input.summary,
  ].join("\n");

  const { data, error } = await (supabase as any)
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      total:         input.total,
      status:        "submitted",
      notes,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Errore invio ordine" };

  revalidatePath("/dashboard");
  revalidatePath("/ordini");
  return { ok: true, data: { id: data.id } };
}
