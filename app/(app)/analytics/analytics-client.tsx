// app/(app)/analytics/analytics-client.tsx
//
// Restaurant analytics — Fernly layout (spec §4 Analytics):
//   range pills + Export CSV · 4 KPI cards with sparklines and deltas ·
//   spend vs previous period area chart · spend by category donut ·
//   20-week order activity heatmap · top suppliers · then the existing
//   budget, variance, product, weekday and recent-orders blocks.

"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CountUp, type CountFormat } from "@/components/fernly/count-up";
import { Sparkline } from "@/components/fernly/sparkline";
import { Avatar, FCard, riseStyle } from "@/components/fernly/primitives";
import { SectionFrame } from "@/components/fernly/section-frame";
import { formatCurrency } from "@/lib/utils/formatters";
import type { RestaurantAnalytics } from "@/lib/analytics/restaurant";
import { PeriodSelector } from "./_components/period-selector";
import { BudgetTracker } from "./_components/budget-tracker";
import { VarianceCard } from "./_components/variance-card";
import { ProductInsightsTable } from "./_components/product-insights-table";
import { WeekdayHeatmap } from "./_components/weekday-heatmap";
import { ExportCsvButton } from "./_components/export-csv-button";
import { AnalyticsRecentOrdersLog } from "./_components/recent-orders-log";
import { ActivityHeatmap } from "./_components/activity-heatmap";

// recharts (~300KB+) only ships when these charts mount — kept out of the
// route's initial JS. Height-matched skeletons avoid CLS.
const CategoryDonut = dynamic(
  () => import("./_components/category-donut").then((m) => m.CategoryDonut),
  { ssr: false, loading: () => <div className="h-[340px] animate-pulse rounded-[16px] bg-[var(--f-fill)]" /> },
);
const YoyTrendChart = dynamic(
  () => import("./_components/yoy-trend-chart").then((m) => m.YoyTrendChart),
  { ssr: false, loading: () => <div className="h-[17rem] animate-pulse rounded-[16px] bg-[var(--f-fill)]" /> },
);
const ThroughputChart = dynamic(
  () => import("./_components/throughput-chart").then((m) => m.ThroughputChart),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-[16px] bg-[var(--f-fill)]" /> },
);

type Props = {
  data: RestaurantAnalytics;
};

function delta(current: number, previous: number): { pct: number | null; up: boolean } {
  if (previous === 0) return { pct: current === 0 ? 0 : null, up: current >= 0 };
  const d = ((current - previous) / previous) * 100;
  return { pct: d, up: d >= 0 };
}

