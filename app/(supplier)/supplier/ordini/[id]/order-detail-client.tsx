"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Edit3,
  X,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Inbox,
  PackageCheck,
  Ban,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from "@/lib/utils/formatters";
import {
  acceptOrderLines,
  markPacked,
  markShipped,
  type LineDecision,
} from "@/lib/orders/supplier-actions";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LineStatus = "pending" | "accepted" | "modified" | "rejected";

type LineRow = {
  id: string;
  productName: string;
  salesUnitLabel: string | null;
  salesUnitType: string | null;
  quantityRequested: number;
  quantityAccepted: number | null;
  unitPrice: number;
  status: string;
  rejectionReason: string | null;
  notes: string | null;
};

type EventRow = {
  id: string;
  eventType: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Decision = {
  action: "accept" | "modify" | "reject";
  quantityAccepted: number;
  rejectionReason: string;
  notes: string;
};

type Props = {
  splitId: string;
  restaurantName: string;
  orderCreatedAt: string | null;
  expectedDeliveryDate: string | null;
  subtotal: number;
  workflowState: string;
  rawStatus: string;
  lines: LineRow[];
  events: EventRow[];
};

// -----------------------------------------------------------------------------
// Labels / config
// -----------------------------------------------------------------------------

const WORKFLOW_LABELS: Record<string, string> = {
  submitted: "Ricevuto",
  confirmed: "Confermato",
  preparing: "In preparazione",
  packed: "Imballato",
  shipping: "In spedizione",
  delivered: "Consegnato",
  cancelled: "Annullato",
  rejected: "Rifiutato",
  pending_customer_confirmation: "Attesa conferma cliente",
  stock_conflict: "Conflitto stock",
};

const WORKFLOW_VARIANT: Record<string, "default" | "success" | "warning" | "info" | "outline"> = {
  submitted: "info",
  confirmed: "success",
  preparing: "info",
  packed: "info",
  shipping: "info",
  delivered: "success",
  cancelled: "warning",
  rejected: "warning",
  pending_customer_confirmation: "warning",
  stock_conflict: "warning",
};

const LINE_STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettata",
  modified: "Modificata",
  rejected: "Rifiutata",
};

const LINE_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "info" | "outline"> = {
  pending: "outline",
  accepted: "success",
  modified: "info",
  rejected: "warning",
};

const REJECTION_REASONS = [
  "Prodotto esaurito",
  "Fuori catalogo",
  "Quantita' non disponibile",
  "Prezzo non sostenibile",
  "Zona di consegna non coperta",
  "Altro",
];

const EVENT_LABELS: Record<string, string> = {
  received: "Ordine ricevuto",
  accepted: "Ordine accettato",
  partially_accepted: "Accettazione parziale",
  rejected: "Ordine rifiutato",
  stock_conflict: "Conflitto stock",
  preparing: "In preparazione",
  packed: "Imballato",
  shipped: "Spedito",
  delivered: "Consegnato",
  canceled: "Annullato",
};

