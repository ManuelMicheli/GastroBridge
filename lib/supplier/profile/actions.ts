/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";
import { SupplierProfileSchema, type SupplierProfileInput } from "./schemas";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const PROFILE_FIELDS =
  "id, company_name, description, logo_url, cover_url, website, email, phone, address, city, province, zip_code, min_order_amount, payment_terms_days, cold_chain_available, certifications, is_verified, rating_avg, rating_count";

export type EditableSupplierProfile = {
  id: string;
  company_name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  min_order_amount: number | null;
  payment_terms_days: number;
  cold_chain_available: boolean;
  certifications: string[] | null;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
};

function revalidateAll() {
  revalidatePath("/supplier/impostazioni/profilo");
  revalidatePath("/supplier/impostazioni");
  revalidatePath("/supplier/dashboard");
  revalidatePath("/fornitori");
}

export async function getEditableSupplierProfile(
  supplierId: string,
): Promise<Result<EditableSupplierProfile>> {
  try {
    if (!supplierId) return { ok: false, error: "Fornitore non valido" };
    await requirePermission(supplierId, "settings.manage");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select(PROFILE_FIELDS)
      .eq("id", supplierId)
      .maybeSingle<EditableSupplierProfile>();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Profilo non trovato" };
    }
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore caricamento profilo",
    };
  }
}

export async function updateSupplierProfile(
  supplierId: string,
  input: SupplierProfileInput,
): Promise<Result> {
  try {
    if (!supplierId) return { ok: false, error: "Fornitore non valido" };
    const parsed = SupplierProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }

    await requirePermission(supplierId, "settings.manage");

    const payload: Record<string, unknown> = {};
    const v = parsed.data;
    if (v.company_name !== undefined) payload.company_name = v.company_name;
    if (v.description !== undefined) payload.description = v.description;
    if (v.logo_url !== undefined) payload.logo_url = v.logo_url;
    if (v.cover_url !== undefined) payload.cover_url = v.cover_url;
    if (v.website !== undefined) payload.website = v.website;
    if (v.email !== undefined) payload.email = v.email;
    if (v.phone !== undefined) payload.phone = v.phone;
    if (v.address !== undefined) payload.address = v.address;
    if (v.city !== undefined) payload.city = v.city;
    if (v.province !== undefined) payload.province = v.province;
    if (v.zip_code !== undefined) payload.zip_code = v.zip_code;
    if (v.min_order_amount !== undefined) payload.min_order_amount = v.min_order_amount;
    if (v.payment_terms_days !== undefined) payload.payment_terms_days = v.payment_terms_days;
    if (v.cold_chain_available !== undefined) payload.cold_chain_available = v.cold_chain_available;
    if (v.certifications !== undefined) {
      payload.certifications = v.certifications.length > 0 ? v.certifications : null;
    }

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("suppliers")
      .update(payload)
      .eq("id", supplierId);

    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore aggiornamento profilo",
    };
  }
}
