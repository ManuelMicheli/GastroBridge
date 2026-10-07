// app/(supplier)/supplier/analytics/analytics-client.tsx
//
// Supplier analytics — same Fernly layout as the restaurant analytics:
//   range pills + Export CSV · 4 KPI cards with sparklines and deltas ·
//   revenue vs previous period area chart · top clients · top products.

"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar, CardEmpty, FCard } from "@/components/fernly/primitives";
import { PeriodSelector } from "@/components/analytics/period-selector";
import { ExportCsvButton } from "@/components/analytics/export-csv-button";
import { KpiSpark } from "@/components/analytics/kpi-spark";
import { exportSupplierAnalyticsCsv } from "@/lib/supplier/analytics/export-csv";
import { formatCurrency } from "@/lib/utils/formatters";
import type { SupplierAnalytics } from "@/lib/supplier/analytics/queries";

// recharts only ships when the chart mounts — height-matched skeleton, no CLS.
const ThroughputChart = dynamic(
  () => import("@/components/analytics/throughput-chart").then((m) => m.ThroughputChart),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-[16px] bg-[var(--f-fill)]" /> },
);

const qtyFmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions);

function Bar({ pct, i }: { pct: number; i: number }) {
  return (
    <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[var(--f-fill-2)]">
      <div
        className="f-grow-x h-full rounded-full bg-[var(--acc-600)]"
        style={{ width: `${pct}%`, ["--i" as string]: i, ["--d" as string]: "300ms" }}
      />
    </div>
  );
}

export function SupplierAnalyticsContent({ data }: { data: SupplierAnalytics }) {
  const prevLabel = "periodo prec.";
  const hasAnyRevenue = data.orders > 0 || data.previousOrders > 0;
  const maxClient = data.topClients.reduce((m, c) => Math.max(m, c.revenue), 0) || 1;
  const maxProduct = data.topProducts.reduce((m, p) => Math.max(m, p.revenue), 0) || 1;

  const sparks = useMemo(
    () => ({
      revenue: data.daily.map((d) => d.spend),
      orders: data.daily.map((d) => d.orders),
      ticket: data.daily.map((d) => (d.orders > 0 ? d.spend / d.orders : 0)),
      clients: data.daily.map((d) => d.clients),
    }),
    [data.daily],
  );

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Analytics"
        subtitle={`Fatturato, ordini e clienti — ${data.period.label.toLowerCase()} rispetto al periodo precedente.`}
        actions={
          <>
            <PeriodSelector current={data.period.key} />
            <ExportCsvButton period={data.period.key} exportCsv={exportSupplierAnalyticsCsv} />
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        <KpiSpark
          index={0}
          title="Fatturato"
          value={data.revenue}
          format="currency0"
          previous={data.previousRevenue}
          spark={sparks.revenue}
          periodLabel={prevLabel}
        />
        <KpiSpark
          index={1}
          title="Ordini"
          value={data.orders}
          format="number"
          previous={data.previousOrders}
          spark={sparks.orders}
          periodLabel={prevLabel}
        />
        <KpiSpark
          index={2}
          title="Ticket medio"
          value={data.avgTicket}
          format="currency0"
          previous={data.previousAvgTicket}
          spark={sparks.ticket}
          periodLabel={prevLabel}
        />
        <KpiSpark
          index={3}
          title="Clienti attivi"
          value={data.activeClients}
          format="number"
          previous={data.previousActiveClients}
          spark={sparks.clients}
          periodLabel={prevLabel}
        />
      </div>

      {/* Revenue chart + top clients */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-3">
        <FCard
          index={4}
          className="xl:col-span-2"
          title={
            <span className="flex flex-col">
              <span>Andamento fatturato</span>
              <span className="mt-0.5 text-[12.5px] font-normal text-[var(--f-muted)]">
                Fatturato giornaliero, media 7 giorni nel tooltip, contro il periodo precedente
              </span>
            </span>
          }
          action={
            <span className="hidden items-center gap-4 text-[12.5px] text-[var(--f-muted)] sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-[3px] w-4 rounded-full bg-[var(--acc-600)]" /> Questo periodo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t-2 border-dashed border-[var(--f-faint)]" /> Precedente
              </span>
            </span>
          }
        >
          {hasAnyRevenue ? (
            <ThroughputChart data={data.daily} emptyLabel="Nessun ordine nel periodo" />
          ) : (
            <div className="h-[280px]">
              <CardEmpty>
                Nessun ordine confermato nel periodo.
                <br />
                Il grafico si popola man mano che i clienti ordinano.
              </CardEmpty>
            </div>
          )}
        </FCard>

        <FCard
          index={5}
          title="Clienti principali"
          action={
            <span className="text-[12.5px] text-[var(--f-muted)] tabular-nums">
              {data.activeClients} attiv{data.activeClients === 1 ? "o" : "i"}
            </span>
          }
        >
          {data.topClients.length === 0 ? (
            <CardEmpty>Nessun cliente ha ordinato nel periodo</CardEmpty>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.topClients.map((c, i) => (
                <li key={c.restaurant_id} className="flex items-center gap-3">
                  <Avatar name={c.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13.5px] font-medium text-[var(--f-ink)]">{c.name}</span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--f-ink)]">
                        {formatCurrency(c.revenue)}
                      </span>
                    </div>
                    <Bar pct={(c.revenue / maxClient) * 100} i={i} />
                    <p className="mt-1 text-[11.5px] text-[var(--f-muted)] tabular-nums">
                      {c.orders} ordin{c.orders === 1 ? "e" : "i"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FCard>
      </div>

      {/* Top products */}
      <FCard
        index={6}
        className="mt-3 lg:mt-4"
        title="Prodotti più venduti"
        action={<span className="text-[12.5px] text-[var(--f-muted)]">per fatturato</span>}
      >
        {data.topProducts.length === 0 ? (
          <CardEmpty>Nessun prodotto venduto nel periodo</CardEmpty>
        ) : (
          <ol className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            {data.topProducts.map((p, i) => (
              <li key={p.product_id} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--f-muted)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-medium text-[var(--f-ink)]">{p.name}</span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--f-ink)]">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                  <Bar pct={(p.revenue / maxProduct) * 100} i={i} />
                  <p className="mt-1 text-[11.5px] text-[var(--f-muted)] tabular-nums">
                    {qtyFmt.format(p.quantity)} unità
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </FCard>
    </div>
  );
}
