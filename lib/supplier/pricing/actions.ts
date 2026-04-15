/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts on Supabase client calls are required until the generated
// database types fully cover the new pricing tables with all relations.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";
import type { Database } from "@/types/database";
import {
  PriceListSchema,
  PriceListPatchSchema,
  PriceListItemsArraySchema,
  TierDiscountsArraySchema,
  BulkUpdateSchema,
  CustomerAssignmentSchema,
  type PriceListInput,
  type PriceListPatch,
  type PriceListItemPatch,
  type TierDiscountInput,
  type BulkUpdateInput,
  type CustomerAssignmentInput,
} from "./schemas";

type PriceListRow = Database["public"]["Tables"]["price_lists"]["Row"];
type PriceListItemRow =
  Database["public"]["Tables"]["price_list_items"]["Row"];
type TierDiscountRow =
  Database["public"]["Tables"]["price_list_tier_discounts"]["Row"];
type CustomerAssignmentRow =
  Database["public"]["Tables"]["customer_price_assignments"]["Row"];

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function resolveSupplierIdFromList(
  listId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_lists")
    .select("supplier_id")
    .eq("id", listId)
    .maybeSingle<{ supplier_id: string }>();
  return data?.supplier_id ?? null;
}

async function clearOtherDefaults(
  supplierId: string,
  exceptListId?: string,
): Promise<string | null> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("price_lists")
    .update({ is_default: false })
    .eq("supplier_id", supplierId)
    .eq("is_default", true);
  if (exceptListId) query = query.neq("id", exceptListId);
  const { error } = await query;
  return error ? error.message : null;
}

export async function listPriceLists(
  supplierId: string,
): Promise<Result<PriceListRow[]>> {
  try {
    if (!supplierId) return { ok: false, error: "Fornitore non valido" };
    await requirePermission(supplierId, "pricing.edit");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_lists")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as PriceListRow[] };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore caricamento listini",
    };
  }
}

export async function createPriceList(
  supplierId: string,
  input: PriceListInput,
): Promise<Result<PriceListRow>> {
  try {
    if (!supplierId) return { ok: false, error: "Fornitore non valido" };
    await requirePermission(supplierId, "pricing.edit");

    const parsed = PriceListSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supabase = await createClient();

    if (parsed.data.is_default) {
      const err = await clearOtherDefaults(supplierId);
      if (err) return { ok: false, error: err };
    }

    const { data, error } = await (supabase as any)
      .from("price_lists")
      .insert({
        supplier_id: supplierId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        is_default: parsed.data.is_default,
        valid_from: parsed.data.valid_from ?? null,
        valid_to: parsed.data.valid_to ?? null,
        is_active: parsed.data.is_active,
      })
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore creazione listino" };
    }

    revalidatePath("/supplier/listini");
    return { ok: true, data: data as PriceListRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore creazione listino",
    };
  }
}

export async function updatePriceList(
  listId: string,
  patch: PriceListPatch,
): Promise<Result<PriceListRow>> {
  try {
    if (!listId) return { ok: false, error: "Listino non valido" };

    const parsed = PriceListPatchSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supplierId = await resolveSupplierIdFromList(listId);
    if (!supplierId) return { ok: false, error: "Listino non trovato" };
    await requirePermission(supplierId, "pricing.edit");

    const supabase = await createClient();

    if (parsed.data.is_default === true) {
      const err = await clearOtherDefaults(supplierId, listId);
      if (err) return { ok: false, error: err };
    }

    const { data, error } = await (supabase as any)
      .from("price_lists")
      .update(parsed.data)
      .eq("id", listId)
      .select("*")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Errore aggiornamento listino",
      };
    }

    revalidatePath("/supplier/listini");
    revalidatePath(`/supplier/listini/${listId}`);
    return { ok: true, data: data as PriceListRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore aggiornamento listino",
    };
  }
}

