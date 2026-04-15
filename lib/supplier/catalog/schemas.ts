import { z } from "zod/v4";

export const SalesUnitSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(60),
  unit_type: z.enum([
    "piece",
    "kg",
    "g",
    "l",
    "ml",
    "box",
    "pallet",
    "bundle",
    "other",
  ]),
  conversion_to_base: z.number().positive(),
  is_base: z.boolean(),
  barcode: z.string().trim().max(64).nullish(),
  moq: z.number().positive().default(1),
  sort_order: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
});

export const SalesUnitsArraySchema = z
  .array(SalesUnitSchema)
  .min(1, "Almeno una unità richiesta")
  .refine((arr) => arr.filter((u) => u.is_base).length === 1, {
    message: "Esattamente una unità deve essere base",
  });

export type SalesUnitInput = z.infer<typeof SalesUnitSchema>;

export const ProductBasePatchSchema = z
  .object({
    default_warehouse_id: z.string().uuid().nullish(),
    hazard_class: z.string().trim().max(64).nullish(),
    tax_rate: z.number().nonnegative().max(100),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().nullish(),
    brand: z.string().trim().max(120).nullish(),
    sku: z.string().trim().max(80).nullish(),
    price: z.number().nonnegative(),
    is_available: z.boolean(),
    lead_time_days: z.number().int().nonnegative(),
  })
  .partial();

export type ProductBasePatch = z.infer<typeof ProductBasePatchSchema>;
