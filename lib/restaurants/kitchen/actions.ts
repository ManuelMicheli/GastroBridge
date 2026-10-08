/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Lista cucina: the kitchen (order.draft) writes what it needs; who can order
// (order.submit) approves it into the cart or rejects it.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRestaurantContext } from "@/lib/restaurants/context";
import { notifyRestaurantTeam } from "@/lib/notifications/restaurant";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const MISSING = "Funzione non ancora attiva: applica le migrazioni del database (restaurant superpowers).";
function friendly(err: { message?: string; code?: string } | null | undefined, fallback: string): string {
  if (!err) return fallback;
  if (err.code === "42P01" || /does not exist|schema cache/i.test(err.message ?? "")) return MISSING;
  if (err.code === "42501" || /row-level security/i.test(err.message ?? "")) return "Il tuo ruolo non consente questa operazione";
  return err.message || fallback;
}

const offerSchema = z
  .object({
    key: z.string().max(400),
    kind: z.enum(["product", "catalog"]),
    offerId: z.string().max(80),
    cartProductId: z.string().max(100),
    supplierKey: z.string().max(80),
    supplierName: z.string().max(200),
    name: z.string().max(300),
    packName: z.string().max(400),
    unit: z.string().max(30),
    price: z.number().nonnegative(),
    brand: z.string().max(200).nullable(),
    imageUrl: z.string().max(1000).nullable(),
    minQuantity: z.number().nonnegative(),
  })
  .nullable();

const requestSchema = z.object({
  rawText: z.string().trim().min(1).max(300),
  productName: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(100000).nullable(),
  unit: z.string().trim().max(30).nullable(),
  note: z.string().trim().max(300).nullable(),
  offer: offerSchema,
});

export async function addKitchenRequests(input: z.infer<typeof requestSchema>[]): Promise<Result<{ added: number }>> {
  const parsed = z.array(requestSchema).min(1).max(50).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const auth = await requireRestaurantContext("order.draft");
  if (!auth.ok) return auth;
  const { ctx } = auth;
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("kitchen_requests").insert(
    parsed.data.map((r) => ({
      restaurant_id: ctx.restaurantId,
      raw_text: r.rawText,
      product_name: r.productName,
      quantity: r.quantity,
      unit: r.unit,
      note: r.note || null,
      offer: r.offer,
      status: "open",
      requested_by: ctx.userId,
    })),
  );
  if (error) return { ok: false, error: friendly(error, "Errore salvataggio") };

  const n = parsed.data.length;
  const preview = parsed.data
    .slice(0, 3)
    .map((r) => r.productName)
    .join(", ");
  await notifyRestaurantTeam(
    ctx.restaurantId,
    "order.submit",
    {
      event: "kitchen_request",
      title: "Lista cucina",
      body: `${n} nuov${n === 1 ? "a richiesta" : "e richieste"}: ${preview}${n > 3 ? "…" : ""}`,
      link: "/lista-cucina",
      tag: `kitchen_request:${ctx.restaurantId}`,
    },
    { excludeProfileIds: [ctx.userId] },
  );

  revalidatePath("/lista-cucina");
  revalidatePath("/dashboard");
  return { ok: true, data: { added: n } };
}

export async function decideKitchenRequests(input: {
  ids: string[];
  status: "approved" | "rejected";
}): Promise<Result<{ updated: number }>> {
  const parsed = z
    .object({ ids: z.array(z.string().uuid()).min(1).max(200), status: z.enum(["approved", "rejected"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dati non validi" };
  const auth = await requireRestaurantContext("order.submit");
  if (!auth.ok) return auth;
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from("kitchen_requests")
    .update({ status: parsed.data.status, decided_by: auth.ctx.userId, decided_at: new Date().toISOString() })
    .in("id", parsed.data.ids)
    .eq("restaurant_id", auth.ctx.restaurantId)
    .eq("status", "open")
    .select("id");
  if (error) return { ok: false, error: friendly(error, "Errore aggiornamento") };
  revalidatePath("/lista-cucina");
  revalidatePath("/dashboard");
  return { ok: true, data: { updated: (data ?? []).length } };
}

export async function deleteKitchenRequest(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Richiesta non valida" };
  const auth = await requireRestaurantContext();
  if (!auth.ok) return auth;
  const supabase = (await createClient()) as any;
  // RLS: own open request, or order.submit.
  const { data, error } = await supabase
    .from("kitchen_requests")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", auth.ctx.restaurantId)
    .select("id");
  if (error) return { ok: false, error: friendly(error, "Errore eliminazione") };
  if (!data || data.length === 0) return { ok: false, error: "Non puoi eliminare questa richiesta" };
  revalidatePath("/lista-cucina");
  return { ok: true, data: undefined };
}
