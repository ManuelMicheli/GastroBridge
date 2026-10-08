"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { Chips } from "@/components/fernly/chips";
import { CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { Sparkline } from "@/components/fernly/sparkline";
import type { PriceSeries } from "@/lib/invoices/price-history";
import { cn } from "@/lib/utils/formatters";

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 3 });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Rome" });
const d = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T12:00:00Z`)) : "—");
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1).replace(".", ",")}%`);

type Sort = "recent" | "up" | "down";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function PriceHistoryClient({ series, initialKey }: { series: PriceSeries[]; initialKey: string | null }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [selected, setSelected] = useState<string | null>(initialKey && series.some((s) => s.priceKey === initialKey) ? initialKey : null);

  const list = useMemo(() => {
    const needle = norm(q.trim());
    const filtered = series.filter((s) => !needle || norm(`${s.name} ${s.supplierName ?? ""}`).includes(needle));
    if (sort === "up") return [...filtered].filter((s) => (s.lastChangePct ?? 0) > 0).sort((a, b) => (b.lastChangePct ?? 0) - (a.lastChangePct ?? 0));
    if (sort === "down") return [...filtered].filter((s) => (s.lastChangePct ?? 0) < 0).sort((a, b) => (a.lastChangePct ?? 0) - (b.lastChangePct ?? 0));
    return filtered;
  }, [series, q, sort]);

  const current = series.find((s) => s.priceKey === selected) ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <FCard index={0} title="Prodotti acquistati" action={<span className="text-[12.5px] text-[var(--f-muted)]">{series.length}</span>}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Cerca prodotto</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--f-faint)]" aria-hidden />
            <input className="f-input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto o fornitore" />
          </label>
          <Chips
            size="sm"
            value={sort}
            onChange={setSort}
            ariaLabel="Ordina"
            options={[
              { value: "recent", label: "Recenti" },
              { value: "up", label: "Aumenti" },
              { value: "down", label: "Ribassi" },
            ]}
          />
        </div>
        {list.length === 0 ? (
          <CardEmpty>Nessun prodotto con questi filtri.</CardEmpty>
        ) : (
          <ul className="divide-y divide-[var(--f-line)]">
            {list.slice(0, 300).map((s) => {
              const up = (s.lastChangePct ?? 0) > 0.5;
              const down = (s.lastChangePct ?? 0) < -0.5;
              return (
                <li key={s.priceKey}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.priceKey)}
                    className={cn(
                      "-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition-colors hover:bg-[var(--f-fill)]",
                      selected === s.priceKey && "bg-[var(--acc-50)]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{s.name}</p>
                      <p className="truncate text-[12px] text-[var(--f-muted)]">
                        {s.supplierName ?? "—"} · {s.purchases} {s.purchases === 1 ? "acquisto" : "acquisti"} · ultimo {d(s.lastDate)}
                      </p>
                    </div>
                    <div className="hidden w-20 sm:block">{s.points.length > 1 && <Sparkline values={s.points.map((p) => p.price)} height={28} />}</div>
                    <div className="w-[104px] shrink-0 text-right">
                      <p className="text-[14px] font-semibold tabular-nums text-[var(--f-ink)]">
                        {eur.format(s.latest)}
                        <span className="text-[11.5px] font-normal text-[var(--f-muted)]">/{s.unitLabel}</span>
                      </p>
                      {s.lastChangePct !== null && (up || down) ? (
                        <p className={cn("inline-flex items-center gap-1 text-[12px] tabular-nums", up ? "text-[var(--f-danger)]" : "text-[var(--f-success)]")}>
                          {up ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
                          {pct(s.lastChangePct)}
                        </p>
                      ) : (
                        <p className="text-[12px] text-[var(--f-faint)]">stabile</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </FCard>

      <FCard index={1} title={current ? current.name : "Dettaglio prodotto"} className="xl:sticky xl:top-4 xl:self-start">
        {!current ? (
          <CardEmpty>Scegli un prodotto per vedere tutti i prezzi pagati.</CardEmpty>
        ) : (
          <div>
            <p className="text-[13px] text-[var(--f-muted)]">{current.supplierName ?? "—"}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { l: "Ultimo", v: current.latest },
                { l: "Minimo", v: current.min },
                { l: "Massimo", v: current.max },
              ].map((x) => (
                <div key={x.l} className="rounded-[12px] bg-[var(--f-fill)] px-2 py-2">
                  <p className="text-[11.5px] text-[var(--f-muted)]">{x.l}</p>
                  <p className="text-[14px] font-semibold tabular-nums">{eur.format(x.v)}</p>
                </div>
              ))}
            </div>
            {current.points.length > 1 && (
              <div className="mt-3">
                <Sparkline values={current.points.map((p) => p.price)} height={70} />
                <p className="mt-1 text-[12px] text-[var(--f-muted)]">
                  Nel periodo: <StatusPill tone={(current.periodChangePct ?? 0) > 0 ? "danger" : "success"}>{pct(current.periodChangePct)}</StatusPill>
                </p>
              </div>
            )}
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-[var(--f-muted)]">
                  <th className="py-1.5 font-medium">Data</th>
                  <th className="py-1.5 text-right font-medium">Q.tà</th>
                  <th className="py-1.5 text-right font-medium">€/{current.unitLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--f-line)]">
                {[...current.points].reverse().map((p, i) => (
                  <tr key={`${p.invoiceId}-${i}`}>
                    <td className="py-1.5">
                      <Link href={`/finanze/fatture/${p.invoiceId}`} className="text-[var(--acc-ink)] hover:underline">
                        {d(p.date)}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--f-muted)]">
                      {p.quantity !== null ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(p.quantity) : "—"}
                    </td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{eur.format(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FCard>
    </div>
  );
}
