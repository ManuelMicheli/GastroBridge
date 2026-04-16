"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { BarChart3, ShoppingCart, Wallet, Users } from "lucide-react";
import { KPICard } from "@/components/dashboard/cards/kpi-card";
import { AreaChart } from "@/components/dashboard/charts/area-chart";
import { formatCurrency } from "@/lib/utils/formatters";
import type { RestaurantAnalytics } from "@/lib/analytics/restaurant";

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

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--color-text-tertiary)",
  submitted: "var(--color-accent-blue, #3b82f6)",
  confirmed: "var(--color-accent-green)",
  preparing: "var(--color-accent-orange)",
  shipping: "var(--color-accent-purple, #a855f7)",
  delivered: "var(--color-accent-green)",
  cancelled: "var(--color-accent-red, #ef4444)",
};

export function AnalyticsContent({ data }: Props) {
  const maxSupplierSpending = data.supplierBreakdown.reduce((m, s) => Math.max(m, s.spending), 0) || 1;
  const totalStatusCount = data.statusDistribution.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analytics Spesa</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Riepilogo acquisti, fornitori e trend di spesa
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Spesa mese"
          value={formatCurrency(data.currentMonthSpending)}
          numericValue={data.currentMonthSpending}
          previousValue={data.prevMonthSpending}
          icon={Wallet}
          sparklineData={data.spendingSparkline}
        />
        <KPICard
          label="Ordini mese"
          value={data.currentOrderCount.toString()}
          numericValue={data.currentOrderCount}
          previousValue={data.prevOrderCount}
          icon={ShoppingCart}
        />
        <KPICard
          label="Ticket medio"
          value={formatCurrency(data.avgTicket)}
          numericValue={data.avgTicket}
          icon={BarChart3}
        />
        <KPICard
          label="Fornitori attivi"
          value={data.supplierBreakdown.length.toString()}
          numericValue={data.supplierBreakdown.length}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
          <h3 className="font-semibold text-text-primary mb-1">Spesa mensile</h3>
          <p className="text-xs text-text-tertiary mb-4">Ultimi 12 mesi</p>
          {data.monthlyTrend.every((m) => m.value === 0) ? (
            <div className="h-52 flex items-center justify-center text-sm text-text-tertiary">
              Nessun ordine negli ultimi 12 mesi
            </div>
          ) : (
            <AreaChart data={data.monthlyTrend} height={220} />
          )}
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
          <h3 className="font-semibold text-text-primary mb-1">Spesa per fornitore</h3>
          <p className="text-xs text-text-tertiary mb-4">Mese corrente</p>
          {data.supplierBreakdown.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-text-tertiary">
              Nessun fornitore nel mese corrente
            </div>
          ) : (
            <div className="space-y-3">
              {data.supplierBreakdown.slice(0, 8).map((s, i) => (
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
          {data.statusDistribution.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-sm text-text-tertiary">
              Nessun ordine nel mese corrente
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex h-3 rounded-full overflow-hidden bg-surface-elevated">
                {data.statusDistribution.map((d) => (
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
                {data.statusDistribution.map((d) => (
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

      <div className="bg-surface-card border border-border-subtle rounded-2xl shadow-card-dark overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h3 className="font-semibold text-text-primary">Ordini recenti</h3>
          <p className="text-xs text-text-tertiary mt-0.5">Ultimi 8 ordini</p>
        </div>
        {data.recentOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-text-tertiary">Nessun ordine ancora</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {data.recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/ordini/${o.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-elevated transition-colors"
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
