/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import type {
  RelationshipStatus,
  RelationshipWithRestaurant,
  RelationshipWithSupplier,
  RestaurantSupplierRow,
} from "./types";

const RELATIONSHIP_WITH_SUPPLIER_SELECT = `
  *,
  supplier:suppliers!supplier_id (
    id,
    company_name,
    logo_url,
    city,
    is_verified,
    rating_avg
  )
`;

const RELATIONSHIP_WITH_RESTAURANT_SELECT = `
  *,
  restaurant:restaurants!restaurant_id (
    id,
    name,
    city,
    cuisine
  )
`;

/**
 * All relationships for the current restaurant user, optionally filtered by status.
 */
export async function getRelationshipsForRestaurant(
  options?: { status?: RelationshipStatus[] },
): Promise<RelationshipWithSupplier[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!restaurant) return [];

  let query = (supabase as any)
    .from("restaurant_suppliers")
    .select(RELATIONSHIP_WITH_SUPPLIER_SELECT)
    .eq("restaurant_id", restaurant.id)
    .order("invited_at", { ascending: false });

  if (options?.status && options.status.length > 0) {
    query = query.in("status", options.status);
  }

  const { data } = await query as { data: RelationshipWithSupplier[] | null };
  return data ?? [];
}

/**
 * All relationships for the current supplier user (= clients), optionally filtered.
 */
export async function getClientsForSupplier(
  options?: { status?: RelationshipStatus[] },
): Promise<RelationshipWithRestaurant[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!supplier) return [];

  let query = (supabase as any)
    .from("restaurant_suppliers")
    .select(RELATIONSHIP_WITH_RESTAURANT_SELECT)
    .eq("supplier_id", supplier.id)
    .order("invited_at", { ascending: false });

  if (options?.status && options.status.length > 0) {
    query = query.in("status", options.status);
  }

  const { data } = await query as { data: RelationshipWithRestaurant[] | null };
  return data ?? [];
}

/**
 * Pending requests awaiting supplier response. Useful for supplier dashboard KPI.
 */
export async function getPendingRequestsForSupplier(): Promise<RelationshipWithRestaurant[]> {
  return getClientsForSupplier({ status: ["pending"] });
}

/**
 * Load a single relationship by ID (RLS enforces visibility).
 */
export async function getRelationshipById(id: string): Promise<RestaurantSupplierRow | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("restaurant_suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle() as { data: RestaurantSupplierRow | null };
  return data ?? null;
}

/**
 * Check if current restaurant user has an active relationship with a specific supplier.
 */
export async function hasActiveRelationshipWith(supplierId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!restaurant) return false;

  const { data } = await (supabase as any)
    .from("restaurant_suppliers")
    .select("id")
    .eq("restaurant_id", restaurant.id)
    .eq("supplier_id", supplierId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle() as { data: { id: string } | null };

  return !!data;
}
