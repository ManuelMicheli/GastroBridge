/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Restaurant team management (Impostazioni → Team) and invite acceptance.
//
// Every action authorizes first — the caller must own the active restaurant
// or hold `staff.manage` on it (lib/restaurants/context.ts) — and only then
// uses the admin client, always scoped to that restaurant. The admin client
// is needed because (a) profiles / auth users are not readable through RLS
// and (b) owners of restaurants created after the phase-1A backfill have no
// `restaurant_members` row, so `has_restaurant_permission` (RLS) is false for
// them until 20261008000000_restaurant_team_rls.sql is applied.
//
// Mirrors lib/supplier/staff/actions.ts.

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_RESTAURANT_COOKIE,
  getRestaurantAccessList,
  requireRestaurantContext,
  type RestaurantContext,
} from "@/lib/restaurants/context";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurants/permissions";
import { sendEmail } from "@/lib/notifications/email";
import { renderTeamInviteEmail } from "@/lib/notifications/templates";
import type { RestaurantRole } from "@/types/database";
import {
  ChangeRestaurantRoleSchema,
  InviteRestaurantMemberSchema,
  RestaurantMemberIdSchema,
  SwitchRestaurantSchema,
  type ChangeRestaurantRoleInput,
  type InviteRestaurantMemberInput,
} from "./schemas";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const TEAM_PATH = "/impostazioni/team";
const ACCEPT_PATH = "/invito/accetta";
const INVITE_TTL_DAYS = 14;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type Admin = ReturnType<typeof createAdminClient>;

// The generated Database type does not satisfy supabase-js' GenericSchema for
// writes (they resolve to `never`), like elsewhere in the codebase.
function membersTable(admin: Admin): any {
  return (admin as any).from("restaurant_members");
}

type MemberRow = {
  id: string;
  restaurant_id: string;
  profile_id: string;
  role: RestaurantRole;
  is_active: boolean;
  accepted_at: string | null;
  invite_expires_at: string | null;
};

const MEMBER_COLUMNS = "id, restaurant_id, profile_id, role, is_active, accepted_at, invite_expires_at";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

type Manager = {
  ctx: RestaurantContext;
  admin: Admin;
  restaurant: { id: string; name: string; profile_id: string | null };
};

