/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { loadQuickOrderData } from "@/lib/restaurants/ordering/quick-server";
import type { Offer } from "@/lib/restaurants/ordering/types";
import { KitchenListClient, type KitchenRequest } from "./kitchen-list-client";

export const metadata: Metadata = { title: "Lista cucina" };

/** First name / email prefix of teammates (auth users are not readable via RLS). */
async function teammateNames(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  try {
    const admin = createAdminClient();
    await Promise.all(
      ids.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        const u = data.user;
        const meta = (u?.user_metadata ?? {}) as { full_name?: string; name?: string };
        out[id] = (meta.full_name || meta.name || u?.email?.split("@")[0] || "Collega").split(" ")[0]!;
      }),
    );
  } catch {
    /* service key missing: generic labels */
  }
  return out;
}

export default async function KitchenListPage() {
  const ctx = await getRestaurantContext();
  if (!ctx) redirect("/dashboard");
  const supabase = (await createClient()) as any;

  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [openRes, recentRes, quick] = await Promise.all([
    supabase
      .from("kitchen_requests")
      .select("id, raw_text, product_name, quantity, unit, note, offer, status, requested_by, decided_at, created_at")
      .eq("restaurant_id", ctx.restaurantId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("kitchen_requests")
      .select("id, raw_text, product_name, quantity, unit, note, offer, status, requested_by, decided_at, created_at")
      .eq("restaurant_id", ctx.restaurantId)
      .neq("status", "open")
      .gte("created_at", since)
      .order("decided_at", { ascending: false })
      .limit(30),
    loadQuickOrderData(ctx),
  ]);

  const unavailable = !!openRes.error;
  const rows = [...(openRes.data ?? []), ...(recentRes.data ?? [])] as any[];
  const names = await teammateNames([...new Set(rows.map((r) => r.requested_by as string))]);
  const requests: KitchenRequest[] = rows.map((r) => ({
    id: r.id,
    rawText: r.raw_text,
    productName: r.product_name,
    quantity: r.quantity === null ? null : Number(r.quantity),
    unit: r.unit,
    note: r.note,
    offer: (r.offer as Offer | null) ?? null,
    status: r.status,
    requestedBy: r.requested_by,
    requestedByName: r.requested_by === ctx.userId ? "Tu" : names[r.requested_by] ?? "Collega",
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  }));

  return (
    <KitchenListClient
      requests={requests}
      offers={quick.offers}
      timesOrdered={quick.timesOrdered}
      userId={ctx.userId}
      canAdd={contextCan(ctx, "order.draft")}
      canApprove={contextCan(ctx, "order.submit")}
      unavailable={unavailable}
    />
  );
}
