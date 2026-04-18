// app/(app)/analytics/analytics-client.tsx
//
// Awwwards-grade terminal-dense SHELL for the restaurant analytics page.
// Every major block is wrapped in <SectionFrame> so the page reads like a
// financial terminal: "─ LABEL ─" headers, mono tabular-nums numbers,
// ASCII dividers, 40px dense rows. Sub-components (BudgetTracker,
// VarianceCard, CategoryDonut, YoyTrendChart, ProductInsightsTable,
// WeekdayHeatmap, PeriodSelector, ExportCsvButton, KPICard) are preserved
// unchanged — only the shell + wrapper frames are re-skinned.

"use client";

import { BarChart3, ShoppingCart, Wallet, Receipt } from "lucide-react";
import { KPICard } from "@/components/dashboard/cards/kpi-card";
import { SectionFrame } from "@/components/dashboard/restaurant/_awwwards/section-frame";
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
  const maxSupplier = data.supplierBreakdown.reduce(
    (m, s) => Math.max(m, s.spending),
    0,
  ) || 1;

  return (
    <div className="space-y-6">
      {/* ─── Header: terminal caption + display title + controls ─── */}
      <header className="animate-[fadeInUp_220ms_ease-out_both]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Analytics
            <span className="mx-1.5 text-border-subtle">·</span>
            <span className="tabular-nums">Spesa</span>
          </span>
          <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
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
            <p className="mt-1.5 text-text-secondary text-sm">
              Strumento completo di gestione spesa: budget, varianza mese su
              mese, prezzi prodotti.
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

      {/* ─── Budget + Variance row ─── */}
      <div
        className="cq-section grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
        }}
      >
        <SectionFrame label="Budget · Mese">
          <BudgetTracker budget={data.budget} />
        </SectionFrame>
        <SectionFrame label="Varianza · Mensile">
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

      {/* ─── KPI grid ─── */}
      <SectionFrame label="KPI · Periodo">
        <div
          className="cq-section grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          }}
        >
          <KPICard
            label="Spesa periodo"
            value={formatCurrency(data.currentSpending)}
            numericValue={data.currentSpending}
            previousValue={data.previousSpending}
            icon={Wallet}
            sparklineData={data.spendingSparkline}
          />
          <KPICard
            label="Ordini"
            value={data.currentOrderCount.toString()}
            numericValue={data.currentOrderCount}
            previousValue={data.previousOrderCount}
            icon={ShoppingCart}
          />
          <KPICard
            label="Ticket medio"
            value={formatCurrency(data.avgTicket)}
            numericValue={data.avgTicket}
            icon={Receipt}
          />
          <KPICard
            label="Fornitori attivi"
            value={data.supplierBreakdown.length.toString()}
            numericValue={data.supplierBreakdown.length}
            icon={BarChart3}
          />
        </div>
      </SectionFrame>

      {/* ─── Categorie + YoY row ─── */}
      <div
        className="cq-section grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
        }}
      >
        <SectionFrame label="Breakdown · Categorie">
          <CategoryDonut data={data.categoryBreakdown} />
        </SectionFrame>
        <SectionFrame label="Trend · Yoy">
          <YoyTrendChart data={data.yearOverYear} />
        </SectionFrame>
      </div>

      {/* ─── Prodotti top + Fornitori classifica ─── */}
      <div className="cq-section grid grid-cols-1 @[960px]:grid-cols-3 gap-4">
        <div className="@[960px]:col-span-2">
          <SectionFrame label="Prodotti · Top">
            <ProductInsightsTable rows={data.productInsights} />
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
            <ul className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
              {data.supplierBreakdown.map((s) => (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] text-text-primary">
                      {s.name}
                    </span>
                    <span className="font-mono text-[13px] tabular-nums text-text-primary shrink-0">
                      {formatCurrency(s.spending)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-green rounded-full transition-all duration-700"
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
      <SectionFrame label="Pattern · Settimanale">
        <WeekdayHeatmap cells={data.weekdayPattern} />
      </SectionFrame>

      {/* ─── Ordini recenti (dense log) ─── */}
      <SectionFrame
        label="Ordini · Recenti"
        trailing={`${data.recentOrders.length}/8`}
        padded={false}
      >
        <div className="py-2">
          <AnalyticsRecentOrdersLog rows={data.recentOrders} />
        </div>
      </SectionFrame>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate3d(0, 4px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </div>
  );
}
