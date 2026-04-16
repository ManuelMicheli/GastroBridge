import { z } from "zod/v4";

export const InviteSupplierSchema = z.object({
  supplier_id: z.string().uuid("ID fornitore non valido"),
  notes:       z.string().trim().max(500).nullish(),
});

export const UpdateNotesSchema = z.object({
  notes: z.string().trim().max(500).nullish(),
});

export type InviteSupplierInput = z.infer<typeof InviteSupplierSchema>;
export type UpdateNotesInput    = z.infer<typeof UpdateNotesSchema>;
