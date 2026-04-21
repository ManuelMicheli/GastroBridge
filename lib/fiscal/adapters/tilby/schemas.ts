// lib/fiscal/adapters/tilby/schemas.ts
import { z } from "zod/v4";

export const tilbyReceiptItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  name: z.string(),
  quantity: z.coerce.number(),
  price: z.coerce.number(),
  vat_percentage: z.coerce.number().nullable().optional(),
  category_name: z.string().nullable().optional(),
  discount_amount: z.coerce.number().nullable().optional(),
  is_cancelled: z.boolean().optional(),
});

export const tilbyReceiptSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  receipt_number: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .optional(),
  sell_datetime: z.string(),
  status: z.enum(["issued", "cancelled", "refunded"]).default("issued"),
  subtotal: z.coerce.number(),
  vat_total: z.coerce.number(),
  total: z.coerce.number(),
  payment_method: z.string().nullable().optional(),
  operator_name: z.string().nullable().optional(),
  customer_count: z.coerce.number().nullable().optional(),
  table_name: z.string().nullable().optional(),
  items: z.array(tilbyReceiptItemSchema),
});

export type TilbyReceipt = z.infer<typeof tilbyReceiptSchema>;

export const tilbyWebhookBodySchema = z.object({
  event: z.enum(["receipt.created", "receipt.cancelled", "receipt.refunded"]),
  receipt: tilbyReceiptSchema,
});

export type TilbyWebhookBody = z.infer<typeof tilbyWebhookBodySchema>;
