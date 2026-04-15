/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/supplier/context";
import type { Database, SupplierRole } from "@/types/database";
import {
  InviteStaffSchema,
  ChangeRoleSchema,
  MemberIdSchema,
  type InviteStaffInput,
  type ChangeRoleInput,
} from "./schemas";

type MemberRow = Database["public"]["Tables"]["supplier_members"]["Row"];

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

type MemberWithProfile = MemberRow & {
  profile?: {
    id: string;
    company_name: string | null;
  } | null;
};

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function countActiveAdmins(
  supplierId: string,
  excludeMemberId?: string,
): Promise<number> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("supplier_members")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .eq("role", "admin")
    .eq("is_active", true)
    .not("accepted_at", "is", null);
  if (excludeMemberId) query = query.neq("id", excludeMemberId);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listMembers(
  supplierId: string,
): Promise<Result<MemberWithProfile[]>> {
  try {
    await requirePermission(supplierId, "staff.manage");
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("supplier_members")
      .select(
        "*, profile:profiles!supplier_members_profile_id_fkey(id, company_name)",
      )
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as MemberWithProfile[] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore caricamento membri",
    };
  }
}

export async function inviteMember(
  supplierId: string,
  input: InviteStaffInput,
): Promise<Result<MemberRow>> {
  try {
    await requirePermission(supplierId, "staff.manage");

    const parsed = InviteStaffSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const { email, role } = parsed.data;

    const invitedBy = await getCurrentUserId();
    if (!invitedBy) return { ok: false, error: "Sessione non valida" };

    const admin = createAdminClient();
    const supabase = await createClient();

    // 1. Trova o crea l'utente via admin API.
    let profileId: string | null = null;

    const { data: existingProfile } = await (supabase as any)
      .from("profiles")
      .select("id")
      .ilike("id", "%")
      .limit(1);
    void existingProfile; // evita warning lint su var non usata

    // Cerca eventuale utente già esistente via admin.listUsers (paginato: fallback su invite)
    try {
      const { data: inviteRes, error: inviteErr } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            supplier_id: supplierId,
            role,
            invited_by: invitedBy,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/supplier/invito/accetta`,
        });

      if (inviteErr) {
        // Se l'utente esiste già, generiamo comunque un magic link
        const { data: linkRes, error: linkErr } =
          await admin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: {
              redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/supplier/invito/accetta`,
            },
          });
        if (linkErr || !linkRes?.user) {
          return {
            ok: false,
            error: inviteErr.message || linkErr?.message || "Errore invito",
          };
        }
        profileId = linkRes.user.id;
      } else {
        profileId = inviteRes?.user?.id ?? null;
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Errore invio invito",
      };
    }

    if (!profileId) {
      return { ok: false, error: "Impossibile risolvere utente invitato" };
    }

    // 2. Assicura profiles row (in caso non esista ancora).
    const { data: profileRow } = await (supabase as any)
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    if (!profileRow) {
      const { error: profErr } = await (admin as any).from("profiles").insert({
        id: profileId,
        role: "supplier",
        company_name: email,
      });
      if (profErr) return { ok: false, error: profErr.message };
    }

    // 3. Verifica che non esista già un membership attivo.
    const { data: existingMember } = await (supabase as any)
      .from("supplier_members")
      .select("id, is_active")
      .eq("supplier_id", supplierId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (existingMember?.is_active) {
      return { ok: false, error: "Utente già membro attivo" };
    }

    // 4. Inserisci (o riattiva) supplier_members.
    let memberRow: MemberRow | null = null;
    if (existingMember) {
      const { data, error } = await (supabase as any)
        .from("supplier_members")
        .update({
          role,
          is_active: true,
          invited_at: new Date().toISOString(),
          accepted_at: null,
          invited_by: invitedBy,
        })
        .eq("id", existingMember.id)
        .select("*")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "Errore aggiornamento" };
      }
      memberRow = data as MemberRow;
    } else {
      const { data, error } = await (supabase as any)
        .from("supplier_members")
        .insert({
          supplier_id: supplierId,
          profile_id: profileId,
          role,
          is_active: true,
          invited_by: invitedBy,
        })
        .select("*")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "Errore creazione membro" };
      }
      memberRow = data as MemberRow;
    }

    revalidatePath("/supplier/staff");
    return { ok: true, data: memberRow };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore invito membro",
    };
  }
}

