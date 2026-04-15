/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase client casts to `any` are required here until generated DB types
// pick up the new preferences tables — the hand-maintained shapes in
// `types/database.ts` are exhaustive but the PostgREST types from
// @supabase/ssr still resolve to a more restrictive row union.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PreferencesPatchSchema,
  CategoryPreferencePatchSchema,
  MacroCategorySchema,
  PresetProfileSchema,
  type PreferencesPatch,
  type CategoryPreferencePatch,
} from "./schemas";
import {
  PRESET_PROFILES,
  type PresetCategoryOverride,
} from "./preset-profiles";
import type {
  CategoryMacro,
  CertificationType,
  PresetProfile,
  QualityTier,
} from "@/types/database";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

export type PreferencesGlobal = {
  min_order_max_eur: number | null;
  lead_time_max_days: number | null;
  required_certifications: CertificationType[];
  blocked_supplier_ids: string[];
  max_distance_km: number | null;
  price_weight: number;
  quality_weight: number;
  delivery_weight: number;
  prefer_bio: boolean;
  prefer_km0: boolean;
  preset_profile: PresetProfile;
};

export type PreferencesCategoryOverride = {
  min_quality_tier: QualityTier | null;
  lead_time_max_days: number | null;
  required_certifications: CertificationType[];
  price_weight: number | null;
  quality_weight: number | null;
  delivery_weight: number | null;
};

export type PreferencesBundle = {
  global: PreferencesGlobal;
  byCategory: Partial<Record<CategoryMacro, PreferencesCategoryOverride>>;
};

const DEFAULT_GLOBAL: PreferencesGlobal = {
  min_order_max_eur: null,
  lead_time_max_days: null,
  required_certifications: [],
  blocked_supplier_ids: [],
  max_distance_km: null,
  price_weight: 60,
  quality_weight: 30,
  delivery_weight: 10,
  prefer_bio: false,
  prefer_km0: false,
  preset_profile: "custom",
};

function revalidateSettings() {
  revalidatePath("/impostazioni/esigenze-fornitura");
  revalidatePath("/impostazioni");
}

export async function getPreferences(
  restaurantId: string
): Promise<Result<PreferencesBundle>> {
  const supabase = await createClient();

  const { data: globalRow, error: globalErr } = await (supabase as any)
    .from("restaurant_preferences")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (globalErr) return { ok: false, error: globalErr.message };

  const { data: categoryRows, error: categoryErr } = await (supabase as any)
    .from("restaurant_category_preferences")
    .select("*")
    .eq("restaurant_id", restaurantId);
  if (categoryErr) return { ok: false, error: categoryErr.message };

  const global: PreferencesGlobal = globalRow
    ? {
        min_order_max_eur:
          globalRow.min_order_max_eur !== null &&
          globalRow.min_order_max_eur !== undefined
            ? Number(globalRow.min_order_max_eur)
            : null,
        lead_time_max_days: globalRow.lead_time_max_days ?? null,
        required_certifications:
          (globalRow.required_certifications as CertificationType[]) ?? [],
        blocked_supplier_ids:
          (globalRow.blocked_supplier_ids as string[]) ?? [],
        max_distance_km: globalRow.max_distance_km ?? null,
        price_weight: globalRow.price_weight ?? DEFAULT_GLOBAL.price_weight,
        quality_weight:
          globalRow.quality_weight ?? DEFAULT_GLOBAL.quality_weight,
        delivery_weight:
          globalRow.delivery_weight ?? DEFAULT_GLOBAL.delivery_weight,
        prefer_bio: globalRow.prefer_bio ?? false,
        prefer_km0: globalRow.prefer_km0 ?? false,
        preset_profile:
          (globalRow.preset_profile as PresetProfile) ?? "custom",
      }
    : { ...DEFAULT_GLOBAL };

  const byCategory: PreferencesBundle["byCategory"] = {};
  for (const row of (categoryRows ?? []) as Array<{
    macro_category: CategoryMacro;
    min_quality_tier: QualityTier | null;
    lead_time_max_days: number | null;
    required_certifications: CertificationType[] | null;
    price_weight: number | null;
    quality_weight: number | null;
    delivery_weight: number | null;
  }>) {
    byCategory[row.macro_category] = {
      min_quality_tier: row.min_quality_tier,
      lead_time_max_days: row.lead_time_max_days,
      required_certifications: row.required_certifications ?? [],
      price_weight: row.price_weight,
      quality_weight: row.quality_weight,
      delivery_weight: row.delivery_weight,
    };
  }

  return { ok: true, data: { global, byCategory } };
}

async function assertOwnsRestaurant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string
): Promise<VoidResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Sede non trovata" };
  return { ok: true };
}

