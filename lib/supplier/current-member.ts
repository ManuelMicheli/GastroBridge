// Server-only helper: resolve the supplier the logged-in user works for.
//
// Every supplier page must resolve the supplier through `supplier_members`
// (the owner is backfilled as an `admin` member), never through
// `suppliers.profile_id`, which only matches the owner and leaves staff
// (sales / warehouse / driver) with empty pages or 404s.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { hasPermission } from "@/lib/supplier/permissions";
import type { SupplierPermission, SupplierRole } from "@/types/database";

export type CurrentSupplierMember = {
  /** supplier_members.id */
  id: string;
  role: SupplierRole;
  supplier_id: string;
  profile_id: string;
};

/**
 * Active, accepted membership of the current user (request-cached).
 * Returns null for anonymous users or users without a supplier membership.
 */
export const getCurrentSupplierMember = cache(
  async (): Promise<CurrentSupplierMember | null> => {
    const user = await getCachedUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("supplier_members")
      .select("id, role, supplier_id")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .not("accepted_at", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; role: SupplierRole; supplier_id: string }>();
    if (!data) return null;
    return { ...data, profile_id: user.id };
  },
);

/** Supplier id of the current user's membership, or null. */
export async function getCurrentSupplierId(): Promise<string | null> {
  const member = await getCurrentSupplierMember();
  return member?.supplier_id ?? null;
}

/** True when the current member's role grants `permission`. */
export function memberCan(
  member: Pick<CurrentSupplierMember, "role"> | null | undefined,
  permission: SupplierPermission,
): boolean {
  return member ? hasPermission(member.role, permission) : false;
}
