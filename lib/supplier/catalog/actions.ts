/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts on Supabase client calls are required until the generated
// database types fully cover `product_sales_units` with all its columns.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";
import type { Database } from "@/types/database";
import {
  ProductBasePatchSchema,
  ProductCreateSchema,
  SalesUnitsArraySchema,
  type ProductBasePatch,
  type ProductCreateInput,
  type SalesUnitInput,
} from "./schemas";

type SalesUnitRow = Database["public"]["Tables"]["product_sales_units"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function resolveSupplierId(productId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("supplier_id")
    .eq("id", productId)
    .maybeSingle<{ supplier_id: string }>();
  return data?.supplier_id ?? null;
}

export async function listSalesUnitsForProduct(
  productId: string,
): Promise<Result<SalesUnitRow[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("product_sales_units")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as SalesUnitRow[] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore caricamento unità",
    };
  }
}

export async function upsertSalesUnits(
  productId: string,
  units: SalesUnitInput[],
): Promise<Result<SalesUnitRow[]>> {
  try {
    if (!productId) return { ok: false, error: "Prodotto non valido" };

    const parsed = SalesUnitsArraySchema.safeParse(units);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supplierId = await resolveSupplierId(productId);
    if (!supplierId) return { ok: false, error: "Prodotto non trovato" };

    await requirePermission(supplierId, "catalog.edit");

    const supabase = await createClient();

    const { data: existingRaw, error: existingErr } = await (supabase as any)
      .from("product_sales_units")
      .select("id")
      .eq("product_id", productId);
    if (existingErr) return { ok: false, error: existingErr.message };

    const existingIds = new Set(
      ((existingRaw ?? []) as { id: string }[]).map((r) => r.id),
    );
    const incomingIds = new Set(
      parsed.data.filter((u) => u.id).map((u) => u.id as string),
    );

    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    const toInsert = parsed.data.filter((u) => !u.id);
    const toUpdate = parsed.data.filter((u) => u.id && existingIds.has(u.id));

    // First: clear is_base on rows that will no longer be base to avoid
    // the single-base constraint firing mid-batch.
    const newBase = parsed.data.find((u) => u.is_base);
    if (newBase && !newBase.id) {
      // Will become base via insert — reset all existing bases first.
      const { error: resetErr } = await (supabase as any)
        .from("product_sales_units")
        .update({ is_base: false })
        .eq("product_id", productId)
        .eq("is_base", true);
      if (resetErr) return { ok: false, error: resetErr.message };
    } else if (newBase && newBase.id) {
      const { error: resetErr } = await (supabase as any)
        .from("product_sales_units")
        .update({ is_base: false })
        .eq("product_id", productId)
        .eq("is_base", true)
        .neq("id", newBase.id);
      if (resetErr) return { ok: false, error: resetErr.message };
    }

    if (toDelete.length > 0) {
      const { error: delErr } = await (supabase as any)
        .from("product_sales_units")
        .delete()
        .in("id", toDelete);
      if (delErr) return { ok: false, error: delErr.message };
    }

    for (const u of toUpdate) {
      const { error: updErr } = await (supabase as any)
        .from("product_sales_units")
        .update({
          label: u.label,
          unit_type: u.unit_type,
          conversion_to_base: u.conversion_to_base,
          is_base: u.is_base,
          barcode: u.barcode ?? null,
          moq: u.moq,
          sort_order: u.sort_order,
          is_active: u.is_active,
        })
        .eq("id", u.id!);
      if (updErr) return { ok: false, error: updErr.message };
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map((u) => ({
        product_id: productId,
        label: u.label,
        unit_type: u.unit_type,
        conversion_to_base: u.conversion_to_base,
        is_base: u.is_base,
        barcode: u.barcode ?? null,
        moq: u.moq,
        sort_order: u.sort_order,
        is_active: u.is_active,
      }));
      const { error: insErr } = await (supabase as any)
        .from("product_sales_units")
        .insert(rows);
      if (insErr) return { ok: false, error: insErr.message };
    }

    const { data: freshRaw, error: fetchErr } = await (supabase as any)
      .from("product_sales_units")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (fetchErr) return { ok: false, error: fetchErr.message };

    revalidatePath(`/supplier/catalogo`);
    revalidatePath(`/supplier/catalogo/${productId}`);

    return { ok: true, data: (freshRaw ?? []) as SalesUnitRow[] };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore salvataggio unità",
    };
  }
}

