"use client";

import Link from "next/link";
import { BarChart3, ShoppingCart, Wallet, Receipt } from "lucide-react";
import { KPICard } from "@/components/dashboard/cards/kpi-card";
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

type Props = {
  data: RestaurantAnalytics;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  submitted: "Inviato",
  confirmed: "Confermato",
  preparing: "In prep.",
  shipping: "In consegna",
  delivered: "Consegnato",
  cancelled: "Annullato",
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-surface-elevated text-text-tertiary",
  submitted: "bg-accent-blue/10 text-accent-blue",
  confirmed: "bg-accent-green/10 text-accent-green",
  preparing: "bg-accent-orange/10 text-accent-orange",
  shipping: "bg-accent-purple/10 text-accent-purple",
  delivered: "bg-accent-green/10 text-accent-green",
  cancelled: "bg-accent-red/10 text-accent-red",
};

export function AnalyticsContent({ data }: Props) {
  const maxSupplier = data.supplierBreakdown.reduce((m, s) => Math.max(m, s.spending), 0) || 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Analytics Spesa</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Strumento completo di gestione spesa: budget, varianza mese su mese, prezzi prodotti.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector current={data.period.key} />
          <ExportCsvButton period={data.period.key} />
        </div>
      </header>

      <BudgetTracker budget={data.budget} />

      <VarianceCard
        delta={data.variance.delta}
        deltaPct={data.variance.deltaPct}
        topByCategory={data.variance.topByCategory}
        topBySupplier={data.variance.topBySupplier}
        topByProduct={data.variance.topByProduct}
        periodLabel={data.period.label}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryDonut data={data.categoryBreakdown} />
        <YoyTrendChart data={data.yearOverYear} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProductInsightsTable rows={data.productInsights} />
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
          <h3 className="font-semibold text-text-primary mb-1">Fornitori</h3>
          <p className="text-xs text-text-tertiary mb-4">Classifica per spesa nel periodo</p>
          {data.supplierBreakdown.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-text-tertiary">
              Nessun fornitore
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {data.supplierBreakdown.map((s) => (
                <div key={s.name}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary truncate mr-2">{s.name}</span>
                    <span className="text-sm font-mono font-bold text-text-primary shrink-0">
                      {formatCurrency(s.spending)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-green rounded-full transition-all duration-700"
                      style={{ width: `${(s.spending / maxSupplier) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    {s.orderCount} ordin{s.orderCount === 1 ? "e" : "i"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WeekdayHeatmap cells={data.weekdayPattern} />

      <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-card-dark overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h3 className="font-semibold text-text-primary">Ordini recenti</h3>
          <p className="text-xs text-text-tertiary mt-0.5">Ultimi 8 del periodo selezionato</p>
        </div>
        {data.recentOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-text-tertiary">Nessun ordine</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {data.recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/ordini/${o.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        STATUS_CLASSES[o.status] ?? "bg-surface-elevated text-text-tertiary"
                      }`}
                    >
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                    <span className="text-sm text-text-primary font-mono">
                      #{o.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {new Date(o.created_at).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {o.supplier_count > 0 && ` · ${o.supplier_count} fornitori`}
                    {o.item_count > 0 && ` · ${o.item_count} articoli`}
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-text-primary shrink-0 ml-4">
                  {formatCurrency(o.total)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