function KpiSpark({
  title,
  value,
  format,
  previous,
  spark,
  periodLabel,
  index,
  lowerIsBetter = false,
}: {
  title: string;
  value: number;
  format: CountFormat;
  previous: number;
  spark: number[];
  periodLabel: string;
  index: number;
  lowerIsBetter?: boolean;
}) {
  const d = delta(value, previous);
  const good = d.pct === null || d.pct === 0 ? null : lowerIsBetter ? !d.up : d.up;
  return (
    <section className="f-card f-rise flex min-w-0 flex-col overflow-hidden" style={riseStyle(index)} aria-label={title}>
      <div className="px-5 pt-[18px]">
        <h3 className="text-[14px] font-medium text-[var(--f-ink-2)]">{title}</h3>
        <div className="mt-2 text-[34px] font-medium leading-none tracking-[-0.035em] text-[var(--f-ink)] tabular-nums">
          <CountUp value={value} format={format} />
        </div>
        <p className="mt-2 flex items-center gap-1 text-[12px] text-[var(--f-muted)]">
          {d.pct === null ? (
            <span>nuovo rispetto al periodo precedente</span>
          ) : (
            <>
              <span
                className="inline-flex items-center gap-0.5 font-semibold tabular-nums"
                style={{ color: good === null ? "var(--f-muted)" : good ? "var(--f-success)" : "var(--f-danger)" }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={d.up ? "" : "rotate-180"}>
                  <path d="M4 1.5 7 6H1z" fill="currentColor" />
                </svg>
                {Math.abs(d.pct).toFixed(1).replace(".", ",")}%
              </span>
              <span>vs {periodLabel}</span>
            </>
          )}
        </p>
      </div>
      <div className="mt-3">
        <Sparkline values={spark} height={44} />
      </div>
    </section>
  );
}

export function AnalyticsContent({ data }: Props) {
  const maxSupplier = data.supplierBreakdown.reduce((m, s) => Math.max(m, s.spending), 0) || 1;
  const prevLabel = "periodo prec.";

  const sparks = useMemo(() => {
    const daily = data.daily;
    return {
      spend: daily.map((d) => d.spend),
      orders: daily.map((d) => d.orders),
      ticket: daily.map((d) => (d.orders > 0 ? d.spend / d.orders : 0)),
      suppliers: daily.map((d) => d.suppliers),
    };
  }, [data.daily]);

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Analytics"
        subtitle={`Dove va la spesa della cucina — ${data.period.label.toLowerCase()} rispetto al periodo precedente.`}
        actions={
          <>
            <PeriodSelector current={data.period.key} />
            <ExportCsvButton period={data.period.key} />
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        <KpiSpark
          index={0}
          title="Spesa nel periodo"
          value={data.currentSpending}
          format="currency0"
          previous={data.previousSpending}
          spark={sparks.spend}
          periodLabel={prevLabel}
          lowerIsBetter
        />
        <KpiSpark
          index={1}
          title="Ordini"
          value={data.currentOrderCount}
          format="number"
          previous={data.previousOrderCount}
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
          lowerIsBetter
        />
        <KpiSpark
          index={3}
          title="Fornitori attivi"
          value={data.supplierBreakdown.length}
          format="number"
          previous={data.previousSupplierCount}
          spark={sparks.suppliers}
          periodLabel={prevLabel}
        />
      </div>

      {/* Chart + donut */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-3">
        <FCard
          index={4}
          className="xl:col-span-2"
          title={
            <span className="flex flex-col">
              <span>Andamento spesa</span>
              <span className="mt-0.5 text-[12.5px] font-normal text-[var(--f-muted)]">
                Spesa giornaliera, media 7 giorni nel tooltip, contro il periodo precedente
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
          <ThroughputChart data={data.daily} />
        </FCard>
        <FCard index={5} title="Spesa per categoria">
          <CategoryDonut data={data.categoryBreakdown} />
        </FCard>
      </div>

      {/* Activity + top suppliers */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-3">
        <FCard
          index={6}
          className="xl:col-span-2"
          title={
            <span className="flex flex-col">
              <span>Attività</span>
              <span className="mt-0.5 text-[12.5px] font-normal text-[var(--f-muted)]">Ordini inviati al giorno, ultime 20 settimane</span>
            </span>
          }
        >
          <ActivityHeatmap days={data.activity} />
        </FCard>
        <FCard index={7} title="Fornitori principali" action={<span className="text-[12.5px] text-[var(--f-muted)] tabular-nums">{data.supplierBreakdown.length} attivi</span>}>
          {data.supplierBreakdown.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-[13px] text-[var(--f-muted)]">Nessun fornitore nel periodo</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.supplierBreakdown.slice(0, 6).map((s, i) => (
                <li key={s.name} className="flex items-center gap-3">
                  <Avatar name={s.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13.5px] font-medium text-[var(--f-ink)]">{s.name}</span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--f-ink)]">
                        {formatCurrency(s.spending)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[var(--f-fill-2)]">
                      <div
                        className="f-grow-x h-full rounded-full bg-[var(--acc-600)]"
                        style={{ width: `${(s.spending / maxSupplier) * 100}%`, ["--i" as string]: i, ["--d" as string]: "300ms" }}
                      />
                    </div>
                    <p className="mt-1 text-[11.5px] text-[var(--f-muted)] tabular-nums">
                      {s.orderCount} ordin{s.orderCount === 1 ? "e" : "i"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FCard>
      </div>

      {/* Budget + variance */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-2">
        <div className="f-rise" style={riseStyle(8)}>
          <SectionFrame
            label="Budget del mese"
            trailing={data.budget.amount !== null ? `${(data.budget.percentUsed ?? 0).toFixed(0)}%` : "non impostato"}
            className="h-full"
          >
            <BudgetTracker budget={data.budget} />
          </SectionFrame>
        </div>
        <div className="f-rise" style={riseStyle(9)}>
          <SectionFrame label="Varianza vs periodo precedente" className="h-full">
            <VarianceCard
              delta={data.variance.delta}
              deltaPct={data.variance.deltaPct}
              topByCategory={data.variance.topByCategory}
              topBySupplier={data.variance.topBySupplier}
              topByProduct={data.variance.topByProduct}
              periodLabel={data.period.label}
            />
          </SectionFrame>
        </div>
      </div>

      {/* 12-month trend + weekday pattern */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-3">
        <div className="f-rise xl:col-span-2" style={riseStyle(10)}>
          <SectionFrame label="Ultimi 12 mesi vs anno precedente" className="h-full">
            <YoyTrendChart data={data.yearOverYear} />
          </SectionFrame>
        </div>
        <div className="f-rise" style={riseStyle(11)}>
          <SectionFrame label="Pattern settimanale" className="h-full">
            <WeekdayHeatmap cells={data.weekdayPattern} />
          </SectionFrame>
        </div>
      </div>

      {/* Products */}
      <div className="f-rise mt-3 lg:mt-4" style={riseStyle(12)}>
        <SectionFrame label="Prodotti principali" trailing={`${data.productInsights.length} righe`} padded={false}>
          <div className="px-4 pb-4 pt-1">
            <ProductInsightsTable rows={data.productInsights} />
          </div>
        </SectionFrame>
      </div>

      {/* Recent orders */}
      <div className="f-rise mt-3 lg:mt-4" style={riseStyle(13)}>
        <SectionFrame label="Ordini recenti" trailing={`${data.recentOrders.length}/8`} padded={false}>
          <div className="py-2">
            <AnalyticsRecentOrdersLog rows={data.recentOrders} />
          </div>
        </SectionFrame>
      </div>
    </div>
  );
}
