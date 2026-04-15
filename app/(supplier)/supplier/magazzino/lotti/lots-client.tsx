"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ExpiryBadge } from "@/components/supplier/inventory/expiry-badge";
import type { LotWithProduct } from "@/lib/supplier/stock/queries";
import { getExpiryInfo } from "@/lib/supplier/stock/expiry-severity";

type Props = {
  lots: LotWithProduct[];
  products: { id: string; name: string }[];
  initialQ: string;
  initialExpiring: "all" | "expired" | "7" | "30";
  initialProductId: string;
};

const NUM_FMT = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});
const MONEY_FMT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});
const DATE_FMT = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function LotsClient({
  lots,
  products,
  initialQ,
  initialExpiring,
  initialProductId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [expiring, setExpiring] = useState<Props["initialExpiring"]>(initialExpiring);
  const [productId, setProductId] = useState(initialProductId);

  const updateQuery = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lots.filter((lot) => {
      if (needle) {
        const hay = `${lot.product_name} ${lot.lot_code}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const info = getExpiryInfo(lot.expiry_date);
      if (expiring === "expired" && info.severity !== "expired") return false;
      if (expiring === "7" && !(info.severity === "expired" || info.severity === "critical"))
        return false;
      if (
        expiring === "30" &&
        !(
          info.severity === "expired" ||
          info.severity === "critical" ||
          info.severity === "warning"
        )
      )
        return false;
      return true;
    });
  }, [lots, q, expiring]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-sage">
            Cerca
            <input
              type="search"
              value={q}
              placeholder="Prodotto o codice lotto…"
              onChange={(e) => {
                setQ(e.target.value);
                updateQuery({ q: e.target.value });
              }}
              className="rounded-md border border-smoke/40 bg-carbon px-3 py-1.5 text-sm text-charcoal focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-sage">
            Scadenza
            <select
              value={expiring}
              onChange={(e) => {
                const v = e.target.value as Props["initialExpiring"];
                setExpiring(v);
                updateQuery({ expiring: v === "all" ? "" : v });
              }}
              className="rounded-md border border-smoke/40 bg-carbon px-3 py-1.5 text-sm text-charcoal focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            >
              <option value="all">Tutti</option>
              <option value="expired">Solo scaduti</option>
              <option value="7">In scadenza ≤ 7 giorni</option>
              <option value="30">In scadenza ≤ 30 giorni</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-sage">
            Prodotto
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                updateQuery({ product: e.target.value });
              }}
              className="rounded-md border border-smoke/40 bg-carbon px-3 py-1.5 text-sm text-charcoal focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            >
              <option value="">Tutti</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto text-sm text-sage">
            <span className="font-semibold text-charcoal">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "lotto" : "lotti"}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sage">
            Nessun lotto corrisponde ai filtri selezionati.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface-hover text-left text-xs uppercase tracking-wide text-sage">
                <tr>
                  <th className="px-4 py-3 font-semibold">Prodotto</th>
                  <th className="px-4 py-3 font-semibold">Magazzino</th>
                  <th className="px-4 py-3 font-semibold">Lotto</th>
                  <th className="px-4 py-3 font-semibold">Scadenza</th>
                  <th className="px-4 py-3 font-semibold">Ricevuto</th>
                  <th className="px-4 py-3 text-right font-semibold">Giacenza</th>
                  <th className="px-4 py-3 text-right font-semibold">Riservata</th>
                  <th className="px-4 py-3 text-right font-semibold">Disponibile</th>
                  <th className="px-4 py-3 text-right font-semibold">Costo/base</th>
                  <th className="px-4 py-3 font-semibold" aria-label="Azioni" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot) => {
                  const info = getExpiryInfo(lot.expiry_date);
                  const qty = Number(lot.quantity_base);
                  const res = Number(lot.quantity_reserved_base);
                  const available = qty - res;
                  const rowCls =
                    info.severity === "expired"
                      ? "border-l-2 border-accent-red bg-accent-red/5 opacity-80"
                      : info.severity === "critical"
                        ? "border-l-2 border-accent-amber bg-accent-amber/5"
                        : "border-l-2 border-transparent";
                  return (
                    <tr
                      key={lot.id}
                      className={`border-t border-border-subtle transition-colors hover:bg-surface-hover ${rowCls}`}
                    >
                      <td className="px-4 py-3 font-medium text-charcoal">
                        {lot.product_name}
                      </td>
                      <td className="px-4 py-3 text-sage">{lot.warehouse_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-charcoal">
                        {lot.lot_code}
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryBadge expiryDate={lot.expiry_date} />
                      </td>
                      <td className="px-4 py-3 text-sage">
                        {DATE_FMT.format(new Date(lot.received_at))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-charcoal">
                        {NUM_FMT.format(qty)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sage">
                        {NUM_FMT.format(res)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-charcoal">
                        {NUM_FMT.format(available)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sage">
                        {lot.cost_per_base !== null
                          ? MONEY_FMT.format(Number(lot.cost_per_base))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/supplier/catalogo/${lot.product_id}`}
                          className="text-sm font-medium text-accent-green hover:text-accent-green/80"
                        >
                          Apri
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
