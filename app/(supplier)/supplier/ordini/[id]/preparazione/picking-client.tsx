"use client";

/**
 * Task 12 — Picking list magazziniere (client component).
 *
 * Per ogni riga mostra: prodotto, qty da prelevare, lotto proposto FEFO +
 * scadenza color-coded, dropdown alternative, bottone "Prelevato".
 * Al completamento → "Pronto per spedizione" chiama `markPacked`.
 *
 * Stile: dark-tokens (charcoal/forest/sage) + print-friendly (@media print).
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Printer,
  Package,
  AlertTriangle,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { cn } from "@/lib/utils/formatters";
import { getExpiryInfo, getExpiryLabel } from "@/lib/supplier/stock/expiry-severity";
import { pickItem, markPacked } from "@/lib/orders/supplier-actions";
import type {
  PickingInitialData,
  PickingLineView,
  PickingProposal,
} from "./picking-types";

type Props = { initial: PickingInitialData };

export function PickingClient({ initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyLineId, setBusyLineId] = useState<string | null>(null);

  const allPicked = useMemo(
    () =>
      initial.lines.length > 0 &&
      initial.lines.every((l) => l.remaining === 0),
    [initial.lines],
  );

  const onPrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const onComplete = () => {
    if (!allPicked) {
      toast.error("Completa tutte le righe prima di imballare");
      return;
    }
    startTransition(async () => {
      const res = await markPacked(initial.splitId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ordine imballato e pronto per spedizione");
      router.push(`/supplier/ordini/${initial.splitId}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <RealtimeRefresh
        subscriptions={[
          { table: "order_split_items", filter: `order_split_id=eq.${initial.splitId}` },
          { table: "order_split_events", filter: `order_split_id=eq.${initial.splitId}` },
          { table: "order_splits", filter: `id=eq.${initial.splitId}` },
          { table: "deliveries", filter: `order_split_id=eq.${initial.splitId}` },
        ]}
      />
      {/* Toolbar — hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/supplier/ordini/${initial.splitId}`}
          className="inline-flex items-center gap-2 text-sage hover:text-charcoal transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Torna al dettaglio</span>
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onPrint}>
            <Printer className="h-4 w-4" />
            Stampa lista
          </Button>
        </div>
      </div>

      {/* Header picking */}
      <Card className="print:shadow-none print:p-4 print:border print:border-charcoal/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-charcoal print:text-xl">
              Picking list
            </h1>
            <p className="text-sm text-sage mt-1">
              Ordine #{initial.orderShortId} — {initial.restaurantName}
            </p>
            {initial.expectedDeliveryDate && (
              <p className="text-sm text-charcoal mt-1">
                <span className="text-sage">Consegna prevista:</span>{" "}
                <span className="font-semibold">
                  {formatDateIt(initial.expectedDeliveryDate)}
                </span>
              </p>
            )}
          </div>
          <Badge variant={allPicked ? "success" : "info"}>
            {allPicked
              ? "Completato"
              : `${initial.lines.filter((l) => l.remaining === 0).length}/${initial.lines.length} righe`}
          </Badge>
        </div>
      </Card>

      {/* Rows */}
      <div className="space-y-3 print:space-y-2">
        {initial.lines.map((line) => (
          <PickingRow
            key={line.splitItemId}
            line={line}
            disabled={isPending || busyLineId === line.splitItemId}
            onPickStart={() => setBusyLineId(line.splitItemId)}
            onPickEnd={() => setBusyLineId(null)}
          />
        ))}
        {initial.lines.length === 0 && (
          <Card className="text-center py-12">
            <p className="text-sage">
              Nessuna riga accettata da preparare per questo ordine.
            </p>
          </Card>
        )}
      </div>

      {/* Footer action — hidden in print */}
      <div className="flex justify-end print:hidden">
        <Button
          variant="primary"
          size="lg"
          onClick={onComplete}
          disabled={!allPicked || isPending}
          isLoading={isPending}
        >
          <Package className="h-4 w-4" />
          Pronto per spedizione
        </Button>
      </div>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          body {
            background: #fff !important;
          }
          /* Hide app chrome (sidebars, headers) */
          aside,
          nav,
          header[data-app-header] {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------

function PickingRow({
  line,
  disabled,
  onPickStart,
  onPickEnd,
}: {
  line: PickingLineView;
  disabled: boolean;
  onPickStart: () => void;
  onPickEnd: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Selezione manuale lotto per il prossimo prelievo (override della proposta).
  const [selectedLotId, setSelectedLotId] = useState<string | null>(
    line.proposals[0]?.lotId ?? null,
  );
  const [customQty, setCustomQty] = useState<string>(
    String(
      line.proposals[0]?.quantityBase ?? line.remaining,
    ),
  );

  const handlePick = (
    lotId: string,
    quantityBase: number,
  ) => {
    if (!lotId) {
      toast.error("Seleziona un lotto");
      return;
    }
    if (!(quantityBase > 0)) {
      toast.error("Quantita' non valida");
      return;
    }
    onPickStart();
    startTransition(async () => {
      const res = await pickItem({
        splitItemId: line.splitItemId,
        lotId,
        quantityBase,
      });
      onPickEnd();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prelievo confermato");
      router.refresh();
    });
  };

  const handleConfirmProposal = (proposal: PickingProposal) => {
    handlePick(proposal.lotId, proposal.quantityBase);
  };

  const handleCustomPick = () => {
    const qty = Number(customQty);
    if (!selectedLotId) return;
    handlePick(selectedLotId, qty);
  };

  return (
    <Card
      className={cn(
        "print:shadow-none print:p-3 print:break-inside-avoid print:border print:border-charcoal/20",
        line.remaining === 0 && "bg-sage-muted/20",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {/* Prodotto */}
        <div className="md:w-1/3">
          <div className="flex items-start gap-2">
            {line.remaining === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-forest shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-sage shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold text-charcoal">{line.productName}</p>
              <p className="text-sm text-sage">
                Da prelevare:{" "}
                <span className="font-mono font-semibold text-charcoal">
                  {formatNum(line.remaining)}
                </span>{" "}
                / {formatNum(line.quantityAccepted)} uds base
              </p>
              {line.quantityPicked > 0 && (
                <p className="text-xs text-sage mt-0.5">
                  Gia' prelevato: {formatNum(line.quantityPicked)}
                </p>
              )}
              {line.proposalShortage > 0 && (
                <p className="text-xs text-red-600 mt-1 inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Shortage: {formatNum(line.proposalShortage)} uds non allocate
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Proposte FEFO + alternative */}
        <div className="flex-1 space-y-3">
          {line.remaining === 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-sage mb-1">
                Lotti prelevati
              </p>
              <ul className="space-y-1">
                {line.pickedLots.map((pl, idx) => (
                  <li
                    key={`${pl.lotId}-${idx}`}
                    className="text-sm flex items-center gap-2"
                  >
                    <Badge variant="success">{pl.lotCode}</Badge>
                    <ExpiryPill date={pl.expiryDate} />
                    <span className="font-mono text-charcoal">
                      {formatNum(pl.quantityBase)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {/* Proposta FEFO */}
              <div>
                <p className="text-xs uppercase tracking-wide text-sage mb-1">
                  Lotto proposto (FEFO)
                </p>
                <div className="space-y-2">
                  {line.proposals.length === 0 && (
                    <p className="text-sm text-red-600">
                      Nessun lotto prenotato disponibile
                    </p>
                  )}
                  {line.proposals.map((p, idx) => (
                    <div
                      key={`${p.lotId}-${idx}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Badge variant="info">{p.lotCode}</Badge>
                      <ExpiryPill date={p.expiryDate} />
                      <span className="font-mono text-sm text-charcoal">
                        {formatNum(p.quantityBase)} uds
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={disabled}
                        onClick={() => handleConfirmProposal(p)}
                        className="ml-auto print:hidden"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Prelevato
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alternative (dropdown + qty) */}
              {line.options.length > 1 && (
                <details className="print:hidden group">
                  <summary className="text-sm text-forest font-semibold cursor-pointer hover:underline">
                    Cambia lotto
                  </summary>
                  <div className="mt-2 flex flex-wrap items-end gap-2 p-3 rounded-lg bg-sage-muted/20">
                    <label className="flex flex-col text-xs text-sage">
                      Lotto
                      <select
                        className="mt-1 rounded-lg border border-charcoal/20 bg-white px-2 py-1.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-forest"
                        value={selectedLotId ?? ""}
                        onChange={(e) => setSelectedLotId(e.target.value)}
                        disabled={disabled}
                      >
                        {line.options.map((o) => (
                          <option key={o.lotId} value={o.lotId}>
                            {o.lotCode} —{" "}
                            {o.expiryDate ? formatDateIt(o.expiryDate) : "no exp"}{" "}
                            — disp. {formatNum(o.quantityBase)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col text-xs text-sage">
                      Quantita' base
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                        className="mt-1 w-32"
                        disabled={disabled}
                      />
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={disabled}
                      onClick={handleCustomPick}
                    >
                      Conferma prelievo
                    </Button>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

function formatDateIt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function ExpiryPill({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-sage">—</span>;
  const info = getExpiryInfo(date);
  const palette: Record<typeof info.severity, string> = {
    expired: "bg-red-100 text-red-800 border-red-300",
    critical: "bg-amber-100 text-amber-800 border-amber-300",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
    ok: "bg-emerald-100 text-emerald-800 border-emerald-300",
    none: "bg-sage-muted/30 text-sage border-sage/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        palette[info.severity],
      )}
    >
      {formatDateIt(date)} · {getExpiryLabel(info)}
    </span>
  );
}
