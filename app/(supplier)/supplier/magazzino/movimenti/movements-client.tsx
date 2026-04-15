"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import type { MovementRow } from "@/lib/supplier/stock/queries";
import type { StockMovementType } from "@/types/database";

type Option = { id: string; name: string };

type Filters = {
  warehouse: string;
  product: string;
  type: string;
  from: string;
  to: string;
  limit: number;
};

type Props = {
  movements: MovementRow[];
  warehouses: Option[];
  products: Option[];
  filters: Filters;
  defaultLimit: number;
  maxLimit: number;
};

const TYPE_META: Record<
  StockMovementType,
  { label: string; className: string }
> = {
  receive: {
    label: "Carico",
    className: "bg-accent-green/15 text-accent-green",
  },
  order_reserve: {
    label: "Prenotato",
    className: "bg-accent-blue/15 text-accent-blue",
  },
  order_unreserve: {
    label: "Sprenotato",
    className: "bg-surface-base text-text-secondary",
  },
  order_ship: {
    label: "Spedito",
    className: "bg-accent-purple/15 text-accent-purple",
  },
  adjust_in: {
    label: "Rettifica +",
    className: "bg-accent-green/10 text-accent-green",
  },
  adjust_out: {
    label: "Rettifica −",
    className: "bg-accent-amber/15 text-accent-amber",
  },
  return: {
    label: "Reso",
    className: "bg-accent-blue/10 text-accent-blue",
  },
  transfer: {
    label: "Trasferimento",
    className: "bg-surface-base text-text-secondary",
  },
};

const TYPE_OPTIONS: { value: StockMovementType | ""; label: string }[] = [
  { value: "", label: "Tutti i tipi" },
  { value: "receive", label: "Carico" },
  { value: "order_reserve", label: "Prenotato" },
  { value: "order_unreserve", label: "Sprenotato" },
  { value: "order_ship", label: "Spedito" },
  { value: "adjust_in", label: "Rettifica +" },
  { value: "adjust_out", label: "Rettifica −" },
  { value: "return", label: "Reso" },
  { value: "transfer", label: "Trasferimento" },
];

const dateTimeFmt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const qtyFmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 });

