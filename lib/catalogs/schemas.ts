import { z } from "zod/v4";

export const CatalogSchema = z.object({
  supplier_name:    z.string().trim().min(1, "Nome fornitore obbligatorio").max(120),
  delivery_days:    z.number().int().nonnegative().max(365).nullish(),
  min_order_amount: z.number().nonnegative().max(1_000_000).nullish(),
  notes:            z.string().max(500).nullish(),
});

export const CatalogItemSchema = z.object({
  product_name: z.string().trim().min(1, "Nome prodotto obbligatorio").max(200),
  unit:         z.string().trim().min(1, "Unità obbligatoria").max(20),
  price:        z.number().nonnegative().max(1_000_000),
  notes:        z.string().max(200).nullish(),
});

export const ImportRowSchema = CatalogItemSchema;

export const CompareWeightsSchema = z
  .object({
    w_prezzo:   z.number().min(0).max(1),
    w_consegna: z.number().min(0).max(1),
  })
  .refine((w) => Math.abs(w.w_prezzo + w.w_consegna - 1) < 0.001, {
    message: "I pesi devono sommare a 1",
  });

export type CatalogInput     = z.infer<typeof CatalogSchema>;
export type CatalogItemInput = z.infer<typeof CatalogItemSchema>;
export type CompareWeights   = z.infer<typeof CompareWeightsSchema>;
