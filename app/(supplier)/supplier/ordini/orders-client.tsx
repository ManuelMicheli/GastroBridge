"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, LayoutGrid, List } from "lucide-react";
import { CelebrationCheck, PulseDot } from "@/components/supplier/signature";

export type SupplierOrderRow = {
  splitId: string;
  orderId: string;
  orderNumber: string | null;
  restaurantName: string;
  zoneName: string | null;
  createdAt: string;
  expectedDeliveryDate: string | null;
  subtotal: number;
  workflowState: string;
  rawStatus: string;
};

type Filters = {
  state: string;
  restaurant: string;
  from: string;
  to: string;
};

type Props = {
  orders: SupplierOrderRow[];
  filters: Filters;
  total: number;
};

const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tutti gli stati" },
  { value: "submitted", label: "Nuovo" },
  { value: "pending_customer_confirmation", label: "Attesa cliente" },
  { value: "confirmed", label: "Confermato" },
  { value: "preparing", label: "In preparazione" },
  { value: "packed", label: "Imballato" },
  { value: "stock_conflict", label: "Conflitto stock" },
  { value: "shipping", label: "In spedizione" },
  { value: "delivered", label: "Consegnato" },
  { value: "rejected", label: "Rifiutato" },
  { value: "cancelled", label: "Annullato" },
];

const STATE_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Bozza", className: "bg-surface-base text-text-secondary" },
  submitted: { label: "Nuovo", className: "bg-accent-amber/15 text-accent-amber" },
  pending_customer_confirmation: {
    label: "Attesa cliente",
    className: "bg-accent-amber/15 text-accent-amber",
  },
  stock_conflict: {
    label: "Conflitto stock",
    className: "bg-accent-red/15 text-accent-red",
  },
  confirmed: {
    label: "Confermato",
    className: "bg-accent-green/15 text-accent-green",
  },
  preparing: {
    label: "In preparazione",
    className: "bg-accent-blue/15 text-accent-blue",
  },
  packed: {
    label: "Imballato",
    className: "bg-accent-blue/15 text-accent-blue",
  },
  shipping: {
    label: "In spedizione",
    className: "bg-accent-purple/15 text-accent-purple",
  },
  delivered: {
    label: "Consegnato",
    className: "bg-accent-green/15 text-accent-green",
  },
  rejected: { label: "Rifiutato", className: "bg-accent-red/15 text-accent-red" },
  cancelled: {
    label: "Annullato",
    className: "bg-accent-red/15 text-accent-red",
  },
};

const euroFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function StateBadge({ state }: { state: string }) {
  const meta = STATE_META[state] ?? {
    label: state,
    className: "bg-surface-base text-text-secondary",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {state === "delivered" && <CelebrationCheck size={18} />}
      {(state === "in_transit" || state === "shipping") && (
        <PulseDot variant="live" size={6} />
      )}
      {meta.label}
    </span>
  );
}

function buildHref(pathname: string, next: Partial<Filters>, current: Filters): string {
  const merged: Filters = { ...current, ...next };
  const sp = new URLSearchParams();
  if (merged.state) sp.set("state", merged.state);
  if (merged.restaurant) sp.set("restaurant", merged.restaurant);
  if (merged.from) sp.set("from", merged.from);
  if (merged.to) sp.set("to", merged.to);
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function SupplierOrdersClient({ orders, filters, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [localState, setLocalState] = useState(filters.state);
  const [localRestaurant, setLocalRestaurant] = useState(filters.restaurant);
  const [localFrom, setLocalFrom] = useState(filters.from);
  const [localTo, setLocalTo] = useState(filters.to);

  const applyFilters = () => {
    startTransition(() => {
      router.replace(
        buildHref(
          pathname,
          {
            state: localState,
            restaurant: localRestaurant,
            from: localFrom,
            to: localTo,
          },
          filters,
        ),
        { scroll: false },
      );
    });
  };

  const resetFilters = () => {
    setLocalState("");
    setLocalRestaurant("");
    setLocalFrom("");
    setLocalTo("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const shown = useMemo(() => orders, [orders]);

  return (
    <div className="space-y-4">
      {/* Toggle vista + titolo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border-subtle bg-surface-card p-0.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-sm bg-accent-green px-3 py-1.5 text-xs font-medium text-charcoal"
            aria-pressed="true"
          >
            <List className="h-3.5 w-3.5" aria-hidden />
            Tabella
          </button>
          <Link
            href="/supplier/ordini/kanban"
            className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            Kanban
          </Link>
        </div>
        <span className="text-xs text-text-secondary">
          {total} {total === 1 ? "ordine" : "ordini"}
        </span>
      </div>

      {/* Filtri */}
      <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-text-secondary">Stato</span>
            <select
              value={localState}
              onChange={(e) => setLocalState(e.target.value)}
              className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            >
              {STATE_OPTIONS.map((o) => (
                <option key={o.value || "__all__"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-text-secondary">
              Ristorante
            </span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
                aria-hidden
              />
              <input
                type="search"
                value={localRestaurant}
                onChange={(e) => setLocalRestaurant(e.target.value)}
                placeholder="Cerca per nome…"
                className="w-full rounded-md border border-border-subtle bg-surface-base pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
              />
            </div>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-text-secondary">Dal</span>
            <input
              type="date"
              value={localFrom}
              onChange={(e) => setLocalFrom(e.target.value)}
              className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-text-secondary">Al</span>
            <input
              type="date"
              value={localTo}
              onChange={(e) => setLocalTo(e.target.value)}
              className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetFilters}
            disabled={pending}
            className="rounded-md border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-60"
          >
            Azzera
          </button>
          <button
            type="button"
            onClick={applyFilters}
            disabled={pending}
            className="rounded-md bg-accent-green px-3 py-2 text-sm font-medium text-charcoal hover:bg-accent-green/90 disabled:opacity-60"
          >
            Applica filtri
          </button>
        </div>
      </div>

      {/* Tabella ordini */}
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-base/40 text-left text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Ristorante</th>
                <th className="px-4 py-3 font-semibold">Ricevuto</th>
                <th className="px-4 py-3 font-semibold">Zona</th>
                <th className="px-4 py-3 font-semibold">Consegna prevista</th>
                <th className="px-4 py-3 font-semibold text-right">Totale</th>
                <th className="px-4 py-3 font-semibold">Stato</th>
                <th className="px-4 py-3 font-semibold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {shown.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-text-secondary"
                  >
                    Nessun ordine corrisponde ai filtri.
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <tr
                    key={r.splitId}
                    className="hover:bg-surface-hover/40 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-primary">
                      {r.orderNumber ?? `#${r.splitId.slice(0, 8)}`}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {r.restaurantName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.zoneName ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatDate(r.expectedDeliveryDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-text-primary">
                      {euroFmt.format(Number(r.subtotal || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={r.workflowState} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/supplier/ordini/${r.splitId}`}
                        className="text-accent-blue hover:underline text-xs"
                      >
                        Apri
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