export async function updatePreferences(
  restaurantId: string,
  patch: PreferencesPatch
): Promise<VoidResult> {
  const parsed = PreferencesPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dati non validi",
    };
  }

  const supabase = await createClient();
  const owns = await assertOwnsRestaurant(supabase, restaurantId);
  if (!owns.ok) return owns;

  const payload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    ...parsed.data,
  };

  const { error } = await (supabase as any)
    .from("restaurant_preferences")
    .upsert(payload, { onConflict: "restaurant_id" });

  if (error) return { ok: false, error: error.message };
  revalidateSettings();
  return { ok: true };
}

export async function updateCategoryPreference(
  restaurantId: string,
  macroCategory: CategoryMacro,
  patch: CategoryPreferencePatch
): Promise<VoidResult> {
  const macro = MacroCategorySchema.safeParse(macroCategory);
  if (!macro.success) return { ok: false, error: "Categoria non valida" };

  const parsed = CategoryPreferencePatchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dati non validi",
    };
  }

  const supabase = await createClient();
  const owns = await assertOwnsRestaurant(supabase, restaurantId);
  if (!owns.ok) return owns;

  const payload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    macro_category: macro.data,
    ...parsed.data,
  };

  const { error } = await (supabase as any)
    .from("restaurant_category_preferences")
    .upsert(payload, { onConflict: "restaurant_id,macro_category" });

  if (error) return { ok: false, error: error.message };
  revalidateSettings();
  return { ok: true };
}

export async function deleteCategoryPreference(
  restaurantId: string,
  macroCategory: CategoryMacro
): Promise<VoidResult> {
  const macro = MacroCategorySchema.safeParse(macroCategory);
  if (!macro.success) return { ok: false, error: "Categoria non valida" };

  const supabase = await createClient();
  const owns = await assertOwnsRestaurant(supabase, restaurantId);
  if (!owns.ok) return owns;

  const { error } = await (supabase as any)
    .from("restaurant_category_preferences")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("macro_category", macro.data);

  if (error) return { ok: false, error: error.message };
  revalidateSettings();
  return { ok: true };
}

export async function applyPresetProfile(
  restaurantId: string,
  preset: PresetProfile
): Promise<VoidResult> {
  const parsedPreset = PresetProfileSchema.safeParse(preset);
  if (!parsedPreset.success) {
    return { ok: false, error: "Profilo non valido" };
  }

  const supabase = await createClient();
  const owns = await assertOwnsRestaurant(supabase, restaurantId);
  if (!owns.ok) return owns;

  if (parsedPreset.data === "custom") {
    const { error } = await (supabase as any)
      .from("restaurant_preferences")
      .upsert(
        { restaurant_id: restaurantId, preset_profile: "custom" },
        { onConflict: "restaurant_id" }
      );
    if (error) return { ok: false, error: error.message };
    revalidateSettings();
    return { ok: true };
  }

  const template = PRESET_PROFILES[parsedPreset.data];

  const globalPayload = {
    restaurant_id: restaurantId,
    preset_profile: parsedPreset.data,
    price_weight: template.price_weight,
    quality_weight: template.quality_weight,
    delivery_weight: template.delivery_weight,
    required_certifications: template.required_certifications,
    prefer_bio: template.prefer_bio,
    prefer_km0: template.prefer_km0,
    lead_time_max_days: template.lead_time_max_days,
    min_order_max_eur: template.min_order_max_eur,
    max_distance_km: template.max_distance_km,
  };

  const { error: globalErr } = await (supabase as any)
    .from("restaurant_preferences")
    .upsert(globalPayload, { onConflict: "restaurant_id" });
  if (globalErr) return { ok: false, error: globalErr.message };

  // Replace category overrides with the preset's set.
  const { error: delErr } = await (supabase as any)
    .from("restaurant_category_preferences")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (delErr) return { ok: false, error: delErr.message };

  const overrideEntries = Object.entries(template.categoryOverrides) as Array<
    [CategoryMacro, PresetCategoryOverride]
  >;
  if (overrideEntries.length > 0) {
    const rows = overrideEntries.map(([macro, ov]) => ({
      restaurant_id: restaurantId,
      macro_category: macro,
      min_quality_tier: ov.min_quality_tier ?? null,
      lead_time_max_days: ov.lead_time_max_days ?? null,
      required_certifications: ov.required_certifications ?? [],
      price_weight: ov.price_weight ?? null,
      quality_weight: ov.quality_weight ?? null,
      delivery_weight: ov.delivery_weight ?? null,
    }));
    const { error: insErr } = await (supabase as any)
      .from("restaurant_category_preferences")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidateSettings();
  return { ok: true };
}
