/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Server actions: delivery schedules (/consegne) and par levels (/riordina).
// Authorization mirrors the RLS policies of 20261009000100_restaurant_superpowers.sql.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRestaurantContext } from "@/lib/restaurants/context";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const MISSING_TABLE = "Funzione non ancora attiva: applica le migrazioni del database (restaurant superpowers).";

function friendly(err: { message?: string; code?: string } | null | undefined, fallback: string): string {
  if (!err) return fallback;
  if (err.code === "42P01" || /does not exist|schema cache/i.test(err.message ?? "")) return MISSING_TABLE;
  if (err.code === "42501" || /row-level security/i.test(err.message ?? "")) {
    return "Il tuo ruolo non consente questa operazione";
  }
  return err.message || fallback;
}

/* ------------------------------------------------------------------ */
/* Delivery schedules                                                   */
/* ------------------------------------------------------------------ */

const scheduleSchema = z.object({
  kind: z.enum(["product", "catalog"]),
  key: z.string().uuid(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  cutoffTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido (HH:MM)")
    .nullable(),
  leadDays: z.number().int().min(0).max(14),
  reminderEnabled: z.boolean(),
  notes: z.string().trim().max(300).nullable().optional(),
});

export type SaveScheduleInput = z.infer<typeof scheduleSchema>;

export async function saveSupplierSchedule(input: SaveScheduleInput): Promise<Result<{ id: string }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const auth = await requireRestaurantContext("order.submit");
  if (!auth.ok) return auth;
  const { ctx } = auth;
  const d = parsed.data;
  const supabase = (await createClient()) as any;

  // Private catalogs belong to a specific sede; platform suppliers are
  // scheduled for the active restaurant.
  let restaurantId = ctx.restaurantId;
  if (d.kind === "catalog") {
    const { data: cat } = await supabase
      .from("restaurant_catalogs")
      .select("id, restaurant_id")
      .eq("id", d.key)
      .in("restaurant_id", ctx.scopeIds)
      .maybeSingle();
    if (!cat) return { ok: false, error: "Listino non trovato" };
    restaurantId = cat.restaurant_id;
  } else {
    const { data: rel } = await supabase
      .from("restaurant_suppliers")
      .select("supplier_id")
      .in("restaurant_id", ctx.scopeIds)
      .eq("supplier_id", d.key)
      .eq("status", "active")
      .limit(1);
    if (!rel || rel.length === 0) return { ok: false, error: "Fornitore non collegato" };
  }

  const column = d.kind === "catalog" ? "catalog_id" : "supplier_id";
  const row = {
    restaurant_id: restaurantId,
    supplier_id: d.kind === "product" ? d.key : null,
    catalog_id: d.kind === "catalog" ? d.key : null,
    delivery_weekdays: [...new Set(d.weekdays)].sort(),
    cutoff_time: d.cutoffTime,
    lead_days: d.leadDays,
    reminder_enabled: d.reminderEnabled,
    notes: d.notes || null,
    updated_by: ctx.userId,
  };

  const { data: existing, error: selErr } = await supabase
    .from("restaurant_supplier_schedules")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq(column, d.key)
    .maybeSingle();
  if (selErr) return { ok: false, error: friendly(selErr, "Errore salvataggio") };

  const res = existing
    ? await supabase.from("restaurant_supplier_schedules").update(row).eq("id", existing.id).select("id").single()
    : await supabase.from("restaurant_supplier_schedules").insert(row).select("id").single();
  if (res.error || !res.data) return { ok: false, error: friendly(res.error, "Errore salvataggio") };

  revalidatePath("/consegne");
  revalidatePath("/riordina");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: res.data.id as string } };
}

/** Back to the supplier's own delivery zone (or no schedule). */
export async function deleteSupplierSchedule(scheduleId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(scheduleId).success) return { ok: false, error: "Calendario non valido" };
  const auth = await requireRestaurantContext("order.submit");
  if (!auth.ok) return auth;
  const supabase = (await createClient()) as any;
  const { error } = await supabase
    .from("restaurant_supplier_schedules")
    .delete()
    .eq("id", scheduleId)
    .in("restaurant_id", auth.ctx.scopeIds);
  if (error) return { ok: false, error: friendly(error, "Errore eliminazione") };
  revalidatePath("/consegne");
  revalidatePath("/riordina");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* Par levels                                                           */
/* ------------------------------------------------------------------ */

const parSchema = z.object({
  key: z.string().min(3).max(400).regex(/^(p:|c:)/, "Articolo non valido"),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(30).nullable(),
  par: z.number().min(0).max(100000).nullable(),
});

export async function saveParLevel(input: z.infer<typeof parSchema>): Promise<Result> {
  const parsed = parSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const auth = await requireRestaurantContext("par_levels.manage");
  if (!auth.ok) return auth;
  const { ctx } = auth;
  const d = parsed.data;
  const supabase = (await createClient()) as any;

  if (d.par === null) {
    const { error } = await supabase
      .from("restaurant_par_levels")
      .delete()
      .eq("restaurant_id", ctx.restaurantId)
      .eq("item_key", d.key);
    if (error) return { ok: false, error: friendly(error, "Errore salvataggio") };
  } else {
    const { error } = await supabase.from("restaurant_par_levels").upsert(
      {
        restaurant_id: ctx.restaurantId,
        item_key: d.key,
        product_name: d.name,
        unit: d.unit,
        par_qty: d.par,
        updated_by: ctx.userId,
      },
      { onConflict: "restaurant_id,item_key" },
    );
    if (error) return { ok: false, error: friendly(error, "Errore salvataggio") };
  }
  revalidatePath("/riordina");
  return { ok: true, data: undefined };
}
