"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import {
  transitionSplitStatus,
  type KanbanTargetStatus,
} from "@/lib/orders/supplier-actions";

export type KanbanCard = {
  id: string;
  orderId: string;
  restaurantName: string;
  subtotal: number;
  workflow: string;
  lineCount: number;
  qtyTotal: number;
  expectedDeliveryDate: string | null;
  createdAt: string | null;
};

type ColumnId =
  | "new"
  | "confirmed"
  | "preparing"
  | "packed"
  | "shipped"
  | "delivered";

type Column = {
  id: ColumnId;
  label: string;
  // workflow states mapped to this column
  states: string[];
  // target status passed to transitionSplitStatus when dropping HERE
  dropTarget: KanbanTargetStatus | null;
  // accent (dark-token friendly)
  accent: string;
};

const COLUMNS: Column[] = [
  {
    id: "new",
    label: "Nuovi",
    states: ["submitted", "pending", "pending_customer_confirmation", "stock_conflict"],
    dropTarget: null,
    accent: "bg-terracotta-light/40 border-terracotta/40",
  },
  {
    id: "confirmed",
    label: "Confermati",
    states: ["confirmed"],
    dropTarget: null,
    accent: "bg-forest-light/40 border-forest/30",
  },
  {
    id: "preparing",
    label: "In preparazione",
    states: ["preparing"],
    dropTarget: "preparing",
    accent: "bg-sage-muted/40 border-sage/30",
  },
  {
    id: "packed",
    label: "Imballati",
    states: ["packed"],
    dropTarget: "packed",
    accent: "bg-sage-muted/30 border-sage/40",
  },
  {
    id: "shipped",
    label: "Spediti",
    states: ["shipping", "shipped"],
    dropTarget: "shipped",
    accent: "bg-forest-light/30 border-forest/30",
  },
  {
    id: "delivered",
    label: "Consegnati",
    states: ["delivered"],
    dropTarget: "delivered",
    accent: "bg-forest-light/60 border-forest/40",
  },
];