export async function deleteSalesUnit(
  productId: string,
  unitId: string,
): Promise<Result> {
  try {
    if (!productId || !unitId) {
      return { ok: false, error: "Parametri non validi" };
    }

    const supplierId = await resolveSupplierId(productId);
    if (!supplierId) return { ok: false, error: "Prodotto non trovato" };
    await requirePermission(supplierId, "catalog.edit");

    const supabase = await createClient();

    const { data: row, error: rowErr } = await (supabase as any)
      .from("product_sales_units")
      .select("is_base")
      .eq("id", unitId)
      .eq("product_id", productId)
      .maybeSingle();
    if (rowErr) return { ok: false, error: rowErr.message };
    if (!row) return { ok: false, error: "Unità non trovata" };
    if ((row as { is_base: boolean }).is_base) {
      return {
        ok: false,
        error: "Impossibile eliminare l'unità base",
      };
    }

    const { error } = await (supabase as any)
      .from("product_sales_units")
      .delete()
      .eq("id", unitId)
      .eq("product_id", productId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/supplier/catalogo`);
    revalidatePath(`/supplier/catalogo/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore eliminazione unità",
    };
  }
}

async function refreshCatalogSummary(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    await (supabase.rpc as unknown as (fn: "refresh_catalog_summary") => Promise<{ data: unknown; error: unknown }>)(
      "refresh_catalog_summary",
    );
  } catch {
    // Non-fatal: stale MV for a few seconds is acceptable.
  }
}

export async function createProduct(
  input: ProductCreateInput,
): Promise<Result<ProductRow>> {
  try {
    const parsed = ProductCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    await requirePermission(parsed.data.supplier_id, "catalog.edit");

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("products")
      .insert(parsed.data)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore creazione" };
    }

    await refreshCatalogSummary(supabase);
    revalidatePath("/supplier/catalogo");
    return { ok: true, data: data as ProductRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore creazione prodotto",
    };
  }
}

export async function deleteProduct(
  productId: string,
): Promise<Result> {
  try {
    if (!productId) return { ok: false, error: "Prodotto non valido" };

    const supplierId = await resolveSupplierId(productId);
    if (!supplierId) return { ok: false, error: "Prodotto non trovato" };
    await requirePermission(supplierId, "catalog.edit");

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("products")
      .delete()
      .eq("id", productId);
    if (error) return { ok: false, error: error.message };

    await refreshCatalogSummary(supabase);
    revalidatePath("/supplier/catalogo");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore eliminazione prodotto",
    };
  }
}

export async function toggleProductAvailability(
  productId: string,
  value: boolean,
): Promise<Result> {
  try {
    if (!productId) return { ok: false, error: "Prodotto non valido" };

    const supplierId = await resolveSupplierId(productId);
    if (!supplierId) return { ok: false, error: "Prodotto non trovato" };
    await requirePermission(supplierId, "catalog.edit");

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("products")
      .update({ is_available: value })
      .eq("id", productId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/supplier/catalogo");
    revalidatePath(`/supplier/catalogo/${productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Errore aggiornamento disponibilità",
    };
  }
}

// ------------------------------------------------------------------
// Bulk ops — Phase 2C.
// Shims provided here so the UI (Phase 2A) can wire the invocation
// paths without breakage when 2C lands.
// ------------------------------------------------------------------

export async function bulkDeleteProducts(
  _supplierId: string,
  _productIds: string[],
): Promise<Result> {
  return {
    ok: false,
    error: "Bulk delete disponibile dalla Fase 2C",
  };
}

export async function bulkToggleAvailability(
  _supplierId: string,
  _productIds: string[],
  _value: boolean,
): Promise<Result> {
  return {
    ok: false,
    error: "Bulk toggle disponibile dalla Fase 2C",
  };
}

export async function bulkUpdateCategory(
  _supplierId: string,
  _productIds: string[],
  _categoryId: string,
): Promise<Result> {
  return {
    ok: false,
    error: "Bulk categoria disponibile dalla Fase 2C",
  };
}

export async function updateProductBase(
  productId: string,
  patch: ProductBasePatch,
): Promise<Result<ProductRow>> {
  try {
    if (!productId) return { ok: false, error: "Prodotto non valido" };

    const parsed = ProductBasePatchSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    const supplierId = await resolveSupplierId(productId);
    if (!supplierId) return { ok: false, error: "Prodotto non trovato" };
    await requirePermission(supplierId, "catalog.edit");

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("products")
      .update(parsed.data)
      .eq("id", productId)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore aggiornamento" };
    }

    revalidatePath(`/supplier/catalogo`);
    revalidatePath(`/supplier/catalogo/${productId}`);
    return { ok: true, data: data as ProductRow };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore aggiornamento prodotto",
    };
  }
}
