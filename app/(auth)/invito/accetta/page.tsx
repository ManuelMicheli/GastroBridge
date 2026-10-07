import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurants/permissions";
import type { RestaurantRole } from "@/types/database";
import { InviteSessionBootstrap } from "./session-bootstrap";
import { AcceptInviteClient, type PendingInvite } from "./accept-client";

export const metadata: Metadata = { title: "Accetta invito" };

// Public-safe route (not in middleware PROTECTED_PREFIXES): new invitees land
// here from the Supabase invite email with the session in the URL fragment,
// which only the browser can read. Without a session the page renders the
// bootstrap, which either stores that session or sends the user to /login.
export default async function AcceptRestaurantInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <InviteSessionBootstrap />;

  // The invitee reads their own rows ("Members read own memberships").
  const { data: rows } = await supabase
    .from("restaurant_members")
    .select("id, restaurant_id, role, invited_at, invite_expires_at")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .is("accepted_at", null)
    .order("invited_at", { ascending: false })
    .returns<
      { id: string; restaurant_id: string; role: RestaurantRole; invited_at: string; invite_expires_at: string | null }[]
    >();

  const pending = rows ?? [];
  const names = new Map<string, string>();
  if (pending.length > 0) {
    // Not a member yet → restaurants are not readable through RLS. Only the
    // names of the restaurants that invited this user are read.
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("restaurants")
        .select("id, name")
        .in("id", pending.map((p) => p.restaurant_id))
        .returns<{ id: string; name: string }[]>();
      for (const r of data ?? []) names.set(r.id, r.name);
    } catch {
      /* generic label below */
    }
  }

  const now = Date.now();
  const invites: PendingInvite[] = pending.map((p) => ({
    id: p.id,
    restaurantName: names.get(p.restaurant_id) ?? "Ristorante",
    roleLabel: RESTAURANT_ROLE_LABELS[p.role] ?? p.role,
    expired: !!p.invite_expires_at && new Date(p.invite_expires_at).getTime() < now,
  }));

  const meta = (user.user_metadata ?? {}) as { invited_restaurant_id?: string };

  return (
    <AcceptInviteClient
      email={user.email ?? ""}
      invites={invites}
      // Accounts created by the invite email have no password yet.
      offerPassword={!!meta.invited_restaurant_id}
    />
  );
}
