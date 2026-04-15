import { z } from "zod";

export const WarehouseSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(120),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  province: z.string().trim().max(4).nullable().optional(),
  zip_code: z.string().trim().max(10).nullable().optional(),
  is_primary: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

export type WarehouseInput = z.infer<typeof WarehouseSchema>;
