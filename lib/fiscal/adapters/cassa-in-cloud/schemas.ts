// lib/fiscal/adapters/cassa-in-cloud/schemas.ts
import { z } from "zod/v4";

export const cicReceiptItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  description: z.string(),
  quantity: z.coerce.number(),
  price: z.coerce.number(),
  vatRate: z.coerce.number().nullable().optional(),
  departmentName: z.string().nullable().optional(),
  discountAmount: z.coerce.number().nullable().optional(),
  voided: z.boolean().optional(),
});

export const cicReceiptSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  documentNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .optional(),
  date: z.string(),
  status: z
    .enum(["ISSUED", "CANCELLED", "REFUNDED"])
    .default("ISSUED"),
  subtotal: z.coerce.number(),
  vatTotal: z.coerce.number(),
  total: z.coerce.number(),
  paymentType: z.string().nullable().optional(),
  operatorName: z.string().nullable().optional(),
  covers: z.coerce.number().nullable().optional(),
  tableName: z.string().nullable().optional(),
  items: z.array(cicReceiptItemSchema),
});

export type CicReceipt = z.infer<typeof cicReceiptSchema>;

export const cicWebhookBodySchema = z.object({
  eventType: z.enum([
    "receipt.created",
    "receipt.cancelled",
    "receipt.refunded",
  ]),
  data: cicReceiptSchema,
});

export type CicWebhookBody = z.infer<typeof cicWebhookBodySchema>;
