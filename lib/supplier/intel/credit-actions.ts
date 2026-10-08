/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";

const TermsSchema = z.object({
  restaurantId: z.string().uuid(),
  creditLimit: z.number().min(0).max(10_000_000).nullable(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable(),
  creditHold: z.boolean(),
  notes: z.string().trim().max(500).nullable(),
});

export type CustomerTermsInput = z.infer<typeof TermsSchema>;

/** Fido / termini / blocco for one client. Permission: `pricing.edit`. */
export async function upsertCustomerTerms(
  input: CustomerTermsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = TermsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "pricing.edit")) {
    return { ok: false, error: "Il tuo ruolo non può modificare le condizioni commerciali" };
  }
  const supabase = await createClient();

  const { data: rel } = (await (supabase as any)
    .from("restaurant_suppliers")
    .select("id")
    .eq("supplier_id", member.supplier_id)
    .eq("restaurant_id", parsed.data.restaurantId)
    .maybeSingle()) as { data: { id: string } | null };
  if (!rel) return { ok: false, error: "Cliente non collegato" };

  const { error } = await (supabase as any).from("supplier_customer_terms").upsert(
    {
      supplier_id: member.supplier_id,
      restaurant_id: parsed.data.restaurantId,
      credit_limit_eur: parsed.data.creditLimit,
      payment_terms_days: parsed.data.paymentTermsDays,
      credit_hold: parsed.data.creditHold,
      notes: parsed.data.notes || null,
      updated_by_member_id: member.id,
    },
    { onConflict: "supplier_id,restaurant_id" },
  );
  if (error) {
    return {
      ok: false,
      error: /supplier_customer_terms/.test(error.message ?? "")
        ? "Funzione non ancora attiva: applica la migrazione 20261009000000"
        : error.message,
    };
  }
  revalidatePath(`/supplier/clienti/${rel.id}`);
  revalidatePath("/supplier/insight");
  return { ok: true };
}