export async function deletePriceList(listId: string): Promise<Result> {
  try {
    if (!listId) return { ok: false, error: "Listino non valido" };

    const supplierId = await resolveSupplierIdFromList(listId);
    if (!supplierId) return { ok: false, error: "Listino non trovato" };
    await requirePermission(supplierId, "pricing.edit");

    const supabase = await createClient();
    const { data: row, error: rowErr } = await supabase
      .from("price_lists")
      .select("is_default")
      .eq("id", listId)
      .maybeSingle<{ is_default: boolean }>();
    if (rowErr) return { ok: false, error: rowErr.message };
    if (!row) return { ok: false, error: "Listino non trovato" };
    if (row.is_default) {
      return {
        ok: false,
        error: "Impossibile eliminare il listino predefinito",
      };
    }

    const { error } = await (supabase as any)
      .from("price_lists")
      .delete()
      .eq("id", listId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/supplier/listini");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore eliminazione listino",
    };
  }
}

export async function listItemsForList(
  listId: string,
): Promise<Result<PriceListItemRow[]>> {
  try {
    if (!listId) return { ok: false, error: "Listino non valido" };
    const supplierId = await resolveSupplierIdFromList(listId);
    if (!supplierId) return { ok: false, error: "Listino non trovato" };
    await requirePermission(supplierId, "pricing.edit");

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("price_list_items")
      .select("*")
      .eq("price_list_id", listId)
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as PriceListItemRow[] };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore caricamento righe listino",
    };
  }
}

export async function upsertPriceListItems(
  listId: string,
  items: PriceListItemPatch[],
): Promise<Result<PriceListItemRow[]>> {
  try {
    if (!listId) return { ok: false, error: "Listino non valido" };

    const parsed = PriceListItemsArraySchema.safeParse(items);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supplierId = await resolveSupplierIdFromList(listId);
    if (!supplierId) return { ok: false, error: "Listino non trovato" };
    await requirePermission(supplierId, "pricing.edit");

    const supabase = await createClient();

    const toInsert = parsed.data.filter((i) => !i.id);
    const toUpdate = parsed.data.filter((i) => i.id);

    for (const i of toUpdate) {
      const { error: updErr } = await (supabase as any)
        .from("price_list_items")
        .update({
          product_id: i.product_id,
          sales_unit_id: i.sales_unit_id,
          price: i.price,
        })
        .eq("id", i.id!)
        .eq("price_list_id", listId);
      if (updErr) return { ok: false, error: updErr.message };
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map((i) => ({
        price_list_id: listId,
        product_id: i.product_id,
        sales_unit_id: i.sales_unit_id,
        price: i.price,
      }));
      const { error: insErr } = await (supabase as any)
        .from("price_list_items")
        .insert(rows);
      if (insErr) return { ok: false, error: insErr.message };
    }

    const { data: fresh, error: fetchErr } = await (supabase as any)
      .from("price_list_items")
      .select("*")
      .eq("price_list_id", listId)
      .order("created_at", { ascending: true });
    if (fetchErr) return { ok: false, error: fetchErr.message };

    revalidatePath("/supplier/listini");
    revalidatePath(`/supplier/listini/${listId}`);
    return { ok: true, data: (fresh ?? []) as PriceListItemRow[] };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore salvataggio righe",
    };
  }
}

export async function upsertPriceListItem(
  listId: string,
  item: PriceListItemPatch,
): Promise<Result<PriceListItemRow>> {
  const res = await upsertPriceListItems(listId, [item]);
  if (!res.ok) return res;
  const match = res.data.find(
    (r) =>
      r.product_id === item.product_id && r.sales_unit_id === item.sales_unit_id,
  );
  if (!match) return { ok: false, error: "Riga non trovata dopo salvataggio" };
  return { ok: true, data: match };
}