function EventIcon({ type }: { type: string }) {
  const cls = "h-4 w-4";
  switch (type) {
    case "received":
      return <Inbox className={cls} />;
    case "accepted":
      return <CheckCircle2 className={cls} />;
    case "partially_accepted":
      return <Edit3 className={cls} />;
    case "rejected":
    case "canceled":
      return <XCircle className={cls} />;
    case "stock_conflict":
      return <AlertTriangle className={cls} />;
    case "preparing":
      return <Clock className={cls} />;
    case "packed":
      return <PackageCheck className={cls} />;
    case "shipped":
      return <Truck className={cls} />;
    case "delivered":
      return <Check className={cls} />;
    default:
      return <Clock className={cls} />;
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function OrderDetailClient({
  splitId,
  restaurantName,
  orderCreatedAt,
  expectedDeliveryDate,
  subtotal,
  workflowState,
  rawStatus,
  lines,
  events,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();

  // Decisioni per riga (solo per righe pending).
  const defaultDecision = (qty: number): Decision => ({
    action: "accept",
    quantityAccepted: qty,
    rejectionReason: REJECTION_REASONS[0] ?? "Altro",
    notes: "",
  });

  const initialDecisions = useMemo<Record<string, Decision>>(() => {
    const map: Record<string, Decision> = {};
    for (const l of lines) {
      map[l.id] = defaultDecision(l.quantityRequested);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const [decisions, setDecisions] = useState<Record<string, Decision>>(initialDecisions);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [rejectModalLineId, setRejectModalLineId] = useState<string | null>(null);

  // Mantieni sincronizzato quando le righe cambiano (es. realtime refresh).
  useEffect(() => {
    setDecisions((prev) => {
      const next: Record<string, Decision> = {};
      for (const l of lines) {
        const existing = prev[l.id];
        next[l.id] = existing ?? defaultDecision(l.quantityRequested);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const pendingLines = useMemo(() => lines.filter((l) => l.status === "pending"), [lines]);
  const hasPending = pendingLines.length > 0;

  // Keyboard shortcuts A/M/R sulla riga focalizzata.
  const updateDecision = useCallback(
    (lineId: string, patch: Partial<Decision>) => {
      setDecisions((prev) => {
        const current = prev[lineId] ?? defaultDecision(0);
        const merged: Decision = { ...current, ...patch };
        return { ...prev, [lineId]: merged };
      });
    },
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!focusedLineId) return;
      // Ignora quando siamo dentro input/textarea/select.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const line = lines.find((l) => l.id === focusedLineId);
      if (!line || line.status !== "pending") return;

      const k = e.key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        updateDecision(focusedLineId, {
          action: "accept",
          quantityAccepted: line.quantityRequested,
        });
      } else if (k === "m") {
        e.preventDefault();
        updateDecision(focusedLineId, { action: "modify" });
        // focus sull'input qty
        const el = document.getElementById(`qty-${focusedLineId}`) as HTMLInputElement | null;
        el?.focus();
        el?.select();
      } else if (k === "r") {
        e.preventDefault();
        updateDecision(focusedLineId, { action: "reject" });
        setRejectModalLineId(focusedLineId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedLineId, lines, updateDecision]);

  // Bulk actions.
  function bulkAccept() {
    setDecisions((prev) => {
      const next: Record<string, Decision> = { ...prev };
      for (const l of pendingLines) {
        const cur = next[l.id] ?? defaultDecision(l.quantityRequested);
        next[l.id] = {
          ...cur,
          action: "accept",
          quantityAccepted: l.quantityRequested,
        };
      }
      return next;
    });
    toast.success("Tutte le righe in attesa segnate come accettate");
  }

  function bulkReject() {
    setDecisions((prev) => {
      const next: Record<string, Decision> = { ...prev };
      for (const l of pendingLines) {
        const cur = next[l.id] ?? defaultDecision(l.quantityRequested);
        next[l.id] = { ...cur, action: "reject" };
      }
      return next;
    });
    toast.success("Tutte le righe in attesa segnate come rifiutate");
  }

  // Submit.
  function handleSubmit() {
    if (!hasPending) {
      toast.error("Nessuna riga in attesa");
      return;
    }
    // Valida motivi rifiuto.
    for (const l of pendingLines) {
      const d = decisions[l.id];
      if (!d) continue;
      if (d.action === "reject" && !d.rejectionReason.trim()) {
        toast.error(`Motivo rifiuto richiesto per ${l.productName}`);
        return;
      }
      if (d.action === "modify" && !(Number(d.quantityAccepted) > 0)) {
        toast.error(`Quantita' non valida per ${l.productName}`);
        return;
      }
    }

    const payload: LineDecision[] = pendingLines.map((l) => {
      const d = decisions[l.id] ?? defaultDecision(l.quantityRequested);
      if (d.action === "accept") {
        return { lineId: l.id, action: "accept" };
      }
      if (d.action === "modify") {
        return {
          lineId: l.id,
          action: "modify",
          quantityAccepted: d.quantityAccepted,
        };
      }
      return {
        lineId: l.id,
        action: "reject",
        rejectionReason: d.rejectionReason,
      };
    });

    startTransition(async () => {
      const res = await acceptOrderLines({ splitId, decisions: payload });
      if (res.ok) {
        toast.success(
          res.data.splitStatus === "confirmed"
            ? "Ordine confermato"
            : res.data.splitStatus === "rejected"
              ? "Ordine rifiutato"
              : res.data.splitStatus === "stock_conflict"
                ? "Conflitto stock rilevato"
                : "Risposta inviata, in attesa di conferma cliente",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleMarkPacked() {
    startActionTransition(async () => {
      const res = await markPacked(splitId);
      if (res.ok) {
        toast.success("Ordine segnato come imballato");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function handleMarkShipped() {
    startActionTransition(async () => {
      const res = await markShipped(splitId);
      if (res.ok) {
        toast.success("Ordine segnato come spedito");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------

  const canMarkPacked = workflowState === "confirmed" || workflowState === "preparing";
  const canMarkShipped = workflowState === "packed";

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        subscriptions={[
          { table: "order_split_items", filter: `order_split_id=eq.${splitId}` },
          { table: "order_split_events", filter: `order_split_id=eq.${splitId}` },
          { table: "order_splits", filter: `id=eq.${splitId}` },
          { table: "deliveries", filter: `order_split_id=eq.${splitId}` },
        ]}
      />

      {/* Back link */}
      <Link
        href="/supplier/ordini"
        className="inline-flex items-center gap-2 text-sm text-sage hover:text-charcoal transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna agli ordini
      </Link>

      {/* Header */}
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-sage">
              Ordine #{splitId.slice(0, 8)}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-charcoal">{restaurantName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-sage">
              {orderCreatedAt && (
                <span>
                  Ricevuto il <strong className="text-charcoal">{formatDate(orderCreatedAt)}</strong>
                </span>
              )}
              {expectedDeliveryDate && (
                <span>
                  Consegna prevista{" "}
                  <strong className="text-charcoal">{formatDate(expectedDeliveryDate)}</strong>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Badge variant={WORKFLOW_VARIANT[workflowState] ?? "default"}>
              {WORKFLOW_LABELS[workflowState] ?? workflowState}
            </Badge>
            <p className="text-2xl font-bold font-mono text-charcoal">
              {formatCurrency(subtotal)}
            </p>
            <div className="flex gap-2">
              {canMarkPacked && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleMarkPacked}
                  isLoading={isActionPending}
                >
                  <Package className="h-4 w-4" />
                  Segna impacchettato
                </Button>
              )}
              {canMarkShipped && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleMarkShipped}
                  isLoading={isActionPending}
                >
                  <Truck className="h-4 w-4" />
                  Segna spedito
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Righe */}
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-charcoal">Righe ordine</h2>
                <p className="text-xs text-sage">
                  Scorciatoie tastiera:{" "}
                  <kbd className="rounded bg-sage-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-charcoal">
                    A
                  </kbd>{" "}
                  accetta,{" "}
                  <kbd className="rounded bg-sage-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-charcoal">
                    M
                  </kbd>{" "}
                  modifica,{" "}
                  <kbd className="rounded bg-sage-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-charcoal">
                    R
                  </kbd>{" "}
                  rifiuta
                </p>
              </div>
              {hasPending && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={bulkAccept}>
                    <Check className="h-4 w-4" />
                    Accetta tutto
                  </Button>
                  <Button size="sm" variant="ghost" onClick={bulkReject}>
                    <Ban className="h-4 w-4" />
                    Rifiuta tutto
                  </Button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-sage-muted text-left text-xs uppercase tracking-wider text-sage">
                  <tr>
                    <th className="py-2 pr-3">Prodotto</th>
                    <th className="py-2 pr-3">Richiesta</th>
                    <th className="py-2 pr-3">Accettata</th>
                    <th className="py-2 pr-3">Prezzo</th>
                    <th className="py-2 pr-3">Subtotale</th>
                    <th className="py-2 pr-3">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const d = decisions[line.id];
                    const isPendingLine = line.status === "pending";
                    const isFocused = focusedLineId === line.id;
                    const action = d?.action ?? "accept";
                    const effectiveQty = !isPendingLine
                      ? line.quantityAccepted ?? 0
                      : action === "accept"
                        ? line.quantityRequested
                        : action === "reject"
                          ? 0
                          : d?.quantityAccepted ?? line.quantityRequested;
                    const subtotalLine = effectiveQty * line.unitPrice;
                    const displayStatus = isPendingLine
                      ? action === "accept"
                        ? "accepted"
                        : action === "modify"
                          ? "modified"
                          : "rejected"
                      : line.status;

                    return (
                      <tr
                        key={line.id}
                        tabIndex={isPendingLine ? 0 : -1}
                        onFocus={() => setFocusedLineId(line.id)}
                        onBlur={(e) => {
                          // Mantieni focus se ci spostiamo dentro la riga (es. input qty).
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            // no-op: lasciamo il valore per permettere shortcut dopo click
                          }
                        }}
                        className={`border-b border-sage-muted/50 outline-none transition-colors ${
                          isFocused && isPendingLine
                            ? "bg-forest-light/30 ring-2 ring-forest"
                            : "hover:bg-sage-muted/20"
                        }`}
                      >
                        <td className="py-3 pr-3 align-top">
                          <p className="font-semibold text-charcoal">{line.productName}</p>
                          {line.salesUnitLabel && (
                            <p className="text-xs text-sage">{line.salesUnitLabel}</p>
                          )}
                          {line.rejectionReason && !isPendingLine && (
                            <p className="mt-1 text-xs text-terracotta">
                              Motivo: {line.rejectionReason}
                            </p>
                          )}
                          {line.notes && (
                            <p className="mt-1 text-xs text-sage italic">Note: {line.notes}</p>
                          )}
                        </td>
                        <td className="py-3 pr-3 align-top font-mono text-charcoal">
                          {line.quantityRequested}
                        </td>
                        <td className="py-3 pr-3 align-top">
                          {isPendingLine ? (
                            <Input
                              id={`qty-${line.id}`}
                              type="number"
                              min={0}
                              step={0.01}
                              value={
                                action === "reject" ? 0 : d?.quantityAccepted ?? line.quantityRequested
                              }
                              disabled={action === "reject"}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                const newAction =
                                  v === line.quantityRequested ? "accept" : "modify";
                                updateDecision(line.id, {
                                  quantityAccepted: v,
                                  action: action === "reject" ? "reject" : newAction,
                                });
                              }}
                              className="w-24"
                            />
                          ) : (
                            <span className="font-mono text-charcoal">
                              {line.quantityAccepted ?? "-"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3 align-top font-mono text-charcoal">
                          {formatCurrency(line.unitPrice)}
                        </td>
                        <td className="py-3 pr-3 align-top font-mono font-semibold text-charcoal">
                          {formatCurrency(subtotalLine)}
                        </td>
                        <td className="py-3 pr-3 align-top">
                          {isPendingLine ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  title="Accetta (A)"
                                  onClick={() =>
                                    updateDecision(line.id, {
                                      action: "accept",
                                      quantityAccepted: line.quantityRequested,
                                    })
                                  }
                                  className={`rounded-md p-1.5 transition-colors ${
                                    action === "accept"
                                      ? "bg-forest text-white"
                                      : "bg-sage-muted/40 text-sage hover:bg-sage-muted"
                                  }`}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Modifica (M)"
                                  onClick={() => {
                                    updateDecision(line.id, { action: "modify" });
                                    const el = document.getElementById(
                                      `qty-${line.id}`,
                                    ) as HTMLInputElement | null;
                                    el?.focus();
                                    el?.select();
                                  }}
                                  className={`rounded-md p-1.5 transition-colors ${
                                    action === "modify"
                                      ? "bg-terracotta text-white"
                                      : "bg-sage-muted/40 text-sage hover:bg-sage-muted"
                                  }`}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Rifiuta (R)"
                                  onClick={() => {
                                    updateDecision(line.id, { action: "reject" });
                                    setRejectModalLineId(line.id);
                                  }}
                                  className={`rounded-md p-1.5 transition-colors ${
                                    action === "reject"
                                      ? "bg-red-600 text-white"
                                      : "bg-sage-muted/40 text-sage hover:bg-sage-muted"
                                  }`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <Badge variant={LINE_STATUS_VARIANT[displayStatus] ?? "default"}>
                                {LINE_STATUS_LABELS[displayStatus] ?? displayStatus}
                              </Badge>
                              {action === "reject" && d?.rejectionReason && (
                                <p className="text-[10px] text-sage">{d.rejectionReason}</p>
                              )}
                            </div>
                          ) : (
                            <Badge variant={LINE_STATUS_VARIANT[line.status] ?? "default"}>
                              {LINE_STATUS_LABELS[line.status] ?? line.status}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasPending && (
              <div className="mt-5 flex justify-end">
                <Button onClick={handleSubmit} isLoading={isPending}>
                  <Send className="h-4 w-4" />
                  Invia risposta ({pendingLines.length} righe)
                </Button>
              </div>
            )}

            {!hasPending && (
              <p className="mt-4 text-sm text-sage">
                Tutte le righe sono gia' state elaborate. Stato ordine:{" "}
                <strong className="text-charcoal">
                  {WORKFLOW_LABELS[workflowState] ?? workflowState}
                </strong>
                .
              </p>
            )}
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <h2 className="mb-4 text-lg font-bold text-charcoal">Timeline</h2>
          {events.length === 0 ? (
            <p className="text-sm text-sage">Nessun evento registrato.</p>
          ) : (
            <ol className="space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-forest-light text-forest-dark">
                    <EventIcon type={ev.eventType} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-charcoal">
                      {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                    </p>
                    <p
                      className="text-xs text-sage"
                      title={formatDateTime(ev.createdAt)}
                    >
                      {formatRelativeTime(ev.createdAt)}
                    </p>
                    {ev.note && (
                      <p className="mt-1 text-xs text-charcoal/80">{ev.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-[10px] uppercase tracking-wider text-sage/70">
            Status DB: {rawStatus}
          </p>
        </Card>
      </div>

      {/* Modal rifiuto */}
      <Modal
        isOpen={rejectModalLineId !== null}
        onClose={() => setRejectModalLineId(null)}
        title="Motivo rifiuto"
      >
        {rejectModalLineId && decisions[rejectModalLineId] && (
          <RejectForm
            decision={decisions[rejectModalLineId]}
            productName={
              lines.find((l) => l.id === rejectModalLineId)?.productName ?? ""
            }
            onChange={(patch) => updateDecision(rejectModalLineId, patch)}
            onConfirm={() => setRejectModalLineId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Reject form
// -----------------------------------------------------------------------------

function RejectForm({
  decision,
  productName,
  onChange,
  onConfirm,
}: {
  decision: Decision;
  productName: string;
  onChange: (patch: Partial<Decision>) => void;
  onConfirm: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // focus sul textarea all'apertura.
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-sage">
        Motivo rifiuto per <strong className="text-charcoal">{productName}</strong>.
      </p>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sage">
          Motivo
        </label>
        <select
          value={decision.rejectionReason}
          onChange={(e) => onChange({ rejectionReason: e.target.value })}
          className="w-full rounded-xl border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal focus:border-forest focus:outline-none"
        >
          {REJECTION_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-sage">
          Note aggiuntive (opzionale)
        </label>
        <textarea
          ref={textareaRef}
          value={decision.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal focus:border-forest focus:outline-none"
          placeholder="Dettagli per il ristorante..."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onConfirm}>
          Conferma motivo
        </Button>
      </div>
    </div>
  );
}
