/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts on Supabase client calls are required until the generated
// database types fully cover `warehouses` writes.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";
import { WarehouseSchema, type WarehouseInput } from "./schemas";
import type { Database } from "@/types/database";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

function normalize(input: WarehouseInput) {
  return {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    province: input.province?.trim() || null,
    zip_code: input.zip_code?.trim() || null,
  };
}

function revalidateAll() {
  revalidatePath("/supplier/impostazioni/sedi");
  revalidatePath("/supplier/impostazioni");
  revalidatePath("/supplier/dashboard");
}

export async function listWarehouses(
  supplierId: string,
): Promise<Result<WarehouseRow[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("warehouses")
      .select(
        "id, supplier_id, name, address, city, province, zip_code, latitude, longitude, is_primary, is_active, created_at",
      )
      .eq("supplier_id", supplierId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<WarehouseRow[]>();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore caricamento sedi",
    };
  }
}

export async function createWarehouse(
  supplierId: string,
  input: WarehouseInput,
): Promise<Result<WarehouseRow>> {
  try {
    if (!supplierId) return { ok: false, error: "Fornitore non valido" };
    const parsed = WarehouseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    await requirePermission(supplierId, "settings.manage");

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("warehouses")
      .select("id")
      .eq("supplier_id", supplierId);

    const isFirst = !existing || existing.length === 0;
    const shouldBePrimary = parsed.data.is_primary ?? isFirst;

    if (shouldBePrimary && !isFirst) {
      const { error: unsetErr } = await (supabase as any)
        .from("warehouses")
        .update({ is_primary: false })
        .eq("supplier_id", supplierId)
        .eq("is_primary", true);
      if (unsetErr) return { ok: false, error: unsetErr.message };
    }

    const { data, error } = (await (supabase as any)
      .from("warehouses")
      .insert({
        supplier_id: supplierId,
        ...normalize(parsed.data),
        is_primary: shouldBePrimary,
        is_active: parsed.data.is_active ?? true,
      })
      .select("*")
      .single()) as { data: WarehouseRow | null; error: { message: string } | null };

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore creazione sede" };
    }
    revalidateAll();
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore creazione sede",
    };
  }
}

export async function updateWarehouse(
  supplierId: string,
  id: string,
  input: WarehouseInput,
): Promise<Result> {
  try {
    if (!supplierId || !id) return { ok: false, error: "Parametri non validi" };
    const parsed = WarehouseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    await requirePermission(supplierId, "settings.manage");

    const supabase = await createClient();

    if (parsed.data.is_primary === true) {
      const { error: unsetErr } = await (supabase as any)
        .from("warehouses")
        .update({ is_primary: false })
        .eq("supplier_id", supplierId)
        .neq("id", id)
        .eq("is_primary", true);
      if (unsetErr) return { ok: false, error: unsetErr.message };
    }

    let forcedPrimary = false;
    if (parsed.data.is_primary === false) {
      const { data: others } = await supabase
        .from("warehouses")
        .select("id")
        .eq("supplier_id", supplierId)
        .eq("is_primary", true)
        .neq("id", id)
        .returns<Array<{ id: string }>>();
      if (!others || others.length === 0) {
        forcedPrimary = true;
      }
    }

    const nextIsPrimary =
      parsed.data.is_primary === true
        ? true
        : forcedPrimary
          ? true
          : parsed.data.is_primary === false
            ? false
            : undefined;

    const payload: Record<string, unknown> = {
      ...normalize(parsed.data),
      ...(nextIsPrimary !== undefined ? { is_primary: nextIsPrimary } : {}),
      ...(parsed.data.is_active !== undefined
        ? { is_active: parsed.data.is_active }
        : {}),
    };

    const { error } = await (supabase as any)
      .from("warehouses")
      .update(payload)
      .eq("id", id)
      .eq("supplier_id", supplierId);

    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore aggiornamento sede",
    };
  }
}

export async function setPrimaryWarehouse(
  supplierId: string,
  id: string,
): Promise<Result> {
  try {
    if (!supplierId || !id) return { ok: false, error: "Parametri non validi" };
    await requirePermission(supplierId, "settings.manage");

    const supabase = await createClient();

    const { error: unsetErr } = await (supabase as any)
      .from("warehouses")
      .update({ is_primary: false })
      .eq("supplier_id", supplierId)
      .eq("is_primary", true);
    if (unsetErr) return { ok: false, error: unsetErr.message };

    const { error } = await (supabase as any)
      .from("warehouses")
      .update({ is_primary: true })
      .eq("id", id)
      .eq("supplier_id", supplierId);

    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore impostazione primary",
    };
  }
}

export async function archiveWarehouse(
  supplierId: string,
  id: string,
): Promise<Result> {
  try {
    if (!supplierId || !id) return { ok: false, error: "Parametri non validi" };
    await requirePermission(supplierId, "settings.manage");

    const supabase = await createClient();

    const { data: target } = await supabase
      .from("warehouses")
      .select("is_primary")
      .eq("id", id)
      .eq("supplier_id", supplierId)
      .maybeSingle<{ is_primary: boolean | null }>();

    if (!target) return { ok: false, error: "Sede non trovata" };
    if (target.is_primary) {
      return {
        ok: false,
        error: "Impossibile archiviare la sede principale. Imposta un'altra sede come principale prima.",
      };
    }

    const { error } = await (supabase as any)
      .from("warehouses")
      .update({ is_active: false })
      .eq("id", id)
      .eq("supplier_id", supplierId);

    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore archiviazione sede",
    };
  }
}
