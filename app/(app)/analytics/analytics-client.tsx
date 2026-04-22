// app/(app)/analytics/analytics-client.tsx
//
// Awwwards-grade terminal-dense restaurant analytics shell.
// Every block wraps in <SectionFrame> for "─ LABEL ─" header rules,
// hairline dividers, mono tabular-nums, 40px dense rows — coherent
// with /dashboard hero-strip + section-frame pattern.

"use client";

import { TerminalKPICard } from "@/components/dashboard/cards/terminal-kpi-card";
import { SectionFrame } from "@/components/dashboard/restaurant/_awwwards/section-frame";
import { LargeTitle } from "@/components/ui/large-title";
import { formatCurrency } from "@/lib/utils/formatters";
import type { RestaurantAnalytics } from "@/lib/analytics/restaurant";
import { PeriodSelector } from "./_components/period-selector";
import { BudgetTracker } from "./_components/budget-tracker";
import { VarianceCard } from "./_components/variance-card";
import { CategoryDonut } from "./_components/category-donut";
import { ProductInsightsTable } from "./_components/product-insights-table";
import { YoyTrendChart } from "./_components/yoy-trend-chart";
import { WeekdayHeatmap } from "./_components/weekday-heatmap";
import { ExportCsvButton } from "./_components/export-csv-button";
import { AnalyticsRecentOrdersLog } from "./_components/recent-orders-log";

type Props = {
  data: RestaurantAnalytics;
};

