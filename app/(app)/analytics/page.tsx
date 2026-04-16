import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ShoppingCart, Wallet, Users } from "lucide-react";
import { KPICard } from "@/components/dashboard/cards/kpi-card";
import { getRestaurantAnalytics } from "@/lib/analytics/restaurant";
import { formatCurrency } from "@/lib/utils/formatters";
import { AnalyticsCharts } from "./analytics-client";

export const metadata: Metadata = { title: "Analytics — GastroBridge" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function AnalyticsPage() {
  const data = await getRestaurantAnalytics();

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

      <AnalyticsCharts
        monthlyTrend={data.monthlyTrend}
        supplierBreakdown={data.supplierBreakdown}
        statusDistribution={data.statusDistribution}
      />

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
                    {" · "}
                    {o.supplier_count > 0 && `${o.supplier_count} fornitori · `}
                    {o.item_count > 0 && `${o.item_count} articoli`}
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
