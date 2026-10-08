/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Scheduled price changes with advance notice to the clients of the list.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { notifyRestaurants } from "@/lib/supplier/notify-restaurant";
import { addDaysKey, todayKey } from "@/lib/supplier/intel/time";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const ScheduleSchema = z.object({
  priceListId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  mode: z.enum(["percent", "fixed"]),
  value: z
    .number()
    .refine((v) => v !== 0, "La variazione non può essere zero")
    .refine((v) => Math.abs(v) <= 1000, "Variazione troppo grande"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  note: z.string().trim().max(300).nullable(),
  notifyClients: z.boolean(),
});

export type ScheduleInput = z.infer<typeof ScheduleSchema>;

function missingTable(msg: string | undefined): boolean {
  return /scheduled_price_changes/.test(msg ?? "");
}

function describe(input: { mode: "percent" | "fixed"; value: number }): string {
  if (input.mode === "percent") return `${input.value > 0 ? "+" : ""}${String(input.value).replace(".", ",")}%`;
  const abs = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Math.abs(input.value));
  return `${input.value > 0 ? "+" : "−"}${abs} per unità`;
}

export async function schedulePriceChange(input: ScheduleInput): Promise<Result<{ id: string; notified: number }>> {
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const d = parsed.data;
  if (d.effectiveDate < addDaysKey(todayKey(), 1)) {
    return { ok: false, error: "La data di decorrenza deve essere da domani in poi (per oggi usa la modifica massiva)" };
  }

  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "pricing.edit")) return { ok: false, error: "Permesso mancante: pricing.edit" };
  const supabase = await createClient();

  const { data: list } = (await (supabase as any)
    .from("price_lists")
    .select("id, name, supplier_id, is_default")
    .eq("id", d.priceListId)
    .maybeSingle()) as { data: { id: string; name: string; supplier_id: string; is_default: boolean } | null };
  if (!list || list.supplier_id !== member.supplier_id) return { ok: false, error: "Listino non trovato" };

  let categoryName: string | null = null;
  if (d.categoryId) {
    const { data: cat } = (await (supabase as any)
      .from("categories")
      .select("name")
      .eq("id", d.categoryId)
      .maybeSingle()) as { data: { name: string } | null };
    if (!cat) return { ok: false, error: "Categoria non valida" };
    categoryName = cat.name;
  }

  const { data: row, error } = (await (supabase as any)
    .from("scheduled_price_changes")
    .insert({
      supplier_id: member.supplier_id,
      price_list_id: d.priceListId,
      category_id: d.categoryId,
      mode: d.mode,
      value: d.value,
      effective_date: d.effectiveDate,
      note: d.note,
      notify_clients: d.notifyClients,
      created_by_member_id: member.id,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };
  if (error || !row) {
    return {
      ok: false,
      error: missingTable(error?.message)
        ? "Funzione non ancora attiva: applica la migrazione 20261009000000"
        : error?.message ?? "Errore salvataggio",
    };
  }

  let notified = 0;
  if (d.notifyClients) {
    // Clients on this list (+ clients without an assignment when it is the
    // default list).
    const [{ data: assigned }, { data: rels }, { data: sup }] = await Promise.all([
      (supabase as any)
        .from("customer_price_assignments")
        .select("restaurant_id, price_list_id")
        .eq("supplier_id", member.supplier_id),
      (supabase as any)
        .from("restaurant_suppliers")
        .select("id, restaurant_id")
        .eq("supplier_id", member.supplier_id)
        .eq("status", "active"),
      (supabase as any).from("suppliers").select("company_name").eq("id", member.supplier_id).maybeSingle(),
    ]);
    const assignedMap = new Map(
      ((assigned ?? []) as Array<{ restaurant_id: string; price_list_id: string }>).map((a) => [a.restaurant_id, a.price_list_id]),
    );
    const targets = ((rels ?? []) as Array<{ id: string; restaurant_id: string }>).filter((r) => {
      const l = assignedMap.get(r.restaurant_id);
      return l === list.id || (!l && list.is_default);
    });

    const dateIt = d.effectiveDate.split("-").reverse().join("/");
    const what = categoryName ? `i prezzi di ${categoryName}` : "i prezzi del listino";
    const body = `Dal ${dateIt} ${what} varieranno di ${describe(d)}.${d.note ? ` ${d.note}` : ""}`;

    if (targets.length > 0) {
      // Authorised above (member + pricing.edit + own list): the chat rows are
      // written in one batch with the service role, as this member.
      const admin = createAdminClient() as any;
      const { error: msgErr } = await admin.from("partnership_messages").insert(
        targets.map((t) => ({
          relationship_id: t.id,
          sender_role: "supplier",
          sender_profile: member.profile_id,
          body: `Avviso variazione prezzi: ${body}`,
        })),
      );
      if (msgErr) console.error("[pricing:scheduled] chat notice failed", msgErr);
      const inApp = await notifyRestaurants(
        targets.map((t) => t.restaurant_id),
        {
          eventType: "price_change_scheduled",
          title: `${sup?.company_name ?? "Il fornitore"}: variazione prezzi dal ${dateIt}`,
          body,
          link: "/fornitori",
          metadata: { scheduledChangeId: row.id, effectiveDate: d.effectiveDate },
        },
      );
      await (supabase as any)
        .from("scheduled_price_changes")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", row.id);
      // Clients reached: every target got the chat notice; else the in-app count.
      notified = msgErr ? inApp : targets.length;
    }
  }

  revalidatePath(`/supplier/listini/${d.priceListId}`);
  return { ok: true, data: { id: row.id, notified } };
}

export async function cancelScheduledPriceChange(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID non valido" };
  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "pricing.edit")) return { ok: false, error: "Permesso mancante: pricing.edit" };
  const supabase = await createClient();
  const { data, error } = (await (supabase as any)
    .from("scheduled_price_changes")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("supplier_id", member.supplier_id)
    .eq("status", "scheduled")
    .select("price_list_id")) as { data: Array<{ price_list_id: string }> | null; error: { message: string } | null };
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Variazione non annullabile (già applicata?)" };
  revalidatePath(`/supplier/listini/${data[0]!.price_list_id}`);
  return { ok: true, data: undefined };
}
