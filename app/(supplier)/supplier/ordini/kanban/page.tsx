import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowState } from "@/lib/orders/supplier-actions";
import { KanbanClient, type KanbanCard } from "./kanban-client";

export const metadata: Metadata = { title: "Kanban Ordini — Fornitore" };

type SplitRow = {
  id: string;
  order_id: string;
  subtotal: number;
  status: string;
  supplier_notes: string | null;
  expected_delivery_date: string | null;
  confirmed_at: string | null;
  orders: {
    created_at: string;
    restaurants: { name: string } | null;
  } | null;
};

type ItemRow = {
  order_split_id: string;
  quantity_requested: number;
};

export default async function SupplierOrdersKanbanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .single<{ id: string }>();

  const supplierId = supplier?.id ?? null;

  const { data: splitsRaw } = await supabase
    .from("order_splits")
    .select(
      "id, order_id, subtotal, status, supplier_notes, expected_delivery_date, confirmed_at, orders(created_at, restaurants(name))",
    )
    .eq("supplier_id", supplierId ?? "none")
    .order("order_id", { ascending: false })
    .returns<SplitRow[]>();

  const splits = splitsRaw ?? [];
  const splitIds = splits.map((s) => s.id);

  // Count righe per split (e somma quantita' per badge).
  let itemsBySplit = new Map<string, { lineCount: number; qtyTotal: number }>();
  if (splitIds.length > 0) {
    const { data: items } = await supabase
      .from("order_split_items")
      .select("order_split_id, quantity_requested")
      .in("order_split_id", splitIds)
      .returns<ItemRow[]>();
    for (const it of items ?? []) {
      const agg = itemsBySplit.get(it.order_split_id) ?? {
        lineCount: 0,
        qtyTotal: 0,
      };
      agg.lineCount += 1;
      agg.qtyTotal += Number(it.quantity_requested ?? 0);
      itemsBySplit.set(it.order_split_id, agg);
    }
  }

  // Map to kanban cards filtrando cancelled/rejected.
  const cards: KanbanCard[] = splits
    .map((s) => {
      const workflow = getWorkflowState(s.status, s.supplier_notes) as string;
      const agg = itemsBySplit.get(s.id) ?? { lineCount: 0, qtyTotal: 0 };
      return {
        id: s.id,
        orderId: s.order_id,
        restaurantName: s.orders?.restaurants?.name ?? "Ristorante",
        subtotal: Number(s.subtotal ?? 0),
        workflow,
        lineCount: agg.lineCount,
        qtyTotal: agg.qtyTotal,
        expectedDeliveryDate: s.expected_delivery_date,
        createdAt: s.orders?.created_at ?? null,
      };
    })
    .filter((c) => c.workflow !== "cancelled" && c.workflow !== "rejected");

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Kanban Ordini</h1>
          <p className="text-sm text-sage">
            Trascina le card tra colonne per far avanzare lo stato. Le
            transizioni non consentite richiedono il dettaglio ordine.
          </p>
        </div>
        <Link
          href="/supplier/ordini"
          className="text-sm text-forest underline hover:text-forest-dark"
        >
          Vista lista
        </Link>
      </header>

      <KanbanClient supplierId={supplierId} cards={cards} />
    </div>
  );
}
