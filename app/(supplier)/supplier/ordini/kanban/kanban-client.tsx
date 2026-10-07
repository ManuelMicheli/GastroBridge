"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Clock, Package } from "lucide-react";
import { Chips } from "@/components/fernly/chips";
import { Avatar, StatusPill, type FTone } from "@/components/fernly/primitives";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { useFlashOnSplitUpdate } from "@/components/supplier/realtime/flash-highlight";
import { cn, formatCurrency, formatDate } from "@/lib/utils/formatters";
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
  // status dot colour in the column header
  accent: string;
};

const COLUMNS: Column[] = [
  {
    id: "new",
    label: "Nuovi",
    states: ["submitted", "pending", "pending_customer_confirmation", "stock_conflict"],
    dropTarget: null,
    accent: "#9AA19E",
  },
  {
    id: "confirmed",
    label: "Confermati",
    states: ["confirmed"],
    dropTarget: null,
    accent: "#D99A2B",
  },
  {
    id: "preparing",
    label: "In preparazione",
    states: ["preparing"],
    dropTarget: "preparing",
    accent: "#8A63C9",
  },
  {
    id: "packed",
    label: "Imballati",
    states: ["packed"],
    dropTarget: "packed",
    accent: "#4C6FD8",
  },
  {
    id: "shipped",
    label: "Spediti",
    states: ["shipping", "shipped"],
    dropTarget: "shipped",
    accent: "var(--acc-600)",
  },
  {
    id: "delivered",
    label: "Consegnati",
    states: ["delivered"],
    dropTarget: "delivered",
    accent: "#2E9463",
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

function WORKFLOW_BADGE(workflow: string): { label: string; variant: FTone } {
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
      return { label: workflow, variant: "neutral" };
  }
}

// ---------------------------------------------------------------------------

const PROGRESS: Record<string, number> = {
  submitted: 0.12,
  pending: 0.12,
  pending_customer_confirmation: 0.12,
  stock_conflict: 0.12,
  confirmed: 0.3,
  preparing: 0.5,
  packed: 0.7,
  shipping: 0.85,
  shipped: 0.85,
  delivered: 1,
};

const EASE = [0.22, 1, 0.36, 1] as const;

function dueLabel(dLeft: number | null): { text: string; late: boolean } | null {
  if (dLeft === null) return null;
  if (dLeft < 0) return { text: `${Math.abs(dLeft)}g in ritardo`, late: true };
  if (dLeft === 0) return { text: "oggi", late: false };
  return { text: `tra ${dLeft}g`, late: false };
}

/** Fernly task card body (shared by the in-column card and the drag overlay). */
function CardBody({ card, lifted = false }: { card: KanbanCard; lifted?: boolean }) {
  const badge = WORKFLOW_BADGE(card.workflow);
  const due = dueLabel(daysUntil(card.expectedDeliveryDate));
  const progress = PROGRESS[card.workflow] ?? 0.1;
  return (
    <div
      className={cn(
        "f-card select-none !rounded-[16px] p-4",
        lifted && "shadow-[0_2px_6px_rgba(16,24,20,0.08),0_22px_44px_rgba(16,24,20,0.20)]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <StatusPill tone={badge.variant} className="!h-[21px] !rounded-[7px] !text-[11px]">
          {badge.label}
        </StatusPill>
        <span className="f-tag !h-[21px] bg-[var(--f-fill-2)] !text-[11px] text-[var(--f-ink-2)]">
          <Package className="h-3 w-3" /> {card.lineCount} righe
        </span>
        <Link
          href={`/supplier/ordini/${card.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--f-muted)] transition-colors hover:bg-[var(--f-fill)] hover:text-[var(--f-ink)]"
          aria-label={`Dettaglio ordine ${card.id.slice(0, 8)}`}
          title="Dettaglio"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-2.5 truncate text-[14.5px] font-semibold text-[var(--f-ink)]">{card.restaurantName}</p>
      <p className="text-[11.5px] text-[var(--f-faint)] tabular-nums">#{card.id.slice(0, 8)}</p>
      <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-[var(--f-fill-2)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.round(progress * 100)}%`,
            background: card.workflow === "delivered" ? "var(--f-success)" : "var(--acc-600)",
          }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2.5 whitespace-nowrap text-[12px] text-[var(--f-muted)]">
        {due ? (
          <span className={cn("inline-flex items-center gap-1", due.late && "font-semibold text-[var(--f-danger)]")}>
            <Clock className="h-3.5 w-3.5" /> {due.text}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {card.createdAt ? formatDate(card.createdAt) : "—"}
          </span>
        )}
        <span className="tabular-nums">{card.qtyTotal} pz</span>
        <span className="ml-auto flex items-center gap-2">
          <b className="font-semibold text-[var(--f-ink)] tabular-nums">{formatCurrency(card.subtotal)}</b>
          <Avatar name={card.restaurantName} size={26} />
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { workflow: card.workflow },
  });
  const flash = useFlashOnSplitUpdate(card.id);
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={setNodeRef}
      layout={!reduce}
      layoutId={reduce ? undefined : `kb-${card.id}`}
      transition={{ layout: { duration: 0.28, ease: EASE } }}
      data-split-id={card.id}
      className={cn("touch-none cursor-grab rounded-[16px] outline-none active:cursor-grabbing", flash)}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      {...listeners}
      {...attributes}
    >
      <CardBody card={card} />
    </motion.div>
  );
}

function DroppableColumn({
  column,
  cards,
  isActiveTarget,
  dragging,
  index,
}: {
  column: Column;
  cards: KanbanCard[];
  isActiveTarget: boolean;
  dragging: boolean;
  index: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const highlight = isOver && dragging;

  return (
    <section className="f-rise flex w-[286px] shrink-0 flex-col" style={{ ["--i" as string]: index }} aria-label={column.label}>
      <header className="mb-2.5 flex items-center gap-2 px-1.5">
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: column.accent }} />
        <h3 className="text-[14px] font-semibold text-[var(--f-ink)]">{column.label}</h3>
        <span className="ml-auto text-[12.5px] font-medium text-[var(--f-muted)] tabular-nums">{cards.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[60vh] flex-1 flex-col gap-2.5 rounded-[18px] border-[1.5px] p-1.5 transition-[background-color,border-color] duration-200",
          highlight
            ? "border-[var(--acc-600)] bg-[var(--acc-50)]"
            : isActiveTarget
              ? "border-dashed border-[color:color-mix(in_oklab,var(--acc-600)_45%,transparent)] bg-transparent"
              : "border-transparent bg-transparent",
        )}
      >
        {cards.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[var(--f-line-strong)] py-8 text-center text-[12.5px] text-[var(--f-faint)]">
            Nessun ordine
          </p>
        ) : (
          cards.map((c) => <DraggableCard key={c.id} card={c} />)
        )}
      </div>
    </section>
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
    useSensor(KeyboardSensor),
  );
  const reduce = useReducedMotion();
  type DueFilter = "all" | "late" | "today" | "week";
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  // Sync initial prop changes (realtime refresh).
  useMemo(() => {
    setCards(initialCards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCards]);

  const visibleCards = useMemo(() => {
    if (dueFilter === "all") return cards;
    return cards.filter((c) => {
      const d = daysUntil(c.expectedDeliveryDate);
      if (d === null) return false;
      if (dueFilter === "late") return d < 0 && c.workflow !== "delivered";
      if (dueFilter === "today") return d === 0;
      return d >= 0 && d <= 6;
    });
  }, [cards, dueFilter]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<ColumnId, KanbanCard[]>();
    for (const col of COLUMNS) map.set(col.id, []);
    for (const card of visibleCards) {
      const colId = stateToColumn(card.workflow);
      if (!colId) continue;
      map.get(colId)!.push(card);
    }
    return map;
  }, [visibleCards]);

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

      {/* Mobile: kanban drag-drop unusable with touch → fallback to list CTA */}
      <div className="lg:hidden mx-3 mt-4 mb-3">
        <div className="f-card px-4 py-4">
          <div
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]"
          >
            Kanban · vista desktop
          </div>
          <p className="mt-2 text-[17px] font-semibold leading-snug text-[var(--f-ink)]">
            Il trascinamento kanban funziona solo su schermo grande.
          </p>
          <p className="mt-1 text-[12px] text-[color:var(--text-muted-light)]">
            Su mobile gestisci gli ordini dalla lista con azioni contestuali.
          </p>
          <Link
            href="/supplier/ordini"
            className="f-btn f-btn-primary mt-3"
          >
            Apri lista ordini →
          </Link>
        </div>

        {/* Quick state summary — read-only counts per column */}
        <div className="mt-4 space-y-2">
          {COLUMNS.map((col) => {
            const n = (cardsByColumn.get(col.id) ?? []).length;
            return (
              <div
                key={col.id}
                className="f-card flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
                    {col.label}
                  </div>
                  <div className="mt-0.5 text-[20px] font-semibold text-[var(--f-ink)] tabular-nums">
                    {n}
                  </div>
                </div>
                <Link
                  href={`/supplier/ordini?state=${col.states[0] ?? ""}`}
                  className="text-[12px] font-semibold text-[color:var(--color-brand-primary)]"
                >
                  Apri →
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop kanban with dnd (Fernly: lift + tilt overlay, tinted target
          column, smooth reflow of the remaining cards). */}
      <div className="mb-4 hidden items-center justify-between gap-3 lg:flex">
        <Chips
          ariaLabel="Filtra per consegna"
          value={dueFilter}
          onChange={setDueFilter}
          options={[
            { value: "all", label: "Tutti" },
            { value: "late", label: "In ritardo" },
            { value: "today", label: "Consegna oggi" },
            { value: "week", label: "Entro 7 giorni" },
          ]}
        />
        <span className="text-[12.5px] text-[var(--f-muted)] tabular-nums">
          {visibleCards.length} ordini mostrati
        </span>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCardId(null)}
      >
        <LayoutGroup>
          <div className="f-scroll hidden gap-4 overflow-x-auto pb-4 lg:flex">
            {COLUMNS.map((col, i) => {
              const isActiveTarget =
                activeCard !== null &&
                col.dropTarget !== null &&
                col.states.every((s) => s !== activeCard.workflow) &&
                isLegalDrop(activeCard.workflow, col.dropTarget);
              return (
                <DroppableColumn
                  key={col.id}
                  index={i}
                  column={col}
                  cards={cardsByColumn.get(col.id) ?? []}
                  isActiveTarget={isActiveTarget}
                  dragging={activeCard !== null}
                />
              );
            })}
          </div>
        </LayoutGroup>
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div
              className="w-[274px] cursor-grabbing"
              style={{
                transform: reduce ? undefined : "rotate(2.5deg) scale(1.03)",
                transition: "transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <CardBody card={activeCard} lifted />
            </div>
          ) : null}
        </DragOverlay>
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
