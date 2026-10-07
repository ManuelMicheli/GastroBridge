/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRestaurantContext } from "@/lib/restaurants/context";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

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
  /** Per-catalog subtotals, checked against restaurant_catalogs.min_order_amount. */
  groups?: { catalogId: string; subtotal: number }[];
}): Promise<Result<{ id: string }>> {
  if (!Number.isFinite(input.total) || input.total < 0) {
    return { ok: false, error: "Totale non valido" };
  }

  // Owner or a team member whose role may submit orders (chef / manager).
  const auth = await requireRestaurantContext("order.submit");
  if (!auth.ok) return { ok: false, error: auth.error };
  const restaurantId = auth.ctx.restaurantId;

  const supabase = await createClient();

  // Ordine minimo per catalogo (la UI mostra lo scostamento, qui lo si impone).
  const groups = (input.groups ?? []).filter((g) => g.catalogId);
  if (groups.length > 0) {
    const { data: catalogs } = await (supabase as any)
      .from("restaurant_catalogs")
      .select("id, supplier_name, min_order_amount")
      .in("restaurant_id", auth.ctx.scopeIds)
      .in("id", groups.map((g) => g.catalogId)) as {
        data: { id: string; supplier_name: string | null; min_order_amount: number | null }[] | null;
      };
    const shortfalls: string[] = [];
    for (const c of catalogs ?? []) {
      const min = Number(c.min_order_amount ?? 0);
      const subtotal = groups.find((g) => g.catalogId === c.id)?.subtotal ?? 0;
      if (min > 0 && subtotal + 1e-9 < min) {
        const missing = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })
          .format(min - subtotal);
        shortfalls.push(`${c.supplier_name ?? "fornitore"} (mancano ${missing})`);
      }
    }
    if (shortfalls.length > 0) {
      return { ok: false, error: `Ordine minimo non raggiunto per ${shortfalls.join(", ")}` };
    }
  }
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
