// app/(supplier)/supplier/ordini/_components/order-peek.tsx
//
// Right-pane split detail peek for the supplier command timeline.

"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { StatusDot } from "@/components/ui/status-dot";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { SupplierTimelineRow } from "../_lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SupplierOrderPeek({
  row,
  onClose,
}: {
  row: SupplierTimelineRow | null;
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

  const meta = getOrderStatusMeta(row.workflowState);
  const shortId = row.orderNumber ?? `#${row.splitId.slice(0, 8).toUpperCase()}`;

  return (
    <div className="flex h-full flex-col bg-surface-card">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            Ordine split
          </p>
          <h2 className="mt-1 font-mono text-[14px] text-text-primary">
            {shortId}
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
            <StatusDot tone={meta.tone} size={8} pulse={meta.pulse} />
            <span className="text-[13px] text-text-primary">{meta.label}</span>
          </span>
        </MetaItem>
        <MetaItem label="Subtotale">
          <span className="font-mono text-[14px] tabular-nums text-text-primary">
            {formatCurrency(Number(row.subtotal || 0))}
          </span>
        </MetaItem>
        <MetaItem label="Ristorante">
          <span className="truncate text-[13px] text-text-primary">
            {row.restaurantName}
          </span>
        </MetaItem>
        <MetaItem label="Zona">
          <span className="text-[13px] text-text-primary">
            {row.zoneName ?? "—"}
          </span>
        </MetaItem>
        <MetaItem label="Ricevuto">
          <span className="font-mono text-[12px] tabular-nums text-text-secondary">
            {formatDate(row.createdAt)}
          </span>
        </MetaItem>
        <MetaItem label="Consegna prevista">
          <span className="font-mono text-[12px] tabular-nums text-text-secondary">
            {formatDate(row.expectedDeliveryDate)}
          </span>
        </MetaItem>
      </div>

      {/* Actions */}
      <div className="mt-auto border-t border-border-subtle px-5 py-4">
        <Link
          href={`/supplier/ordini/${row.splitId}`}
          className="inline-flex w-full items-center justify-between gap-2 rounded-lg bg-accent-green px-4 py-2.5 font-medium text-charcoal transition-colors hover:bg-accent-green/90"
        >
          <span className="text-[13px]">Apri dettagli</span>
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
