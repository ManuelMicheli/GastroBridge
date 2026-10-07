import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import { KanbanClient, type KanbanCard } from "./kanban-client";
import { getCurrentSupplierMember } from "@/lib/supplier/current-member";

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
  const member = await getCurrentSupplierMember();
  const supplier = member ? { id: member.supplier_id } : null;

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
  const itemsBySplit = new Map<string, { lineCount: number; qtyTotal: number }>();
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
      <header className="mb-2 flex flex-col gap-4 pt-3 sm:flex-row sm:items-start sm:justify-between lg:pt-0">
        <div>
          <h1 className="f-title f-type">Kanban ordini</h1>
          <p className="f-subtitle mt-1 max-w-[62ch]">
            Trascina le card tra colonne per far avanzare lo stato. Le
            transizioni non consentite richiedono il dettaglio ordine.
          </p>
        </div>
        <Link href="/supplier/ordini" className="f-btn f-btn-outline">
          Vista lista
        </Link>
      </header>

      <KanbanClient supplierId={supplierId} cards={cards} />
    </div>
  );
}
