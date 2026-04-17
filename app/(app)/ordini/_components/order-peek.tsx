// app/(app)/ordini/_components/order-peek.tsx
"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { statusColorClass } from "../_lib/bucketize";
import type { OrderFeedRow } from "../_lib/types";

export function OrderPeek({
  row,
  onClose,
}: {
  row: OrderFeedRow | null;
  onClose: () => void;
}) {
  if (!row) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          Nessun ordine selezionato
        </p>
        <p className="mt-2 text-[13px] text-text-secondary">
          Seleziona una riga per vedere i dettagli
        </p>
      </div>
    );
  }

  const statusLabel = ORDER_STATUS_LABELS[row.status] ?? row.status;
  const shortId = row.id.slice(0, 8).toUpperCase();

  return (
    <div className="flex h-full flex-col bg-surface-card">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Ordine
          </p>
          <h2 className="mt-1 font-mono text-[14px] text-text-primary">
            #{shortId}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-tertiary">
            {formatDateTime(row.createdAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 border-b border-border-subtle px-5 py-4">
        <MetaItem label="Stato">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${statusColorClass(row.status)}`}
              aria-hidden
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-primary">
              {statusLabel}
            </span>
          </span>
        </MetaItem>
        <MetaItem label="Totale">
          <span className="font-mono text-[14px] tabular-nums text-text-primary">
            {formatCurrency(row.total)}
          </span>
        </MetaItem>
        <MetaItem label="Fornitore">
          <span className="text-[13px] text-text-primary">
            {row.supplierName ?? "—"}
            {row.supplierCount > 1 && (
              <span className="ml-1 font-mono text-[10px] text-text-tertiary">
                +{row.supplierCount - 1} altri
              </span>
            )}
          </span>
        </MetaItem>
        <MetaItem label="Split">
          <span className="font-mono text-[12px] tabular-nums text-text-primary">
            {row.supplierCount || 1}
          </span>
        </MetaItem>
      </div>

      {/* Notes */}
      {row.notes && (
        <div className="border-b border-border-subtle px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Note
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-text-secondary">
            {row.notes.length > 400
              ? `${row.notes.slice(0, 400)}…`
              : row.notes}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto border-t border-border-subtle px-5 py-4">
        <Link
          href={`/ordini/${row.id}`}
          className="inline-flex w-full items-center justify-between gap-2 rounded-lg bg-accent-green px-4 py-2.5 font-medium text-brand-on-primary transition-colors hover:bg-accent-green/90"
        >
          <span className="text-[13px]">Vai ai dettagli</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </p>
      <div className="mt-1 truncate">{children}</div>
    </div>
  );
}
