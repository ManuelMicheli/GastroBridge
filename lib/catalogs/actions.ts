/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts on Supabase client calls are required until the generated
// database types are regenerated to include restaurant_catalogs[_items].
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CatalogSchema, CatalogItemSchema, type CatalogInput, type CatalogItemInput } from "./schemas";
import { normalizeName, normalizeUnit } from "./normalize";
import type { CatalogRow } from "./types";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getRestaurantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing?.id) return existing.id;

  // Auto-provision a restaurant row for users who signed up as restaurant
  // but never completed the onboarding step that creates one.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_name")
    .eq("id", user.id)
    .single<{ role: string; company_name: string }>();

  if (!profile || profile.role !== "restaurant") return null;

  const fallbackName = profile.company_name?.trim() || user.email?.split("@")[0] || "Ristorante";
  const { data: created } = await (supabase as any)
    .from("restaurants")
    .insert({ profile_id: user.id, name: fallbackName })
    .select("id")
    .single();

  return created?.id ?? null;
}

export async function createCatalog(input: CatalogInput): Promise<Result<CatalogRow>> {
  const parsed = CatalogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { ok: false, error: "Ristorante non trovato" };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("restaurant_catalogs")
    .insert({
      restaurant_id:    restaurantId,
      supplier_name:    parsed.data.supplier_name,
      delivery_days:    parsed.data.delivery_days ?? null,
      min_order_amount: parsed.data.min_order_amount ?? null,
      notes:            parsed.data.notes ?? null,
    })
    .select("*")
    .single() as { data: CatalogRow | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "Errore creazione catalogo" };
  revalidatePath("/cataloghi");
  return { ok: true, data };
}

export async function updateCatalog(id: string, input: CatalogInput): Promise<Result> {
  const parsed = CatalogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_catalogs")
    .update({
      supplier_name:    parsed.data.supplier_name,
      delivery_days:    parsed.data.delivery_days ?? null,
      min_order_amount: parsed.data.min_order_amount ?? null,
      notes:            parsed.data.notes ?? null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cataloghi");
  revalidatePath(`/cataloghi/${id}`);
  return { ok: true, data: undefined };
}

export async function deleteCatalog(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_catalogs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cataloghi");
  return { ok: true, data: undefined };
}

export async function createCatalogItem(catalogId: string, input: CatalogItemInput): Promise<Result> {
  const parsed = CatalogItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("restaurant_catalog_items").insert({
    catalog_id:               catalogId,
    product_name:             parsed.data.product_name,
    product_name_normalized:  normalizeName(parsed.data.product_name),
    unit:                     normalizeUnit(parsed.data.unit),
    price:                    parsed.data.price,
    notes:                    parsed.data.notes ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cataloghi/${catalogId}`);
  return { ok: true, data: undefined };
}

export async function updateCatalogItem(id: string, catalogId: string, input: CatalogItemInput): Promise<Result> {
  const parsed = CatalogItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_catalog_items")
    .update({
      product_name:            parsed.data.product_name,
      product_name_normalized: normalizeName(parsed.data.product_name),
      unit:                    normalizeUnit(parsed.data.unit),
      price:                   parsed.data.price,
      notes:                   parsed.data.notes ?? null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cataloghi/${catalogId}`);
  return { ok: true, data: undefined };
}

export async function deleteCatalogItem(id: string, catalogId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_catalog_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cataloghi/${catalogId}`);
  return { ok: true, data: undefined };
}

/**
 * Batch import: validates all rows, then (if mode === 'replace') deletes current items,
 * then inserts the new ones in chunks of 500.
 */
export async function importCatalogItems(
  catalogId: string,
  rows: CatalogItemInput[],
  mode: "replace" | "append",
): Promise<Result<{ inserted: number }>> {
  if (rows.length === 0) return { ok: false, error: "Nessuna riga da importare" };
  if (rows.length > 5000) return { ok: false, error: "Massimo 5000 righe per import" };

  // Validate all rows before touching DB
  const prepared: {
    catalog_id: string;
    product_name: string;
    product_name_normalized: string;
    unit: string;
    price: number;
    notes: string | null;
  }[] = [];
  for (const row of rows) {
    const parsed = CatalogItemSchema.safeParse(row);
    if (!parsed.success) {
      return { ok: false, error: `Riga non valida: ${parsed.error.issues[0]?.message ?? "dati non validi"}` };
    }
    prepared.push({
      catalog_id:               catalogId,
      product_name:             parsed.data.product_name,
      product_name_normalized:  normalizeName(parsed.data.product_name),
      unit:                     normalizeUnit(parsed.data.unit),
      price:                    parsed.data.price,
      notes:                    parsed.data.notes ?? null,
    });
  }

  const supabase = await createClient();

  if (mode === "replace") {
    const { error: delErr } = await supabase
      .from("restaurant_catalog_items")
      .delete()
      .eq("catalog_id", catalogId);
    if (delErr) return { ok: false, error: delErr.message };
  }

  const CHUNK = 500;
  for (let i = 0; i < prepared.length; i += CHUNK) {
    const slice = prepared.slice(i, i + CHUNK);
    const { error } = await (supabase as any).from("restaurant_catalog_items").insert(slice);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/cataloghi/${catalogId}`);
  revalidatePath("/cataloghi/confronta");
  return { ok: true, data: { inserted: prepared.length } };
}
