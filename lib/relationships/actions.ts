/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { InviteSupplierSchema, UpdateNotesSchema, type InviteSupplierInput, type UpdateNotesInput } from "./schemas";
import type { RestaurantSupplierRow, Result } from "./types";

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

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

async function getSupplierId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

// ===================================================================
// RESTAURANT side
// ===================================================================

export async function inviteSupplier(input: InviteSupplierInput): Promise<Result<RestaurantSupplierRow>> {
  const parsed = InviteSupplierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const userId = await currentUserId();
  const restaurantId = await getRestaurantId();
  if (!userId || !restaurantId) return { ok: false, error: "Ristorante non trovato" };

  const supabase = await createClient();

  // Re-invite path: if a prior rejected/archived relationship exists, flip it back to pending.
  const { data: existing } = await (supabase as any)
    .from("restaurant_suppliers")
    .select("id, status")
    .eq("restaurant_id", restaurantId)
    .eq("supplier_id", parsed.data.supplier_id)
    .maybeSingle() as { data: { id: string; status: string } | null };

  if (existing) {
    if (existing.status === "pending" || existing.status === "active" || existing.status === "paused") {
      return { ok: false, error: "Hai già una relazione attiva o in attesa con questo fornitore" };
    }
    // rejected or archived → riattiva come pending
    const { data: updated, error } = await (supabase as any)
      .from("restaurant_suppliers")
      .update({ status: "pending", notes: parsed.data.notes ?? null })
      .eq("id", existing.id)
      .select("*")
      .single() as { data: RestaurantSupplierRow | null; error: { message: string } | null };

    if (error || !updated) return { ok: false, error: error?.message ?? "Errore rinvio invito" };
    revalidatePath("/fornitori");
    return { ok: true, data: updated };
  }

  const { data, error } = await (supabase as any)
    .from("restaurant_suppliers")
    .insert({
      restaurant_id: restaurantId,
      supplier_id:   parsed.data.supplier_id,
      status:        "pending",
      invited_by:    userId,
      notes:         parsed.data.notes ?? null,
    })
    .select("*")
    .single() as { data: RestaurantSupplierRow | null; error: { message: string; code?: string } | null };

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Hai già una relazione con questo fornitore" };
    return { ok: false, error: error?.message ?? "Errore invio invito" };
  }

  revalidatePath("/fornitori");
  return { ok: true, data };
}

export async function updateRelationshipNotes(id: string, input: UpdateNotesInput): Promise<Result> {
  const parsed = UpdateNotesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ notes: parsed.data.notes ?? null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/fornitori");
  return { ok: true, data: undefined };
}

export async function pauseRelationshipByRestaurant(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ status: "paused" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fornitori");
  return { ok: true, data: undefined };
}

export async function resumeRelationshipByRestaurant(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ status: "active" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fornitori");
  return { ok: true, data: undefined };
}

export async function archiveRelationship(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fornitori");
  return { ok: true, data: undefined };
}

// ===================================================================
// SUPPLIER side
// ===================================================================

export async function acceptInvitation(id: string): Promise<Result> {
  const supplierId = await getSupplierId();
  if (!supplierId) return { ok: false, error: "Fornitore non trovato" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ status: "active" })
    .eq("id", id)
    .eq("supplier_id", supplierId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/supplier/clienti");
  revalidatePath("/supplier/dashboard");
  return { ok: true, data: undefined };
}

export async function rejectInvitation(id: string): Promise<Result> {
  const supplierId = await getSupplierId();
  if (!supplierId) return { ok: false, error: "Fornitore non trovato" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("supplier_id", supplierId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/supplier/clienti");
  return { ok: true, data: undefined };
}

export async function pauseRelationshipBySupplier(id: string): Promise<Result> {
  const supplierId = await getSupplierId();
  if (!supplierId) return { ok: false, error: "Fornitore non trovato" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ status: "paused" })
    .eq("id", id)
    .eq("supplier_id", supplierId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/supplier/clienti");
  return { ok: true, data: undefined };
}

export async function resumeRelationshipBySupplier(id: string): Promise<Result> {
  const supplierId = await getSupplierId();
  if (!supplierId) return { ok: false, error: "Fornitore non trovato" };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("restaurant_suppliers")
    .update({ status: "active" })
    .eq("id", id)
    .eq("supplier_id", supplierId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/supplier/clienti");
  return { ok: true, data: undefined };
}
