"use server";

import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurants/permissions";

export type ActiveRestaurantSummary = {
  id: string;
  name: string;
  roleLabel: string;
  isOwner: boolean;
  /** The role may send orders (order.submit). */
  canOrder: boolean;
};

/** Active restaurant of the current user, for client pages (e.g. the cart). */
export async function getActiveRestaurantSummary(): Promise<ActiveRestaurantSummary | null> {
  const ctx = await getRestaurantContext();
  if (!ctx) return null;
  return {
    id: ctx.restaurantId,
    name: ctx.restaurantName,
    roleLabel: RESTAURANT_ROLE_LABELS[ctx.role],
    isOwner: ctx.isOwner,
    canOrder: contextCan(ctx, "order.submit"),
  };
}
