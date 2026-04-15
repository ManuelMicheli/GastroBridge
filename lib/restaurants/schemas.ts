import { z } from "zod";
import { z as zv4 } from "zod/v4";

export const CUISINE_VALUES = [
  "italiana",
  "pizzeria",
  "pesce",
  "carne",
  "giapponese",
  "fusion",
  "bistrot",
  "trattoria",
  "gourmet",
  "altro",
] as const;

export const RestaurantSchema = z.object({
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(120),
  cuisine: z.enum(CUISINE_VALUES).nullable().optional(),
  covers: z.number().int().min(0).max(10000).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  province: z.string().trim().max(10).nullable().optional(),
  zip_code: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email("Email non valida").nullable().optional().or(z.literal("")),
  is_primary: z.boolean().optional(),
});

export type RestaurantInput = z.infer<typeof RestaurantSchema>;

// ---------------------------------------------------------------------------
// Restaurant supply preferences (Wave 2a)
// ---------------------------------------------------------------------------

export const CERTIFICATION_VALUES = [
  "DOP",
  "IGP",
  "STG",
  "BIO",
  "DOC",
  "DOCG",
  "IGT",
  "HALAL",
  "KOSHER",
  "MSC",
  "ASC",
  "FAIRTRADE",
] as const;

export const QUALITY_TIER_VALUES = [
  "economy",
  "standard",
  "premium",
  "luxury",
] as const;

export const CATEGORY_MACRO_VALUES = [
  "carne",
  "pesce",
  "verdura",
  "frutta",
  "latticini",
  "secco",
  "bevande",
  "surgelati",
  "panetteria",
  "altro",
] as const;

export const PRESET_PROFILE_VALUES = [
  "custom",
  "stellato",
  "trattoria",
  "pizzeria",
  "bar",
  "mensa",
] as const;

const weight = zv4
  .number()
  .int()
  .min(0, "Il peso deve essere tra 0 e 100")
  .max(100, "Il peso deve essere tra 0 e 100");

export const PreferencesPatchSchema = zv4.object({
  min_order_max_eur: zv4.number().min(0).nullable().optional(),
  lead_time_max_days: zv4.number().int().min(0).nullable().optional(),
  required_certifications: zv4.array(zv4.enum(CERTIFICATION_VALUES)).optional(),
  blocked_supplier_ids: zv4
    .array(
      zv4
        .string()
        .regex(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          "UUID non valido"
        )
    )
    .optional(),
  max_distance_km: zv4.number().int().min(0).nullable().optional(),
  price_weight: weight.optional(),
  quality_weight: weight.optional(),
  delivery_weight: weight.optional(),
  prefer_bio: zv4.boolean().optional(),
  prefer_km0: zv4.boolean().optional(),
  preset_profile: zv4.enum(PRESET_PROFILE_VALUES).optional(),
});

export type PreferencesPatch = zv4.infer<typeof PreferencesPatchSchema>;

export const CategoryPreferencePatchSchema = zv4.object({
  min_quality_tier: zv4.enum(QUALITY_TIER_VALUES).nullable().optional(),
  lead_time_max_days: zv4.number().int().min(0).nullable().optional(),
  required_certifications: zv4.array(zv4.enum(CERTIFICATION_VALUES)).optional(),
  price_weight: weight.nullable().optional(),
  quality_weight: weight.nullable().optional(),
  delivery_weight: weight.nullable().optional(),
});

export type CategoryPreferencePatch = zv4.infer<
  typeof CategoryPreferencePatchSchema
>;

export const MacroCategorySchema = zv4.enum(CATEGORY_MACRO_VALUES);
export const PresetProfileSchema = zv4.enum(PRESET_PROFILE_VALUES);
