// app/(app)/ordini/_components/order-peek.tsx
"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { OrderStatusPill } from "@/components/fernly/primitives";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
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
        <p className="text-[15px] font-medium text-[var(--f-ink)]">
          Nessun ordine selezionato
        </p>
        <p className="mt-1 text-[13px] text-[var(--f-muted)]">
          Seleziona una riga per vedere i dettagli
        </p>
      </div>
    );
  }

  const shortId = row.id.slice(0, 8).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p className="f-eyebrow">Ordine</p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[var(--f-ink)]">
            #{shortId}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--f-muted)]">
            {formatDateTime(row.createdAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="f-icon-btn !h-8 !w-8 !border-0 !bg-[var(--f-fill)]"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Meta grid */}
      <div className="mx-5 grid grid-cols-2 gap-3 rounded-[16px] bg-[var(--f-fill)] px-4 py-4">
        <MetaItem label="Stato">
          <OrderStatusPill status={row.status} />
        </MetaItem>
        <MetaItem label="Totale">
          <span className="text-[16px] font-semibold tabular-nums text-[var(--f-ink)]">
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
        <div className="px-5 py-4">
          <p className="f-eyebrow">Note</p>
          <pre className="mt-2 whitespace-pre-wrap break-words font-[inherit] text-[12.5px] leading-relaxed text-[var(--f-ink-2)]">
            {row.notes.length > 400
              ? `${row.notes.slice(0, 400)}…`
              : row.notes}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-5 py-5">
        <Link href={`/ordini/${row.id}`} className="f-btn f-btn-primary f-btn-block">
          Vai ai dettagli
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
      <p className="text-[11.5px] text-[var(--f-muted)]">
        {label}
      </p>
      <div className="mt-1 truncate">{children}</div>
    </div>
  );
}
