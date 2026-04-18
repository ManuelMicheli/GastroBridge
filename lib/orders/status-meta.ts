// lib/orders/status-meta.ts
//
// Single source of truth for restaurant-area order status semantics.
// Consumed by <OrderStatusBadge>, <StatusDot> call sites, and the
// deprecated statusColorClass bridge in bucketize.ts.

import type { StatusTone } from "@/lib/ui/tones";

export type OrderStatusMeta = {
  label: string;
  tone: StatusTone;
  pulse?: boolean;
  terminal?: "ok" | "ko";
};

export const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  draft:                         { label: "Bozza",           tone: "neutral" },
  pending:                       { label: "In attesa",       tone: "amber" },
  submitted:                     { label: "Inviato",         tone: "amber" },
  pending_confirmation:          { label: "Attesa conferma", tone: "amber" },
  pending_customer_confirmation: { label: "Attesa cliente",  tone: "amber" },
  confirmed:                     { label: "Confermato",      tone: "blue" },
  preparing:                     { label: "In preparazione", tone: "brand" },
  packed:                        { label: "Imballato",       tone: "brand" },
  shipping:                      { label: "In spedizione",   tone: "brand", pulse: true },
  in_transit:                    { label: "In transito",     tone: "brand", pulse: true },
  shipped:                       { label: "Spedito",         tone: "brand", pulse: true },
  delivered:                     { label: "Consegnato",      tone: "emerald", terminal: "ok" },
  completed:                     { label: "Completato",      tone: "emerald", terminal: "ok" },
  cancelled:                     { label: "Annullato",       tone: "rose",    terminal: "ko" },
  rejected:                      { label: "Rifiutato",       tone: "rose",    terminal: "ko" },
  stock_conflict:                { label: "Conflitto stock", tone: "rose" },
};

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  return (
    ORDER_STATUS_META[status] ?? {
      label: capitalize(status),
      tone: "neutral",
    }
  );
}