export async function upsertTierDiscounts(
  priceListItemId: string,
  tiers: TierDiscountInput[],
): Promise<Result<TierDiscountRow[]>> {
  try {
    if (!priceListItemId) {
      return { ok: false, error: "Riga listino non valida" };
    }

    const parsed = TierDiscountsArraySchema.safeParse(tiers);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supabase = await createClient();

    const { data: itemRow, error: itemErr } = await (supabase as any)
      .from("price_list_items")
      .select("price_list_id")
      .eq("id", priceListItemId)
      .maybeSingle();
    if (itemErr) return { ok: false, error: itemErr.message };
    if (!itemRow) return { ok: false, error: "Riga listino non trovata" };

    const listId = (itemRow as { price_list_id: string }).price_list_id;
    const supplierId = await resolveSupplierIdFromList(listId);
    if (!supplierId) return { ok: false, error: "Listino non trovato" };
    await requirePermission(supplierId, "pricing.edit");

    const { error: delErr } = await (supabase as any)
      .from("price_list_tier_discounts")
      .delete()
      .eq("price_list_item_id", priceListItemId);
    if (delErr) return { ok: false, error: delErr.message };

    if (parsed.data.length > 0) {
      const rows = parsed.data.map((t, idx) => ({
        price_list_item_id: priceListItemId,
        min_quantity: t.min_quantity,
        discount_pct: t.discount_pct,
        sort_order: t.sort_order ?? idx,
      }));
      const { error: insErr } = await (supabase as any)
        .from("price_list_tier_discounts")
        .insert(rows);
      if (insErr) return { ok: false, error: insErr.message };
    }

    const { data: fresh, error: fetchErr } = await (supabase as any)
      .from("price_list_tier_discounts")
      .select("*")
      .eq("price_list_item_id", priceListItemId)
      .order("sort_order", { ascending: true });
    if (fetchErr) return { ok: false, error: fetchErr.message };

    revalidatePath("/supplier/listini");
    revalidatePath(`/supplier/listini/${listId}`);
    return { ok: true, data: (fresh ?? []) as TierDiscountRow[] };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore salvataggio sconti",
    };
  }
}

export async function bulkUpdatePrices(
  listId: string,
  input: BulkUpdateInput,
): Promise<Result<number>> {
  try {
    if (!listId) return { ok: false, error: "Listino non valido" };

    const parsed = BulkUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supplierId = await resolveSupplierIdFromList(listId);
    if (!supplierId) return { ok: false, error: "Listino non trovato" };
    await requirePermission(supplierId, "pricing.edit");

    const supabase = await createClient();

    // Carichiamo gli items del listino, eventualmente filtrati per categoria del prodotto
    let productIds: string[] | null = null;
    if (parsed.data.filter?.category_id) {
      const { data: prods, error: prodErr } = await supabase
        .from("products")
        .select("id")
        .eq("supplier_id", supplierId)
        .eq("category_id", parsed.data.filter.category_id);
      if (prodErr) return { ok: false, error: prodErr.message };
      productIds = ((prods ?? []) as { id: string }[]).map((p) => p.id);
      if (productIds.length === 0) return { ok: true, data: 0 };
    }

    let query = (supabase as any)
      .from("price_list_items")
      .select("id, price, product_id")
      .eq("price_list_id", listId);
    if (productIds) query = query.in("product_id", productIds);

    const { data: items, error: itemsErr } = await query;
    if (itemsErr) return { ok: false, error: itemsErr.message };

    const rows = (items ?? []) as { id: string; price: number }[];
    let count = 0;
    for (const r of rows) {
      const newPrice =
        parsed.data.mode === "percent"
          ? Math.max(0, r.price * (1 + parsed.data.value / 100))
          : Math.max(0, r.price + parsed.data.value);
      const rounded = Math.round(newPrice * 10000) / 10000;
      const { error: updErr } = await (supabase as any)
        .from("price_list_items")
        .update({ price: rounded })
        .eq("id", r.id);
      if (updErr) return { ok: false, error: updErr.message };
      count++;
    }

    revalidatePath("/supplier/listini");
    revalidatePath(`/supplier/listini/${listId}`);
    return { ok: true, data: count };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore aggiornamento prezzi",
    };
  }
}