async function loadMember(memberId: string): Promise<MemberRow | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("supplier_members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}

export async function changeRole(
  input: ChangeRoleInput,
): Promise<Result<MemberRow>> {
  try {
    const parsed = ChangeRoleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const { member_id, role } = parsed.data;

    const member = await loadMember(member_id);
    if (!member) return { ok: false, error: "Membro non trovato" };

    await requirePermission(member.supplier_id, "staff.manage");

    // Constraint ultimo admin: non consentire di declassare l'ultimo admin attivo.
    if (
      member.role === "admin" &&
      role !== "admin" &&
      member.is_active &&
      member.accepted_at
    ) {
      const count = await countActiveAdmins(member.supplier_id, member.id);
      if (count === 0) {
        return {
          ok: false,
          error: "Impossibile declassare l'ultimo amministratore attivo",
        };
      }
    }

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("supplier_members")
      .update({ role: role as SupplierRole })
      .eq("id", member_id)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore aggiornamento ruolo" };
    }

    revalidatePath("/supplier/staff");
    return { ok: true, data: data as MemberRow };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore cambio ruolo",
    };
  }
}

export async function deactivateMember(
  memberId: string,
): Promise<Result<MemberRow>> {
  try {
    const parsed = MemberIdSchema.safeParse({ member_id: memberId });
    if (!parsed.success) {
      return { ok: false, error: "ID membro non valido" };
    }

    const member = await loadMember(memberId);
    if (!member) return { ok: false, error: "Membro non trovato" };

    await requirePermission(member.supplier_id, "staff.manage");

    if (
      member.role === "admin" &&
      member.is_active &&
      member.accepted_at
    ) {
      const count = await countActiveAdmins(member.supplier_id, member.id);
      if (count === 0) {
        return {
          ok: false,
          error: "Impossibile disattivare l'ultimo amministratore attivo",
        };
      }
    }

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("supplier_members")
      .update({ is_active: false })
      .eq("id", memberId)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore disattivazione" };
    }

    revalidatePath("/supplier/staff");
    return { ok: true, data: data as MemberRow };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore disattivazione membro",
    };
  }
}

export async function reactivateMember(
  memberId: string,
): Promise<Result<MemberRow>> {
  try {
    const parsed = MemberIdSchema.safeParse({ member_id: memberId });
    if (!parsed.success) {
      return { ok: false, error: "ID membro non valido" };
    }

    const member = await loadMember(memberId);
    if (!member) return { ok: false, error: "Membro non trovato" };

    await requirePermission(member.supplier_id, "staff.manage");

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("supplier_members")
      .update({ is_active: true })
      .eq("id", memberId)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore riattivazione" };
    }

    revalidatePath("/supplier/staff");
    return { ok: true, data: data as MemberRow };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore riattivazione membro",
    };
  }
}

export async function revokeInvite(
  memberId: string,
): Promise<Result<MemberRow>> {
  try {
    const parsed = MemberIdSchema.safeParse({ member_id: memberId });
    if (!parsed.success) {
      return { ok: false, error: "ID membro non valido" };
    }

    const member = await loadMember(memberId);
    if (!member) return { ok: false, error: "Membro non trovato" };

    await requirePermission(member.supplier_id, "staff.manage");

    if (member.accepted_at) {
      return {
        ok: false,
        error: "Invito già accettato: usa la disattivazione membro",
      };
    }

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("supplier_members")
      .update({ is_active: false })
      .eq("id", memberId)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore revoca invito" };
    }

    revalidatePath("/supplier/staff");
    return { ok: true, data: data as MemberRow };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore revoca invito",
    };
  }
}

export async function acceptInvite(
  supplierId: string,
): Promise<Result<MemberRow>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { ok: false, error: "Sessione non valida" };

    const supabase = await createClient();
    const { data: existing } = await (supabase as any)
      .from("supplier_members")
      .select("*")
      .eq("supplier_id", supplierId)
      .eq("profile_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!existing) {
      return { ok: false, error: "Nessun invito attivo per questo fornitore" };
    }
    const row = existing as MemberRow;
    if (row.accepted_at) {
      return { ok: true, data: row };
    }

    const { data, error } = await (supabase as any)
      .from("supplier_members")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Errore accettazione" };
    }

    revalidatePath("/supplier/staff");
    return { ok: true, data: data as MemberRow };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore accettazione invito",
    };
  }
}
