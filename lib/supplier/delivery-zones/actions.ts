/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";
import {
  DeliveryZoneSchema,
  type DeliveryZoneInput,
} from "./schemas";
import type { Database } from "@/types/database";

type ZoneRow = Database["public"]["Tables"]["delivery_zones"]["Row"];

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function normalize(input: DeliveryZoneInput) {
  return {
    zone_name: input.zone_name.trim(),
    provinces: input.provinces.map((p) => p.trim().toUpperCase()),
    zip_codes: (input.zip_codes ?? []).map((z) => z.trim()),
    delivery_fee: input.delivery_fee,
    free_delivery_above: input.free_delivery_above ?? null,
    delivery_days: [...input.delivery_days].sort((a, b) => a - b),
    cutoff_time: input.cutoff_time,
    delivery_slots: input.delivery_slots as unknown as Record<string, unknown>,
    warehouse_id: input.warehouse_id,
  };
}

function revalidateAll() {
  revalidatePath("/supplier/impostazioni/zone");
  revalidatePath("/supplier/impostazioni");
  revalidatePath("/supplier/dashboard");
}

export async function listZones(
  supplierId: string,
): Promise<Result<ZoneRow[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: true })
      .returns<ZoneRow[]>();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore caricamento zone",
    };
  }
}

export async function createZone(
  supplierId: string,
  input: DeliveryZoneInput,
): Promise<Result<ZoneRow>> {
  try {
    if (!supplierId) return { ok: false, error: "Fornitore non valido" };
    const parsed = DeliveryZoneSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    await requirePermission(supplierId, "settings.manage");

    const supabase = await createClient();
    const { data, error } = (await (supabase as any)
      .from("delivery_zones")
      .insert({
        supplier_id: supplierId,
        ...normalize(parsed.data),
      })
      .select("*")
      .single()) as {
      data: ZoneRow | null;
      error: { message: string } | null;
    };

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Errore creazione zona",
      };
    }
    revalidateAll();
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore creazione zona",
    };
  }
}

export async function updateZone(
  supplierId: string,
  id: string,
  input: DeliveryZoneInput,
): Promise<Result> {
  try {
    if (!supplierId || !id)
      return { ok: false, error: "Parametri non validi" };
    const parsed = DeliveryZoneSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    await requirePermission(supplierId, "settings.manage");

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("delivery_zones")
      .update(normalize(parsed.data))
      .eq("id", id)
      .eq("supplier_id", supplierId);

    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Errore aggiornamento zona",
    };
  }
}

export async function deleteZone(
  supplierId: string,
  id: string,
): Promise<Result> {
  try {
    if (!supplierId || !id)
      return { ok: false, error: "Parametri non validi" };

    await requirePermission(supplierId, "settings.manage");

    const supabase = await createClient();
    const { error } = await supabase
      .from("delivery_zones")
      .delete()
      .eq("id", id)
      .eq("supplier_id", supplierId);

    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore eliminazione zona",
    };
  }
}
