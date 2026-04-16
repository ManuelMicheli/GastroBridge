import { z } from "zod/v4";

export const PriceListSchema = z.object({
  relationship_id: z.string().uuid(),
  product_id:      z.string().uuid(),
  custom_price:    z.number().nonnegative().max(1_000_000),
  custom_min_qty:  z.number().positive().max(1_000_000).nullish(),
  valid_from:      z.string().date().nullish(),
  valid_to:        z.string().date().nullish(),
  notes:           z.string().trim().max(300).nullish(),
}).refine(
  (v) => !v.valid_from || !v.valid_to || v.valid_to >= v.valid_from,
  { message: "La data di fine deve essere successiva a quella di inizio", path: ["valid_to"] },
);

export const PriceListUpdateSchema = PriceListSchema
  .omit({ relationship_id: true, product_id: true })
  .partial();

export type PriceListInput       = z.infer<typeof PriceListSchema>;
export type PriceListUpdateInput = z.infer<typeof PriceListUpdateSchema>;
