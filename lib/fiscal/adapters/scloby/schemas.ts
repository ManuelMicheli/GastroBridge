// lib/fiscal/adapters/scloby/schemas.ts
// Scloby (Zucchetti) receipt schema.
import { z } from "zod/v4";

export const sclobyReceiptItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  name: z.string(),
  qty: z.coerce.number(),
  price: z.coerce.number(),
  vat: z.coerce.number().nullable().optional(),
  department: z.string().nullable().optional(),
  discount: z.coerce.number().nullable().optional(),
  voided: z.boolean().optional(),
});

export const sclobyReceiptSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  number: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .optional(),
  datetime: z.string(),
  status: z.enum(["issued", "voided", "refunded"]).default("issued"),
  subtotal: z.coerce.number(),
  vat_amount: z.coerce.number(),
  total: z.coerce.number(),
  payment: z.string().nullable().optional(),
  cashier: z.string().nullable().optional(),
  covers: z.coerce.number().nullable().optional(),
  table: z.string().nullable().optional(),
  items: z.array(sclobyReceiptItemSchema),
});

export type SclobyReceipt = z.infer<typeof sclobyReceiptSchema>;

export const sclobyWebhookBodySchema = z.object({
  event: z.enum(["receipt.created", "receipt.voided", "receipt.refunded"]),
  receipt: sclobyReceiptSchema,
});

export type SclobyWebhookBody = z.infer<typeof sclobyWebhookBodySchema>;
