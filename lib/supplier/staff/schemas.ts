import { z } from "zod/v4";

export const SupplierRoleEnum = z.enum([
  "admin",
  "sales",
  "warehouse",
  "driver",
]);

export const InviteStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email non valida"),
  role: SupplierRoleEnum,
});

export const ChangeRoleSchema = z.object({
  member_id: z.string().uuid(),
  role: SupplierRoleEnum,
});

export const MemberIdSchema = z.object({
  member_id: z.string().uuid(),
});

export type InviteStaffInput = z.infer<typeof InviteStaffSchema>;
export type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>;
export type MemberIdInput = z.infer<typeof MemberIdSchema>;
