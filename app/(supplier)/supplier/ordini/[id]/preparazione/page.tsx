/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getActiveSupplierMember, requirePermission } from "@/lib/supplier/context";
import { transitionToPreparing } from "@/lib/orders/supplier-actions";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import { allocateFefo } from "@/lib/supplier/stock/fefo";
import type { LotCandidate } from "@/lib/supplier/stock/types";

import { PickingClient } from "./picking-client";
import type {
  PickingInitialData,
  PickingLineView,
  PickingLotOption,
} from "./picking-types";

export const metadata: Metadata = { title: "Picking — Preparazione ordine" };

type ItemRow = {
  id: string;
  order_split_id: string;
  product_id: string;
  status: string;
  quantity_accepted: number | null;
  quantity_requested: number;
  products: { id: string; name: string; supplier_id: string } | null;
};

type LotRow = {
  id: string;
  product_id: string;
  warehouse_id: string;
  lot_code: string;
  expiry_date: string | null;
  quantity_base: number;
  quantity_reserved_base: number;
  received_at: string;
};

type DeliveryItemRow = {
  id: string;
  order_split_item_id: string;
  lot_id: string;
  quantity_base: number;
  stock_lots: { lot_code: string; expiry_date: string | null } | null;
};

export default async function PickingPreparazionePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: splitId } = await params;
  const supabase = await createClient();

  // Load split (no RLS bypass — server client uses user session)
  const { data: split, error: splitErr } = await (supabase as any)
    .from("order_splits")
    .select(
      "id, supplier_id, order_id, warehouse_id, status, supplier_notes, expected_delivery_date, subtotal, orders:order_id ( created_at, restaurants:restaurant_id ( name ) )",
    )
    .eq("id", splitId)
    .maybeSingle();

  if (splitErr || !split) notFound();

  // Permission gate — order.prepare (warehouse + admin)
  try {
    await requirePermission(split.supplier_id, "order.prepare");
  } catch {
    redirect(`/supplier/ordini/${splitId}`);
  }

  const member = await getActiveSupplierMember(split.supplier_id);
  if (!member) redirect(`/supplier/ordini/${splitId}`);

  // Workflow gate — solo `confirmed` o `preparing`
  const workflowState = getWorkflowState(split.status, split.supplier_notes);
  if (workflowState !== "confirmed" && workflowState !== "preparing") {
    redirect(`/supplier/ordini/${splitId}`);
  }

  // Prima apertura → transizione a preparing
  if (workflowState === "confirmed") {
    await transitionToPreparing(splitId).catch(() => null);
  }

  // Carica righe accepted/modified
  const { data: itemsRaw } = await (supabase as any)
    .from("order_split_items")
    .select(
      "id, order_split_id, product_id, status, quantity_accepted, quantity_requested, products:product_id ( id, name, supplier_id )",
    )
    .eq("order_split_id", splitId)
    .in("status", ["accepted", "modified"])
    .order("id", { ascending: true });

  const items = (itemsRaw ?? []) as ItemRow[];

  // Carica tutti i lotti (con stock o riservati) del magazzino/prodotti coinvolti
  const productIds = Array.from(new Set(items.map((i) => i.product_id)));
  let lots: LotRow[] = [];
  if (productIds.length > 0 && split.warehouse_id) {
    const { data: lotsRaw } = await (supabase as any)
      .from("stock_lots")
      .select(
        "id, product_id, warehouse_id, lot_code, expiry_date, quantity_base, quantity_reserved_base, received_at",
      )
      .eq("warehouse_id", split.warehouse_id)
      .in("product_id", productIds);
    lots = (lotsRaw ?? []) as LotRow[];
  }

  // Carica delivery_items gia' registrati (righe "picked")
  const { data: deliveryItemsRaw } = await (supabase as any)
    .from("delivery_items")
    .select(
      "id, order_split_item_id, lot_id, quantity_base, stock_lots:lot_id ( lot_code, expiry_date ), deliveries:delivery_id!inner ( order_split_id )",
    )
    .eq("deliveries.order_split_id", splitId);

  const deliveryItems = (deliveryItemsRaw ?? []) as DeliveryItemRow[];

  // Gia' prelevato per riga (somma quantity_base)
  const pickedByItem = new Map<
    string,
    { total: number; lots: Array<{ lotId: string; lotCode: string; expiryDate: string | null; quantityBase: number }> }
  >();
  for (const di of deliveryItems) {
    const cur = pickedByItem.get(di.order_split_item_id) ?? { total: 0, lots: [] };
    cur.total += Number(di.quantity_base);
    cur.lots.push({
      lotId: di.lot_id,
      lotCode: di.stock_lots?.lot_code ?? "—",
      expiryDate: di.stock_lots?.expiry_date ?? null,
      quantityBase: Number(di.quantity_base),
    });
    pickedByItem.set(di.order_split_item_id, cur);
  }

  // Build views per riga
  const lines: PickingLineView[] = items.map((it) => {
    const qtyAccepted = Number(it.quantity_accepted ?? it.quantity_requested);
    const productLots = lots.filter((l) => l.product_id === it.product_id);

    // Lotti candidati FEFO (qty disponibile = quantity_reserved_base,
    // che e' la quota gia' prenotata per questo split + altri split).
    // Proponiamo prioritariamente i lotti con quota riservata > 0.
    const candidates: LotCandidate[] = productLots
      .filter((l) => l.quantity_reserved_base > 0)
      .map((l) => ({
        id: l.id,
        productId: l.product_id,
        warehouseId: l.warehouse_id,
        lotCode: l.lot_code,
        expiryDate: l.expiry_date,
        receivedAt: l.received_at,
        // Ai fini FEFO consideriamo disponibile la quota riservata
        // (gia' allocata alla reservation), non lo stock libero residuo.
        quantityBase: l.quantity_reserved_base,
        quantityReservedBase: 0,
      }));

    const pickedInfo = pickedByItem.get(it.id);
    const alreadyPicked = pickedInfo?.total ?? 0;
    const remaining = Math.max(0, qtyAccepted - alreadyPicked);

    const fefo = allocateFefo(candidates, remaining);
    const proposed = fefo.ok ? fefo.allocations : fefo.allocations;

    // Opzioni lotto visibili: tutti i lotti del prodotto con qty > 0
    const options: PickingLotOption[] = productLots
      .filter((l) => l.quantity_base > 0)
      .map((l) => ({
        lotId: l.id,
        lotCode: l.lot_code,
        expiryDate: l.expiry_date,
        receivedAt: l.received_at,
        quantityBase: Number(l.quantity_base),
        quantityReservedBase: Number(l.quantity_reserved_base),
      }))
      .sort((a, b) => {
        const ax = a.expiryDate ?? "9999-12-31";
        const bx = b.expiryDate ?? "9999-12-31";
        if (ax !== bx) return ax < bx ? -1 : 1;
        return a.receivedAt < b.receivedAt ? -1 : 1;
      });

    return {
      splitItemId: it.id,
      productId: it.product_id,
      productName: it.products?.name ?? "Prodotto",
      quantityAccepted: qtyAccepted,
      quantityPicked: alreadyPicked,
      remaining,
      picked: remaining === 0 && qtyAccepted > 0,
      proposals: proposed.map((a) => {
        const lot = productLots.find((l) => l.id === a.lotId);
        return {
          lotId: a.lotId,
          lotCode: lot?.lot_code ?? "—",
          expiryDate: lot?.expiry_date ?? null,
          quantityBase: a.quantityBase,
        };
      }),
      proposalShortage: fefo.ok ? 0 : fefo.shortBy,
      options,
      pickedLots: pickedInfo?.lots ?? [],
    };
  });

  const initial: PickingInitialData = {
    splitId: split.id,
    orderShortId: (split.order_id ?? "").slice(0, 8),
    restaurantName:
      (split as any).orders?.restaurants?.name ?? "Ristorante",
    expectedDeliveryDate: split.expected_delivery_date ?? null,
    workflowState: workflowState === "confirmed" ? "preparing" : workflowState,
    lines,
  };

  return <PickingClient initial={initial} />;
}