function formatQtySigned(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  const v = Number(n);
  const s = qtyFmt.format(Math.abs(v));
  if (v > 0) return `+${s}`;
  if (v < 0) return `−${s}`;
  return s;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return dateTimeFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function TypeBadge({ type }: { type: StockMovementType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function buildHref(
  pathname: string,
  next: Partial<Filters> & { warehouse?: string; product?: string; type?: string },
  current: Filters,
): string {
  const merged: Filters = { ...current, ...next };
  const sp = new URLSearchParams();
  if (merged.warehouse) sp.set("warehouse", merged.warehouse);
  if (merged.product) sp.set("product", merged.product);
  if (merged.type) sp.set("type", merged.type);
  if (merged.from) sp.set("from", merged.from);
  if (merged.to) sp.set("to", merged.to);
  if (merged.limit) sp.set("limit", String(merged.limit));
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function rowsToCsv(rows: MovementRow[]): string {
  const header = [
    "created_at",
    "movement_type",
    "product_name",
    "warehouse_name",
    "lot_code",
    "quantity_base",
    "created_by_name",
    "ref_order_split_id",
    "ref_delivery_item_id",
    "notes",
  ];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",;\n]/.test(s) ? `"${s}"` : s;
  };
  const body = rows.map((r) =>
    [
      r.created_at,
      r.movement_type,
      r.product_name,
      r.warehouse_name,
      r.lot_code ?? "",
      r.quantity_base,
      r.created_by_name ?? "",
      r.ref_order_split_id ?? "",
      r.ref_delivery_item_id ?? "",
      r.notes ?? "",
    ]
      .map(escape)
      .join(";"),
  );
  return [header.join(";"), ...body].join("\n");
}

export function MovementsClient({
  movements,
  warehouses,
  products,
  filters,
  defaultLimit,
  maxLimit,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  // Stato controllato locale (sincronizzato con server solo su submit).
  const [localType, setLocalType] = useState(filters.type);
  const [localWarehouse, setLocalWarehouse] = useState(filters.warehouse);
  const [localProduct, setLocalProduct] = useState(filters.product);
  const [localFrom, setLocalFrom] = useState(filters.from);
  const [localTo, setLocalTo] = useState(filters.to);

  const applyFilters = () => {
    startTransition(() => {
      router.replace(
        buildHref(
          pathname,
          {
            type: localType,
            warehouse: localWarehouse,
            product: localProduct,
            from: localFrom,
            to: localTo,
            limit: defaultLimit,
          },
          filters,
        ),
        { scroll: false },
      );
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  // Filtro client-side full-text su note / lot_code / prodotto.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter((r) => {
      const hay = [
        r.notes ?? "",
        r.lot_code ?? "",
        r.product_name ?? "",
        r.warehouse_name ?? "",
        r.created_by_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [movements, query]);

  const canLoadMore =
    movements.length >= filters.limit && filters.limit < maxLimit;
  const nextLimit = Math.min(filters.limit + 100, maxLimit);

  const exportCsv = () => {
    const csv = rowsToCsv(filtered);
    const blob = new Blob([`\ufeff${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `movimenti-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtri server-side */}
      <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-text-secondary">Tipo</span>
            <select
              value={localType}
              onChange={(e) => setLocalType(e.target.value)}
              className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value || "__all__"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {warehouses.length > 1 && (
            <label className="text-sm">
              <span className="mb-1 block text-xs text-text-secondary">
                Sede
              </span>
              <select
                value={localWarehouse}
                onChange={(e) => setLocalWarehouse(e.target.value)}
                className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
              >
                <option value="">Tutte le sedi</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-text-secondary">
              Prodotto
            </span>
            <select
              value={localProduct}
              onChange={(e) => setLocalProduct(e.target.value)}
              className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            >
              <option value="">Tutti i prodotti</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="relative flex w-full items-center md:max-w-xs">
            <Search
              className="absolute left-3 h-4 w-4 text-text-secondary"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca in note, lotto, prodotto…"
              className="w-full rounded-md border border-border-subtle bg-surface-base pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
              aria-label="Ricerca full-text"
            />
          </label>

          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover"
              title="Esporta CSV"
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Tabella movimenti */}
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-base/40 text-left text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold">Data/ora</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Prodotto</th>
                <th className="px-4 py-3 font-semibold">Sede</th>
                <th className="px-4 py-3 font-semibold">Lotto</th>
                <th className="px-4 py-3 font-semibold text-right">
                  Qty (base)
                </th>
                <th className="px-4 py-3 font-semibold">Operatore</th>
                <th className="px-4 py-3 font-semibold">Rif.</th>
                <th className="px-4 py-3 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-sm text-text-secondary"
                  >
                    Nessun movimento corrisponde ai filtri.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const qty = Number(r.quantity_base);
                  const qtyClass =
                    qty > 0
                      ? "text-accent-green"
                      : qty < 0
                        ? "text-accent-amber"
                        : "text-text-primary";
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-surface-hover/40 transition-colors"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-text-primary">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={r.movement_type} />
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {r.product_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.warehouse_name || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                        {r.lot_code ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-mono ${qtyClass}`}
                      >
                        {formatQtySigned(qty)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.created_by_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.ref_order_split_id ? (
                          <Link
                            href={`/supplier/ordini/${r.ref_order_split_id}`}
                            className="text-accent-blue hover:underline"
                          >
                            Ordine
                          </Link>
                        ) : r.ref_delivery_item_id ? (
                          <span
                            className="font-mono text-xs"
                            title={r.ref_delivery_item_id}
                          >
                            Consegna
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-text-secondary">
                        {r.notes ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginazione server-side */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>
          {filtered.length === movements.length
            ? `${movements.length} movimenti`
            : `${filtered.length} di ${movements.length} movimenti`}{" "}
          (limite corrente: {filters.limit})
        </span>
        {canLoadMore ? (
          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                router.replace(
                  buildHref(pathname, { limit: nextLimit }, filters),
                  { scroll: false },
                );
              })
            }
            disabled={pending}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-60"
          >
            Carica altri 100
          </button>
        ) : movements.length >= maxLimit ? (
          <span>Limite massimo raggiunto — affina i filtri.</span>
        ) : null}
      </div>
    </div>
  );
}
