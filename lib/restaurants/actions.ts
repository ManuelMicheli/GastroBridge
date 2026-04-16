/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts on Supabase client calls are required until the generated
// database types are regenerated to include restaurants writes.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RestaurantSchema, type RestaurantInput } from "./schemas";
import type { RestaurantRow } from "./types";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

function normalize(input: RestaurantInput) {
  const email = typeof input.email === "string" && input.email.trim().length > 0 ? input.email.trim() : null;
  return {
    name: input.name.trim(),
    cuisine: input.cuisine ?? null,
    covers: input.covers ?? null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    province: input.province?.trim() || null,
    zip_code: input.zip_code?.trim() || null,
    phone: input.phone?.trim() || null,
    email,
  };
}

function revalidateAll() {
  revalidatePath("/impostazioni/sedi");
  revalidatePath("/dashboard");
  revalidatePath("/fornitori");
  revalidatePath("/cataloghi");
  revalidatePath("/ordini");
}

export async function createLocation(input: RestaurantInput): Promise<Result<RestaurantRow>> {
  const parsed = RestaurantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data: existing } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id);

  const isFirst = !existing || existing.length === 0;
  const shouldBePrimary = parsed.data.is_primary ?? isFirst;

  if (shouldBePrimary && !isFirst) {
    await (supabase as any)
      .from("restaurants")
      .update({ is_primary: false })
      .eq("profile_id", user.id);
  }

  const { data, error } = (await (supabase as any)
    .from("restaurants")
    .insert({
      profile_id: user.id,
      ...normalize(parsed.data),
      is_primary: shouldBePrimary,
    })
    .select("*")
    .single()) as { data: RestaurantRow | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "Errore creazione sede" };
  revalidateAll();
  return { ok: true, data };
}

export async function updateLocation(id: string, input: RestaurantInput): Promise<Result> {
  const parsed = RestaurantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  // Handle is_primary toggle: if setting to true, unset every other location first.
  // If explicitly set to false, only allow it when another primary still exists —
  // otherwise keep this one as primary to avoid orphaning.
  if (parsed.data.is_primary === true) {
    const { error: unsetErr } = await (supabase as any)
      .from("restaurants")
      .update({ is_primary: false })
      .eq("profile_id", user.id)
      .neq("id", id);
    if (unsetErr) return { ok: false, error: unsetErr.message };
  }

  let forcedPrimary = false;
  if (parsed.data.is_primary === false) {
    const { data: others } = await supabase
      .from("restaurants")
      .select("id")
      .eq("profile_id", user.id)
      .eq("is_primary", true)
      .neq("id", id)
      .returns<Array<{ id: string }>>();
    if (!others || others.length === 0) {
      forcedPrimary = true; // keep this one primary
    }
  }

  const nextIsPrimary =
    parsed.data.is_primary === true ? true : forcedPrimary ? true : parsed.data.is_primary === false ? false : undefined;

  const payload = {
    ...normalize(parsed.data),
    ...(nextIsPrimary !== undefined ? { is_primary: nextIsPrimary } : {}),
  };

  const { error } = await (supabase as any)
    .from("restaurants")
    .update(payload)
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function deleteLocation(id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data: target } = await supabase
    .from("restaurants")
    .select("is_primary")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle<{ is_primary: boolean | null }>();

  const { error } = await supabase
    .from("restaurants")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { ok: false, error: error.message };

  if (target?.is_primary) {
    const { data: fallback } = await supabase
      .from("restaurants")
      .select("id")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (fallback?.id) {
      await (supabase as any)
        .from("restaurants")
        .update({ is_primary: true })
        .eq("id", fallback.id);
    }
  }

  revalidateAll();
  return { ok: true, data: undefined };
}

export async function setPrimaryLocation(id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { error: unsetErr } = await (supabase as any)
    .from("restaurants")
    .update({ is_primary: false })
    .eq("profile_id", user.id);
  if (unsetErr) return { ok: false, error: unsetErr.message };

  const { error } = await (supabase as any)
    .from("restaurants")
    .update({ is_primary: true })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, data: undefined };
}