export async function duplicatePriceList(
  sourceId: string,
  newName: string,
): Promise<Result<PriceListRow>> {
  try {
    if (!sourceId) return { ok: false, error: "Listino sorgente non valido" };
    const trimmed = newName?.trim();
    if (!trimmed) return { ok: false, error: "Nome obbligatorio" };

    const supplierId = await resolveSupplierIdFromList(sourceId);
    if (!supplierId) return { ok: false, error: "Listino non trovato" };
    await requirePermission(supplierId, "pricing.edit");

    const supabase = await createClient();

    const { data: src, error: srcErr } = await supabase
      .from("price_lists")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle<PriceListRow>();
    if (srcErr) return { ok: false, error: srcErr.message };
    if (!src) return { ok: false, error: "Listino non trovato" };

    const { data: created, error: createErr } = await (supabase as any)
      .from("price_lists")
      .insert({
        supplier_id: supplierId,
        name: trimmed,
        description: src.description,
        is_default: false,
        valid_from: src.valid_from,
        valid_to: src.valid_to,
        is_active: src.is_active,
      })
      .select("*")
      .single();
    if (createErr || !created) {
      return {
        ok: false,
        error: createErr?.message ?? "Errore duplicazione listino",
      };
    }

    const newList = created as PriceListRow;

    const { data: items, error: itemsErr } = await (supabase as any)
      .from("price_list_items")
      .select("product_id, sales_unit_id, price")
      .eq("price_list_id", sourceId);
    if (itemsErr) return { ok: false, error: itemsErr.message };

    const srcItems = (items ?? []) as {
      product_id: string;
      sales_unit_id: string;
      price: number;
    }[];

    if (srcItems.length > 0) {
      const rows = srcItems.map((i) => ({
        price_list_id: newList.id,
        product_id: i.product_id,
        sales_unit_id: i.sales_unit_id,
        price: i.price,
      }));
      const { error: insErr } = await (supabase as any)
        .from("price_list_items")
        .insert(rows);
      if (insErr) return { ok: false, error: insErr.message };
    }

    revalidatePath("/supplier/listini");
    return { ok: true, data: newList };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore duplicazione listino",
    };
  }
}

export async function assignCustomer(
  supplierId: string,
  input: CustomerAssignmentInput,
): Promise<Result<CustomerAssignmentRow>> {
  try {
    if (!supplierId) return { ok: false, error: "Fornitore non valido" };
    await requirePermission(supplierId, "pricing.edit");

    const parsed = CustomerAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supabase = await createClient();

    // Verifica coerenza: il listino deve appartenere al fornitore.
    const listSupplierId = await resolveSupplierIdFromList(
      parsed.data.price_list_id,
    );
    if (listSupplierId !== supplierId) {
      return { ok: false, error: "Listino non valido per il fornitore" };
    }

    // Upsert-style: rimuoviamo eventuale assegnazione precedente e creiamo la nuova.
    const { error: delErr } = await (supabase as any)
      .from("customer_price_assignments")
      .delete()
      .eq("supplier_id", supplierId)
      .eq("restaurant_id", parsed.data.restaurant_id);
    if (delErr) return { ok: false, error: delErr.message };

    const { data, error } = await (supabase as any)
      .from("customer_price_assignments")
      .insert({
        supplier_id: supplierId,
        restaurant_id: parsed.data.restaurant_id,
        price_list_id: parsed.data.price_list_id,
      })
      .select("*")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Errore assegnazione cliente",
      };
    }

    revalidatePath("/supplier/listini");
    return { ok: true, data: data as CustomerAssignmentRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore assegnazione cliente",
    };
  }
}
