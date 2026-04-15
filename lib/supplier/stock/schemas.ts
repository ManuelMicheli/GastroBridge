import { z } from "zod";

export const ReceiveLotSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  salesUnitId: z.string().uuid(),
  quantitySalesUnit: z.number().positive(),
  lotCode: z.string().min(1).max(80),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data non valida (YYYY-MM-DD)")
    .nullable(),
  costPerBase: z.number().nonnegative().nullable(),
  notes: z.string().max(500).optional(),
});

export type ReceiveLotInput = z.infer<typeof ReceiveLotSchema>;

export const AdjustStockSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  lotId: z.string().uuid().nullable(),
  deltaBase: z
    .number()
    .refine((n) => Number.isFinite(n), "delta deve essere un numero")
    .refine((n) => n !== 0, "delta non puo essere 0"),
  reason: z.string().min(3).max(300),
});

export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

export const MovementTypeSchema = z.enum([
  "receive",
  "order_reserve",
  "order_unreserve",
  "order_ship",
  "adjust_in",
  "adjust_out",
  "return",
  "transfer",
]);

export const ListMovementsFilterSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  movementType: MovementTypeSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export type ListMovementsFilter = z.infer<typeof ListMovementsFilterSchema>;

export const ListLotsFilterSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  onlyWithStock: z.boolean().optional(),
});

export type ListLotsFilter = z.infer<typeof ListLotsFilterSchema>;
