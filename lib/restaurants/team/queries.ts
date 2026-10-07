// Server-only: team (restaurant_members) of the active restaurant.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessCan, getRestaurantContext, type RestaurantContext } from "@/lib/restaurants/context";
import type { RestaurantRole } from "@/types/database";

export type TeamMemberStatus = "active" | "invited" | "disabled";

export type TeamMember = {
  /** restaurant_members.id — null for an owner without a membership row yet. */
  id: string | null;
  profileId: string;
  name: string;
  email: string | null;
  role: RestaurantRole;
  status: TeamMemberStatus;
  /** `restaurants.profile_id`: cannot be demoted or deactivated. */
  isAccountOwner: boolean;
  isSelf: boolean;
  invitedAt: string | null;
  acceptedAt: string | null;
  inviteExpired: boolean;
};

type MemberRow = {
  id: string;
  profile_id: string;
  role: RestaurantRole;
  is_active: boolean;
  invited_at: string | null;
  accepted_at: string | null;
  invite_expires_at: string | null;
  invited_email: string | null;
  created_at: string;
};

export function memberStatus(row: Pick<MemberRow, "is_active" | "accepted_at">): TeamMemberStatus {
  if (!row.is_active) return "disabled";
  return row.accepted_at ? "active" : "invited";
}

/**
 * Members of the active restaurant. Only for users who may manage the team
 * (owner, or a member whose role has `staff.manage`): the admin client is used
 * after that check because profiles/auth users are not readable via RLS.
 */
export async function getTeamForActiveRestaurant(): Promise<
  | { ok: true; ctx: RestaurantContext; restaurant: { id: string; name: string; ownerId: string | null }; members: TeamMember[] }
  | { ok: false; reason: "no_restaurant" | "forbidden" | "error"; ctx: RestaurantContext | null; error?: string }
> {
  const ctx = await getRestaurantContext();
  if (!ctx) return { ok: false, reason: "no_restaurant", ctx: null };
  const access = ctx.restaurants.find((r) => r.restaurantId === ctx.restaurantId);
  if (!accessCan(access, "staff.manage")) return { ok: false, reason: "forbidden", ctx };

  try {
    const admin = createAdminClient();
    const [{ data: restaurant }, { data: rows, error }] = await Promise.all([
      admin
        .from("restaurants")
        .select("id, name, profile_id")
        .eq("id", ctx.restaurantId)
        .maybeSingle<{ id: string; name: string; profile_id: string | null }>(),
      admin
        .from("restaurant_members")
        .select("id, profile_id, role, is_active, invited_at, accepted_at, invite_expires_at, invited_email, created_at")
        .eq("restaurant_id", ctx.restaurantId)
        .order("created_at", { ascending: true })
        .returns<MemberRow[]>(),
    ]);
    if (error) return { ok: false, reason: "error", ctx, error: error.message };
    if (!restaurant) return { ok: false, reason: "no_restaurant", ctx };

    const ownerId = restaurant.profile_id;
    const list = [...(rows ?? [])];
    if (ownerId && !list.some((r) => r.profile_id === ownerId)) {
      list.unshift({
        id: "",
        profile_id: ownerId,
        role: "owner",
        is_active: true,
        invited_at: null,
        accepted_at: null,
        invite_expires_at: null,
        invited_email: null,
        created_at: "",
      });
    }

    const profileIds = [...new Set(list.map((r) => r.profile_id))];
    const users = await Promise.all(
      profileIds.map(async (id) => {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          return [id, data.user ?? null] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    );
    const userById = new Map(users);
    const now = Date.now();

    const members: TeamMember[] = list.map((r) => {
      const u = userById.get(r.profile_id) ?? null;
      const meta = (u?.user_metadata ?? {}) as { full_name?: string; name?: string };
      const email = u?.email ?? r.invited_email ?? null;
      const name = meta.full_name?.trim() || meta.name?.trim() || email?.split("@")[0] || "Membro";
      const isAccountOwner = r.profile_id === ownerId;
      const status: TeamMemberStatus = isAccountOwner ? "active" : memberStatus(r);
      return {
        id: r.id || null,
        profileId: r.profile_id,
        name,
        email,
        role: isAccountOwner ? "owner" : r.role,
        status,
        isAccountOwner,
        isSelf: r.profile_id === ctx.userId,
        invitedAt: r.invited_at,
        acceptedAt: r.accepted_at,
        inviteExpired:
          status === "invited" && !!r.invite_expires_at && new Date(r.invite_expires_at).getTime() < now,
      };
    });

    // Account owner first, then active, invited, disabled.
    const rank: Record<TeamMemberStatus, number> = { active: 1, invited: 2, disabled: 3 };
    members.sort((a, b) =>
      a.isAccountOwner !== b.isAccountOwner
        ? a.isAccountOwner ? -1 : 1
        : rank[a.status] - rank[b.status],
    );

    return {
      ok: true,
      ctx,
      restaurant: { id: restaurant.id, name: restaurant.name, ownerId },
      members,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      ctx,
      error: err instanceof Error ? err.message : "Errore caricamento team",
    };
  }
}
