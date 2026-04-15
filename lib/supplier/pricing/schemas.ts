import { z } from "zod/v4";

export const PriceListSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome obbligatorio").max(120),
  description: z.string().max(500).nullish(),
  is_default: z.boolean().default(false),
  valid_from: z.string().date().nullish(),
  valid_to: z.string().date().nullish(),
  is_active: z.boolean().default(true),
});

export type PriceListInput = z.infer<typeof PriceListSchema>;

export const PriceListPatchSchema = PriceListSchema.partial();
export type PriceListPatch = z.infer<typeof PriceListPatchSchema>;

export const PriceListItemPatchSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  sales_unit_id: z.string().uuid(),
  price: z.number().nonnegative(),
});

export type PriceListItemPatch = z.infer<typeof PriceListItemPatchSchema>;

export const PriceListItemsArraySchema = z.array(PriceListItemPatchSchema);

export const TierDiscountSchema = z.object({
  id: z.string().uuid().optional(),
  price_list_item_id: z.string().uuid(),
  min_quantity: z.number().positive(),
  discount_pct: z.number().min(0).max(100),
  sort_order: z.number().int().nonnegative().default(0),
});

export type TierDiscountInput = z.infer<typeof TierDiscountSchema>;

export const TierDiscountsArraySchema = z.array(TierDiscountSchema);

export const BulkUpdateSchema = z.object({
  mode: z.enum(["percent", "fixed"]),
  value: z.number(),
  filter: z
    .object({
      category_id: z.string().uuid().nullish(),
    })
    .nullish(),
});

export type BulkUpdateInput = z.infer<typeof BulkUpdateSchema>;

export const CustomerAssignmentSchema = z.object({
  restaurant_id: z.string().uuid(),
  price_list_id: z.string().uuid(),
});

export type CustomerAssignmentInput = z.infer<typeof CustomerAssignmentSchema>;