/** Active restaurant + `staff.manage` (owners always pass). */
async function authorizeManager(): Promise<{ ok: true; m: Manager } | { ok: false; error: string }> {
  const res = await requireRestaurantContext("staff.manage");
  if (!res.ok) {
    return {
      ok: false,
      error: res.error === "Ristorante non trovato" ? res.error : "Solo il titolare può gestire il team",
    };
  }
  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, profile_id")
    .eq("id", res.ctx.restaurantId)
    .maybeSingle<{ id: string; name: string; profile_id: string | null }>();
  if (!restaurant) return { ok: false, error: "Ristorante non trovato" };

  // Restaurants created after the phase-1A backfill have no owner membership:
  // add it so has_restaurant_permission() and the last-owner guard see it.
  if (restaurant.profile_id) {
    await membersTable(admin).upsert(
      {
        restaurant_id: restaurant.id,
        profile_id: restaurant.profile_id,
        role: "owner",
        is_active: true,
        invited_by: restaurant.profile_id,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,profile_id", ignoreDuplicates: true },
    );
  }
  return { ok: true, m: { ctx: res.ctx, admin, restaurant } };
}

async function loadMember(m: Manager, memberId: string): Promise<MemberRow | null> {
  const { data } = await m.admin
    .from("restaurant_members")
    .select(MEMBER_COLUMNS)
    .eq("id", memberId)
    .eq("restaurant_id", m.restaurant.id)
    .maybeSingle<MemberRow>();
  return data ?? null;
}

/** Guards shared by role change / deactivation. */
function protectedMemberError(m: Manager, member: MemberRow): string | null {
  if (member.profile_id === m.restaurant.profile_id) {
    return "Il titolare dell'account non può essere modificato";
  }
  if (member.profile_id === m.ctx.userId) {
    return "Non puoi modificare il tuo stesso accesso";
  }
  return null;
}

function isAlreadyRegistered(err: { message?: string; code?: string; status?: number } | null): boolean {
  if (!err) return false;
  if (err.code === "email_exists" || err.code === "user_already_exists") return true;
  return /already (been )?registered|already exists/i.test(err.message ?? "");
}

// ------------------------------------------------------------------
// Invite
// ------------------------------------------------------------------

export async function inviteRestaurantMember(
  input: InviteRestaurantMemberInput,
): Promise<Result<{ memberId: string; existingUser: boolean; emailSent: boolean }>> {
  try {
    const parsed = InviteRestaurantMemberSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
    }
    const { email, role } = parsed.data;

    const auth = await authorizeManager();
    if (!auth.ok) return auth;
    const m = auth.m;
    const { admin, restaurant } = m;
    const base = appUrl();

    // 1. New user → Supabase invite email (sets the password, lands on
    //    /invito/accetta). `invited_restaurant_id` makes handle_new_user
    //    create only the profile (20261007010000), not a new restaurant.
    //    Existing user → resolve the id (generateLink sends nothing) and send
    //    our own invite email below.
    let profileId: string | null = null;
    let existingUser = false;
    const { data: inviteRes, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_restaurant_id: restaurant.id,
        restaurant_role: role,
        company_name: restaurant.name,
        invited_by: m.ctx.userId,
      },
      redirectTo: `${base}${ACCEPT_PATH}`,
    });
    if (inviteErr) {
      if (!isAlreadyRegistered(inviteErr)) {
        return { ok: false, error: inviteErr.message || "Errore invio invito" };
      }
      const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (linkErr || !linkRes?.user) {
        return { ok: false, error: linkErr?.message ?? "Impossibile trovare l'utente invitato" };
      }
      profileId = linkRes.user.id;
      existingUser = true;
    } else {
      profileId = inviteRes?.user?.id ?? null;
    }
    if (!profileId) return { ok: false, error: "Impossibile risolvere l'utente invitato" };
    if (profileId === m.ctx.userId) return { ok: false, error: "Fai già parte di questo ristorante" };
    if (profileId === restaurant.profile_id) {
      return { ok: false, error: "Questo utente è il titolare del ristorante" };
    }

    // 2. Profile: restaurant accounts only (the trigger creates it for new users).
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", profileId)
      .maybeSingle<{ id: string; role: string }>();
    if (profile && profile.role !== "restaurant") {
      return { ok: false, error: "Questo indirizzo appartiene a un account fornitore" };
    }
    if (!profile) {
      const { error: profErr } = await admin
        .from("profiles")
        .insert({ id: profileId, role: "restaurant", company_name: restaurant.name } as never);
      if (profErr) return { ok: false, error: profErr.message };
    }

    // 3. Membership: new, refreshed (pending) or re-invited (disabled).
    const { data: existing } = await admin
      .from("restaurant_members")
      .select(MEMBER_COLUMNS)
      .eq("restaurant_id", restaurant.id)
      .eq("profile_id", profileId)
      .maybeSingle<MemberRow>();
    if (existing?.is_active && existing.accepted_at) {
      return { ok: false, error: "Questo utente fa già parte del team" };
    }

    const invite = {
      role,
      is_active: true,
      accepted_at: null,
      invited_by: m.ctx.userId,
      invited_at: new Date().toISOString(),
      invited_email: email,
      invite_token: newInviteToken(),
      invite_expires_at: inviteExpiry(),
    };

    let memberId: string;
    if (existing) {
      const { error } = await membersTable(admin).update(invite).eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
      memberId = existing.id;
    } else {
      const { data, error } = await membersTable(admin)
        .insert({ ...invite, restaurant_id: restaurant.id, profile_id: profileId })
        .select("id")
        .single() as { data: { id: string } | null; error: { message: string } | null };
      if (error || !data) return { ok: false, error: error?.message ?? "Errore creazione invito" };
      memberId = data.id;
    }

    // 4. Existing account: our own email with a login link to the accept page.
    let emailSent = !existingUser;
    if (existingUser) {
      const mail = renderTeamInviteEmail({
        companyName: restaurant.name,
        roleLabel: RESTAURANT_ROLE_LABELS[role],
        url: `${base}/login?redirect=${encodeURIComponent(ACCEPT_PATH)}`,
      });
      const sent = await sendEmail({ to: email, ...mail });
      emailSent = sent.ok;
      if (!sent.ok) console.warn("[team:invite] invite email not sent", sent.error);
    }

    revalidatePath(TEAM_PATH);
    return { ok: true, data: { memberId, existingUser, emailSent } };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore invito membro") };
  }
}

// ------------------------------------------------------------------
// Role / activation / revoke
// ------------------------------------------------------------------

