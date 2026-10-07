import { z } from "zod/v4";

export const RestaurantRoleEnum = z.enum(["owner", "manager", "chef", "viewer"]);

export const InviteRestaurantMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email non valida").max(254),
  role: RestaurantRoleEnum,
});

export const ChangeRestaurantRoleSchema = z.object({
  member_id: z.string().uuid("ID membro non valido"),
  role: RestaurantRoleEnum,
});

export const RestaurantMemberIdSchema = z.object({
  member_id: z.string().uuid("ID membro non valido"),
});

export const SwitchRestaurantSchema = z.object({
  restaurant_id: z.string().uuid("Ristorante non valido"),
});

export type InviteRestaurantMemberInput = z.infer<typeof InviteRestaurantMemberSchema>;
export type ChangeRestaurantRoleInput = z.infer<typeof ChangeRestaurantRoleSchema>;