function stateToColumn(workflow: string): ColumnId | null {
  for (const col of COLUMNS) {
    if (col.states.includes(workflow)) return col.id;
  }
  return null;
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function WORKFLOW_BADGE(workflow: string): { label: string; variant: "default" | "success" | "warning" | "info" | "outline" } {
  switch (workflow) {
    case "submitted":
    case "pending":
      return { label: "In attesa", variant: "warning" };
    case "pending_customer_confirmation":
      return { label: "Attesa cliente", variant: "warning" };
    case "stock_conflict":
      return { label: "Conflitto stock", variant: "warning" };
    case "confirmed":
      return { label: "Confermato", variant: "info" };
    case "preparing":
      return { label: "In preparazione", variant: "info" };
    case "packed":
      return { label: "Imballato", variant: "info" };
    case "shipping":
    case "shipped":
      return { label: "Spedito", variant: "info" };
    case "delivered":
      return { label: "Consegnato", variant: "success" };
    default:
      return { label: workflow, variant: "outline" };
  }
}

// ---------------------------------------------------------------------------

function DraggableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { workflow: card.workflow },
  });

  const dLeft = daysUntil(card.expectedDeliveryDate);
  const badge = WORKFLOW_BADGE(card.workflow);

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card className="p-4 border border-sage-muted/60 bg-white hover:shadow-elevated transition-shadow select-none">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-semibold text-charcoal truncate">
              {card.restaurantName}
            </p>
            <p className="text-xs text-sage font-mono">
              #{card.id.slice(0, 8)}
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-sage mb-2">
          <span>
            {card.lineCount} righe · {card.qtyTotal} pz
          </span>
          <span className="font-mono font-semibold text-charcoal">
            {formatCurrency(card.subtotal)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-sage">
            {card.createdAt ? formatDate(card.createdAt) : ""}
          </span>
          {dLeft !== null && (
            <span
              className={
                dLeft < 0
                  ? "text-terracotta font-semibold"
                  : dLeft === 0
                    ? "text-terracotta"
                    : "text-forest-dark"
              }
            >
              {dLeft < 0
                ? `${Math.abs(dLeft)}g in ritardo`
                : dLeft === 0
                  ? "oggi"
                  : `tra ${dLeft}g`}
            </span>
          )}
          <Link
            href={`/supplier/ordini/${card.id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-forest underline hover:text-forest-dark"
          >
            Dettaglio
          </Link>
        </div>
      </Card>
    </div>
  );
}

function DroppableColumn({
  column,
  cards,
  isActiveTarget,
}: {
  column: Column;
  cards: KanbanCard[];
  isActiveTarget: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between px-2 py-1.5">
        <h3 className="font-semibold text-charcoal text-sm uppercase tracking-wider">
          {column.label}
        </h3>
        <span className="text-xs text-sage font-mono">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={[
          "flex-1 rounded-xl border-2 border-dashed p-3 space-y-3 min-h-[60vh] transition-colors",
          column.accent,
          isOver ? "ring-2 ring-forest" : "",
          isActiveTarget ? "border-forest/70" : "",
        ].join(" ")}
      >
        {cards.length === 0 ? (
          <p className="text-center text-xs text-sage py-8">Nessun ordine</p>
        ) : (
          cards.map((c) => <DraggableCard key={c.id} card={c} />)
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function KanbanClient({
  supplierId,
  cards: initialCards,
}: {
  supplierId: string | null;
  cards: KanbanCard[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<KanbanCard[]>(initialCards);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Sync initial prop changes (realtime refresh).
  useMemo(() => {
    setCards(initialCards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCards]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<ColumnId, KanbanCard[]>();
    for (const col of COLUMNS) map.set(col.id, []);
    for (const card of cards) {
      const colId = stateToColumn(card.workflow);
      if (!colId) continue;
      map.get(colId)!.push(card);
    }
    return map;
  }, [cards]);

  const activeCard = activeCardId
    ? cards.find((c) => c.id === activeCardId) ?? null
    : null;

  function handleDragStart(ev: DragStartEvent) {
    setActiveCardId(String(ev.active.id));
  }

  function handleDragEnd(ev: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = ev;
    if (!over) return;

    const cardId = String(active.id);
    const fromWorkflow = (active.data.current?.workflow as string) ?? "";
    const toColumn = COLUMNS.find((c) => c.id === over.id);
    if (!toColumn) return;

    // Same column — no-op.
    if (toColumn.states.includes(fromWorkflow)) return;

    if (!toColumn.dropTarget) {
      toast.error(
        "Transizione non consentita — apri il dettaglio ordine per gestire questo passaggio",
      );
      return;
    }

    const target = toColumn.dropTarget;

    // Optimistic update: spostiamo la card al workflow target.
    const optimisticWorkflow =
      target === "shipped" ? "shipping" : (target as string);
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, workflow: optimisticWorkflow } : c,
      ),
    );

    startTransition(async () => {
      const res = await transitionSplitStatus({
        splitId: cardId,
        targetStatus: target,
      });
      if (!res.ok) {
        toast.error(res.error);
        // Rollback.
        setCards((prev) =>
          prev.map((c) =>
            c.id === cardId ? { ...c, workflow: fromWorkflow } : c,
          ),
        );
        return;
      }
      toast.success(`Stato aggiornato: ${toColumn.label}`);
      router.refresh();
    });
  }

  return (
    <>
      {supplierId && (
        <RealtimeRefresh
          subscriptions={[
            {
              table: "order_splits",
              filter: `supplier_id=eq.${supplierId}`,
            },
          ]}
        />
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const isActiveTarget =
              activeCard !== null &&
              col.dropTarget !== null &&
              col.states.every((s) => s !== activeCard.workflow) &&
              isLegalDrop(activeCard.workflow, col.dropTarget);
            return (
              <DroppableColumn
                key={col.id}
                column={col}
                cards={cardsByColumn.get(col.id) ?? []}
                isActiveTarget={isActiveTarget}
              />
            );
          })}
        </div>
      </DndContext>
    </>
  );
}

function isLegalDrop(
  fromWorkflow: string,
  target: KanbanTargetStatus,
): boolean {
  switch (target) {
    case "preparing":
      return fromWorkflow === "confirmed";
    case "packed":
      return fromWorkflow === "preparing";
    case "shipped":
      return fromWorkflow === "packed";
    case "delivered":
      return fromWorkflow === "shipping" || fromWorkflow === "shipped";
    default:
      return false;
  }
}
