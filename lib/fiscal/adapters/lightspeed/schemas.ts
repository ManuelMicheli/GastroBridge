// lib/fiscal/adapters/lightspeed/schemas.ts
// Lightspeed Restaurant (K-Series) receipt schema.
import { z } from "zod/v4";

export const lightspeedReceiptItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  name: z.string(),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  taxRate: z.coerce.number().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  discountValue: z.coerce.number().nullable().optional(),
  cancelled: z.boolean().optional(),
});

export const lightspeedReceiptSchema = z.object({
  uuid: z.union([z.string(), z.number()]).transform((v) => String(v)),
  receiptNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .optional(),
  closedAt: z.string(),
  status: z
    .enum(["CLOSED", "CANCELLED", "REFUNDED"])
    .default("CLOSED"),
  subtotalExTax: z.coerce.number(),
  taxTotal: z.coerce.number(),
  total: z.coerce.number(),
  paymentMethod: z.string().nullable().optional(),
  cashierName: z.string().nullable().optional(),
  guestCount: z.coerce.number().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  items: z.array(lightspeedReceiptItemSchema),
});

export type LightspeedReceipt = z.infer<typeof lightspeedReceiptSchema>;

export const lightspeedWebhookBodySchema = z.object({
  event: z.enum([
    "receipt.closed",
    "receipt.cancelled",
    "receipt.refunded",
  ]),
  payload: lightspeedReceiptSchema,
});

export type LightspeedWebhookBody = z.infer<typeof lightspeedWebhookBodySchema>;