export function AnalyticsContent({ data }: Props) {
  const maxSupplier =
    data.supplierBreakdown.reduce((m, s) => Math.max(m, s.spending), 0) || 1;

  return (
    <div className="space-y-5 lg:space-y-6" data-strong-card-borders>
      {/* ─── Mobile editorial hero ─── */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow={`Analytics · ${data.period.label}`}
          title="Spesa"
          subtitle="Budget, varianza e prezzi prodotti"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PeriodSelector current={data.period.key} />
              <ExportCsvButton period={data.period.key} />
            </div>
          }
        />
      </div>

      {/* ─── Desktop: terminal caption + display title + controls ─── */}
      <header className="hidden lg:block animate-[fadeInUp_220ms_ease-out_both]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Analytics
            <span className="mx-1.5 text-border-subtle">·</span>
            <span className="tabular-nums">Spesa</span>
          </span>
          <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums text-text-tertiary">
            {data.period.label}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="font-display text-text-primary"
              style={{
                fontSize: "var(--text-display-lg, 24px)",
                lineHeight: "var(--text-display-lg--line-height, 1.2)",
                letterSpacing: "var(--text-display-lg--letter-spacing, -0.01em)",
                fontWeight: "var(--text-display-lg--font-weight, 700)",
              }}
            >
              Analytics Spesa
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Budget, varianza periodo su periodo e prezzi prodotti — in un
              unico pannello.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              Periodo
            </span>
            <PeriodSelector current={data.period.key} />
            <ExportCsvButton period={data.period.key} />
          </div>
        </div>
      </header>

      {/* ─── KPI strip (header rule + card grid, no outer frame) ─── */}
      <section
        aria-label="KPI periodo"
        className="animate-[fadeInUp_240ms_ease-out_both] [animation-delay:60ms]"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            KPI · Periodo
          </span>
          <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums text-text-tertiary">
            {data.currentOrderCount > 0 ? `${data.currentOrderCount} ord.` : "—"}
          </span>
        </div>
        <div
          className="cq-section mt-3 grid gap-3"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          }}
        >
          <TerminalKPICard
            index="01"
            label="Spesa periodo"
            value={formatCurrency(data.currentSpending)}
            numericValue={data.currentSpending}
            previousValue={data.previousSpending}
            sparklineData={data.spendingSparkline}
            positiveIsGood={false}
          />
          <TerminalKPICard
            index="02"
            label="Ordini"
            value={data.currentOrderCount.toString()}
            numericValue={data.currentOrderCount}
            previousValue={data.previousOrderCount}
          />
          <TerminalKPICard
            index="03"
            label="Ticket medio"
            value={formatCurrency(data.avgTicket)}
            numericValue={data.avgTicket}
            hint="media periodo"
          />
          <TerminalKPICard
            index="04"
            label="Fornitori attivi"
            value={data.supplierBreakdown.length.toString()}
            numericValue={data.supplierBreakdown.length}
            hint="nel periodo"
          />
        </div>
      </section>

      {/* ─── Budget + Variance row ─── */}
      <div
        className="cq-section grid gap-4 animate-[fadeInUp_260ms_ease-out_both] [animation-delay:120ms]"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
        }}
      >
        <SectionFrame
          label="Budget · Mese"
          trailing={
            data.budget.amount !== null
              ? `${(data.budget.percentUsed ?? 0).toFixed(0)}%`
              : "non impostato"
          }
        >
          <BudgetTracker budget={data.budget} />
        </SectionFrame>
        <SectionFrame label="Varianza · vs Precedente">
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

      {/* ─── Categorie + YoY row ─── */}
      <div
        className="cq-section grid gap-4 animate-[fadeInUp_280ms_ease-out_both] [animation-delay:180ms]"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
        }}
      >
        <SectionFrame
          label="Breakdown · Categorie"
          trailing={`${data.categoryBreakdown.length} cat.`}
        >
          <CategoryDonut data={data.categoryBreakdown} />
        </SectionFrame>
        <SectionFrame label="Trend · 12 mesi YoY">
          <YoyTrendChart data={data.yearOverYear} />
        </SectionFrame>
      </div>

      {/* ─── Prodotti top + Fornitori classifica ─── */}
      <div className="cq-section grid grid-cols-1 gap-4 @[960px]:grid-cols-3 animate-[fadeInUp_300ms_ease-out_both] [animation-delay:240ms]">
        <div className="@[960px]:col-span-2">
          <SectionFrame
            label="Prodotti · Top"
            trailing={`${data.productInsights.length} righe`}
            padded={false}
          >
            <div className="px-4 pb-4 pt-1">
              <ProductInsightsTable rows={data.productInsights} />
            </div>
          </SectionFrame>
        </div>
        <SectionFrame
          label="Fornitori · Classifica"
          trailing={`${data.supplierBreakdown.length} attivi`}
        >
          {data.supplierBreakdown.length === 0 ? (
            <div className="flex h-32 items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
              Nessun fornitore
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.supplierBreakdown.map((s) => (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] text-text-primary">
                      {s.name}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums text-text-primary">
                      {formatCurrency(s.spending)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className="h-full rounded-full bg-accent-green transition-[width] duration-700 ease-out"
                      style={{
                        width: `${(s.spending / maxSupplier) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums text-text-tertiary">
                    {s.orderCount} ordin{s.orderCount === 1 ? "e" : "i"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionFrame>
      </div>

      {/* ─── Pattern settimanale ─── */}
      <div className="animate-[fadeInUp_320ms_ease-out_both] [animation-delay:300ms]">
        <SectionFrame label="Pattern · Settimanale">
          <WeekdayHeatmap cells={data.weekdayPattern} />
        </SectionFrame>
      </div>

      {/* ─── Ordini recenti (dense log) ─── */}
      <div className="animate-[fadeInUp_340ms_ease-out_both] [animation-delay:360ms]">
        <SectionFrame
          label="Ordini · Recenti"
          trailing={`${data.recentOrders.length}/8`}
          padded={false}
        >
          <div className="py-2">
            <AnalyticsRecentOrdersLog rows={data.recentOrders} />
          </div>
        </SectionFrame>
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate3d(0, 6px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[fadeInUp_220ms_ease-out_both\\],
          .animate-\\[fadeInUp_240ms_ease-out_both\\],
          .animate-\\[fadeInUp_260ms_ease-out_both\\],
          .animate-\\[fadeInUp_280ms_ease-out_both\\],
          .animate-\\[fadeInUp_300ms_ease-out_both\\],
          .animate-\\[fadeInUp_320ms_ease-out_both\\],
          .animate-\\[fadeInUp_340ms_ease-out_both\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