export async function changeRestaurantMemberRole(input: ChangeRestaurantRoleInput): Promise<Result> {
  try {
    const parsed = ChangeRestaurantRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
    }
    const auth = await authorizeManager();
    if (!auth.ok) return auth;
    const member = await loadMember(auth.m, parsed.data.member_id);
    if (!member) return { ok: false, error: "Membro non trovato" };
    const guard = protectedMemberError(auth.m, member);
    if (guard) return { ok: false, error: guard };
    if (member.role === parsed.data.role) return { ok: true, data: undefined };

    const { error } = await membersTable(auth.m.admin)
      .update({ role: parsed.data.role })
      .eq("id", member.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(TEAM_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore cambio ruolo") };
  }
}

async function setMemberActive(memberId: string, active: boolean): Promise<Result> {
  const parsed = RestaurantMemberIdSchema.safeParse({ member_id: memberId });
  if (!parsed.success) return { ok: false, error: "ID membro non valido" };
  const auth = await authorizeManager();
  if (!auth.ok) return auth;
  const member = await loadMember(auth.m, parsed.data.member_id);
  if (!member) return { ok: false, error: "Membro non trovato" };
  const guard = protectedMemberError(auth.m, member);
  if (guard) return { ok: false, error: guard };
  if (!member.accepted_at) {
    return { ok: false, error: "Invito non ancora accettato: revocalo o invialo di nuovo" };
  }
  const { error } = await membersTable(auth.m.admin)
    .update({ is_active: active })
    .eq("id", member.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(TEAM_PATH);
  return { ok: true, data: undefined };
}

export async function deactivateRestaurantMember(memberId: string): Promise<Result> {
  try {
    return await setMemberActive(memberId, false);
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore disattivazione membro") };
  }
}

export async function reactivateRestaurantMember(memberId: string): Promise<Result> {
  try {
    return await setMemberActive(memberId, true);
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore riattivazione membro") };
  }
}

/** Revoke a pending invite (the membership row is removed). */
export async function revokeRestaurantInvite(memberId: string): Promise<Result> {
  try {
    const parsed = RestaurantMemberIdSchema.safeParse({ member_id: memberId });
    if (!parsed.success) return { ok: false, error: "ID membro non valido" };
    const auth = await authorizeManager();
    if (!auth.ok) return auth;
    const member = await loadMember(auth.m, parsed.data.member_id);
    if (!member) return { ok: false, error: "Invito non trovato" };
    if (member.accepted_at) {
      return { ok: false, error: "Invito già accettato: usa la disattivazione" };
    }
    const { error } = await membersTable(auth.m.admin)
      .delete()
      .eq("id", member.id)
      .is("accepted_at", null);
    if (error) return { ok: false, error: error.message };
    revalidatePath(TEAM_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore revoca invito") };
  }
}

// ------------------------------------------------------------------
// Active restaurant switch
// ------------------------------------------------------------------

async function rememberActiveRestaurant(restaurantId: string): Promise<void> {
  (await cookies()).set(ACTIVE_RESTAURANT_COOKIE, restaurantId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function switchActiveRestaurant(restaurantId: string): Promise<Result> {
  try {
    const parsed = SwitchRestaurantSchema.safeParse({ restaurant_id: restaurantId });
    if (!parsed.success) return { ok: false, error: "Ristorante non valido" };
    const access = await getRestaurantAccessList();
    if (!access?.restaurants.some((r) => r.restaurantId === parsed.data.restaurant_id)) {
      return { ok: false, error: "Non hai accesso a questo ristorante" };
    }
    await rememberActiveRestaurant(parsed.data.restaurant_id);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore cambio ristorante") };
  }
}

// ------------------------------------------------------------------
// Invitee side
// ------------------------------------------------------------------

/**
 * Pending invite of the current user. The invitee is not a member yet, so the
 * RLS policies do not let them update the row: the admin client does it,
 * restricted to their own pending row.
 */
async function loadOwnPendingInvite(
  memberId: string,
): Promise<{ ok: true; admin: Admin; row: MemberRow } | { ok: false; error: string }> {
  const parsed = RestaurantMemberIdSchema.safeParse({ member_id: memberId });
  if (!parsed.success) return { ok: false, error: "Invito non valido" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione scaduta, accedi di nuovo" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("restaurant_members")
    .select(MEMBER_COLUMNS)
    .eq("id", parsed.data.member_id)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .is("accepted_at", null)
    .maybeSingle<MemberRow>();
  if (!row) return { ok: false, error: "Invito non trovato o già usato" };
  return { ok: true, admin, row };
}

export async function acceptRestaurantInvite(memberId: string): Promise<Result<{ restaurantId: string }>> {
  try {
    const res = await loadOwnPendingInvite(memberId);
    if (!res.ok) return res;
    if (res.row.invite_expires_at && new Date(res.row.invite_expires_at).getTime() < Date.now()) {
      return { ok: false, error: "Invito scaduto: chiedi al titolare di inviarlo di nuovo" };
    }
    const { error } = await membersTable(res.admin)
      .update({ accepted_at: new Date().toISOString(), invite_token: null })
      .eq("id", res.row.id)
      .eq("profile_id", res.row.profile_id)
      .is("accepted_at", null);
    if (error) return { ok: false, error: error.message };

    await rememberActiveRestaurant(res.row.restaurant_id);
    revalidatePath("/", "layout");
    return { ok: true, data: { restaurantId: res.row.restaurant_id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore accettazione invito") };
  }
}

export async function declineRestaurantInvite(memberId: string): Promise<Result> {
  try {
    const res = await loadOwnPendingInvite(memberId);
    if (!res.ok) return res;
    const { error } = await membersTable(res.admin)
      .delete()
      .eq("id", res.row.id)
      .eq("profile_id", res.row.profile_id)
      .is("accepted_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Errore rifiuto invito") };
  }
}
