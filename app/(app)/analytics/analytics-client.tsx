"use client";

import { motion } from "motion/react";
import { AreaChart } from "@/components/dashboard/charts/area-chart";
import { formatCurrency } from "@/lib/utils/formatters";
import type { RestaurantAnalytics } from "@/lib/analytics/restaurant";

type Props = {
  monthlyTrend: RestaurantAnalytics["monthlyTrend"];
  supplierBreakdown: RestaurantAnalytics["supplierBreakdown"];
  statusDistribution: RestaurantAnalytics["statusDistribution"];
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

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--color-text-tertiary)",
  submitted: "var(--color-accent-blue, #3b82f6)",
  confirmed: "var(--color-accent-green)",
  preparing: "var(--color-accent-orange)",
  shipping: "var(--color-accent-purple, #a855f7)",
  delivered: "var(--color-accent-green)",
  cancelled: "var(--color-accent-red, #ef4444)",
};

export function AnalyticsCharts({ monthlyTrend, supplierBreakdown, statusDistribution }: Props) {
  const maxSupplierSpending = supplierBreakdown.reduce((m, s) => Math.max(m, s.spending), 0) || 1;
  const totalStatusCount = statusDistribution.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
        <h3 className="font-semibold text-text-primary mb-1">Spesa mensile</h3>
        <p className="text-xs text-text-tertiary mb-4">Ultimi 12 mesi</p>
        {monthlyTrend.every((m) => m.value === 0) ? (
          <div className="h-52 flex items-center justify-center text-sm text-text-tertiary">
            Nessun ordine negli ultimi 12 mesi
          </div>
        ) : (
          <AreaChart data={monthlyTrend} height={220} />
        )}
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
        <h3 className="font-semibold text-text-primary mb-1">Spesa per fornitore</h3>
        <p className="text-xs text-text-tertiary mb-4">Mese corrente</p>
        {supplierBreakdown.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-text-tertiary">
            Nessun fornitore nel mese corrente
          </div>
        ) : (
          <div className="space-y-3">
            {supplierBreakdown.slice(0, 8).map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary truncate mr-2">{s.name}</span>
                  <span className="text-sm font-mono font-bold text-text-primary shrink-0">
                    {formatCurrency(s.spending)}
                  </span>
                </div>
                <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent-green rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.spending / maxSupplierSpending) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 }}
                  />
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {s.orderCount} ordin{s.orderCount === 1 ? "e" : "i"}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark lg:col-span-2">
        <h3 className="font-semibold text-text-primary mb-1">Distribuzione stato ordini</h3>
        <p className="text-xs text-text-tertiary mb-4">Mese corrente</p>
        {statusDistribution.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-text-tertiary">
            Nessun ordine nel mese corrente
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-surface-elevated">
              {statusDistribution.map((d) => (
                <motion.div
                  key={d.status}
                  initial={{ width: 0 }}
                  animate={{ width: `${(d.count / totalStatusCount) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ backgroundColor: STATUS_COLORS[d.status] ?? "var(--color-accent-green)" }}
                  title={`${STATUS_LABELS[d.status] ?? d.status}: ${d.count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              {statusDistribution.map((d) => (
                <div key={d.status} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[d.status] ?? "var(--color-accent-green)" }}
                  />
                  <span className="text-xs text-text-secondary">
                    {STATUS_LABELS[d.status] ?? d.status}
                  </span>
                  <span className="text-xs font-mono font-bold text-text-primary">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
