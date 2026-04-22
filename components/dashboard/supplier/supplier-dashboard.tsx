// components/dashboard/supplier/supplier-dashboard.tsx
//
// Supplier "Operator Console" — awwwards-grade premium terminal-dense redesign.
// Coherent with the restaurant operator console. Blocks:
//   1. SupplierHeroStrip   — greeting · date · time + live pulse
//   2. SupplierQuickActionBar — compact pill bar with supplier-area hrefs
//   3. SectionFrame + KpiGrid + AlertsStrip
//   4. SectionFrame + revenue line chart (30 days)
//   5. SectionFrame + SupplierRecentOrdersLog
//   6. SectionFrame + Top clienti / Top prodotti ranked lists
//   7. SectionFrame + Consegne recenti
//
// Props shape is preserved verbatim: server fetch in dashboard/page.tsx is
// untouched. Mobile view (SupplierDashboardMobile) left intact.

"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  PackageX,
  Truck,
} from "lucide-react";
import { CelebrationCheck, PulseDot } from "@/components/supplier/signature";
import { formatCurrency } from "@/lib/utils/formatters";
import { SupplierDashboardMobile } from "./supplier-dashboard-mobile";
import { SupplierHeroStrip } from "./_awwwards/hero-strip";
import { SupplierQuickActionBar } from "./_awwwards/quick-action-bar";
import { SectionFrame } from "./_awwwards/section-frame";
import { SupplierKpiGrid } from "./_awwwards/kpi-grid";
import { SupplierAlertsStrip } from "./_awwwards/alerts-strip";
import { SupplierRecentOrdersLog } from "./_awwwards/recent-orders-log";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  restaurant_name: string;
};

type TopProduct = {
  label: string;
  value: number;
  subtitle: string;
};

type TopClient = {
  name: string;
  orders: number;
  total: number;
};

type RevenueChartPoint = { day: string; label: string; value: number };

type TopClientRich = {
  restaurant_id: string;
  name: string;
  orders: number;
  revenue: number;
};

type TopProductRich = {
  product_id: string;
  name: string;
  quantity: number;
  revenue: number;
};

type RecentDelivery = {
  id: string;
  status: "planned" | "loaded" | "in_transit" | "delivered" | "failed";
  scheduled_date: string;
  delivered_at: string | null;
  restaurant_name: string;
  order_split_id: string;
};

type Props = {
  companyName: string;
  kpi: {
    ordersToday: number;
    monthlyRevenue: number;
    prevRevenue: number;
    activeClients: number;
    activeProducts: number;
    avgTicket?: number;
    avgTicketPrev?: number;
    revenueYoYDeltaPct?: number | null;
    orderBacklogCount?: number;
    orderBacklogOldestHours?: number;
  };
  revenueSparkline: number[];
  chartData: Array<{ label: string; value: number }>;
  recentOrders: OrderRow[];
  topProducts: TopProduct[];
  topClients: TopClient[];
  alerts?: {
    pendingOverdueCount: number;
    expiringLotsCount: number;
    failedDeliveriesCount: number;
  };
  revenueChart30d?: RevenueChartPoint[];
  topClientsRich?: TopClientRich[];
  topProductsRich?: TopProductRich[];
  recentDeliveries?: RecentDelivery[];
};

const DELIVERY_STATUS_META: Record<
  RecentDelivery["status"],
  { label: string; dot: string; text: string }
> = {
  planned: {
    label: "Pianificata",
    dot: "bg-text-tertiary",
    text: "text-text-tertiary",
  },
  loaded: {
    label: "Caricata",
    dot: "bg-accent-orange",
    text: "text-accent-orange",
  },
  in_transit: {
    label: "In viaggio",
    dot: "bg-accent-blue",
    text: "text-accent-blue",
  },
  delivered: {
    label: "Consegnata",
    dot: "bg-accent-green",
    text: "text-accent-green",
  },
  failed: { label: "Fallita", dot: "bg-accent-red", text: "text-accent-red" },
};

function formatDeliveryWhen(d: RecentDelivery): string {
  const ts = d.delivered_at ?? d.scheduled_date;
  try {
    return new Date(ts).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return ts;
  }
}

type MobileAlertItem = {
  key: string;
  tone: "amber" | "red";
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  href: string;
  cta: string;
};

function buildMobileAlerts(alerts: Props["alerts"]): MobileAlertItem[] {
  if (!alerts) return [];
  const list: MobileAlertItem[] = [];
  if (alerts.pendingOverdueCount > 0) {
    list.push({
      key: "pending",
      tone: "amber",
      icon: Clock,
      title: `${alerts.pendingOverdueCount} ordin${alerts.pendingOverdueCount === 1 ? "e" : "i"} in attesa da oltre 24h`,
      description: "Conferma o rifiuta per evitare rallentamenti alla consegna.",
      href: "/supplier/ordini?state=submitted",
      cta: "Vai agli ordini",
    });
  }
  if (alerts.expiringLotsCount > 0) {
    list.push({
      key: "expiring",
      tone: "amber",
      icon: AlertTriangle,
      title: `${alerts.expiringLotsCount} lott${alerts.expiringLotsCount === 1 ? "o" : "i"} in scadenza entro 7 giorni`,
      description: "Pianifica vendita o trasferimento per evitare sprechi.",
      href: "/supplier/magazzino/lotti?expiring=7",
      cta: "Gestisci lotti",
    });
  }
  if (alerts.failedDeliveriesCount > 0) {
    list.push({
      key: "failed",
      tone: "red",
      icon: PackageX,
      title: `${alerts.failedDeliveriesCount} consegn${alerts.failedDeliveriesCount === 1 ? "a fallita" : "e fallite"} questa settimana`,
      description: "Rivedi motivazioni e riprogramma la spedizione.",
      href: "/supplier/consegne?failed=1",
      cta: "Rivedi consegne",
    });
  }
  return list.slice(0, 3);
}

export function SupplierDashboard({
  companyName,
  kpi,
  revenueSparkline,
  chartData,
  recentOrders,
  topProducts,
  topClients,
  alerts,
  revenueChart30d,
  topClientsRich,
  topProductsRich,
  recentDeliveries,
}: Props) {
  const chart30 = revenueChart30d ?? [];
  const hasRechartsData = chart30.some((d) => d.value > 0);
  const topClientsList = topClientsRich ?? [];
  const topProductsList = topProductsRich ?? [];
  const recentDeliveriesList = recentDeliveries ?? [];
  const topClientsMax = topClientsList.reduce(
    (m, c) => (c.revenue > m ? c.revenue : m),
    0,
  );
  const topProductsMax = topProductsList.reduce(
    (m, p) => (p.revenue > m ? p.revenue : m),
    0,
  );

  const chartFallback = chartData.length > 0 && chart30.length === 0;
  const hasClassifica =
    topClientsList.length > 0 ||
    topProductsList.length > 0 ||
    topProducts.length > 0 ||
    topClients.length > 0;

  return (
    <>
      {/* Mobile Apple-app view — untouched */}
      <div className="lg:hidden">
        <SupplierDashboardMobile
          companyName={companyName}
          kpi={kpi}
          recentOrders={recentOrders}
          topClients={topClientsList}
          alerts={buildMobileAlerts(alerts)}
        />
      </div>

      {/* Desktop — terminal operator console */}
      <div className="hidden lg:block">
        <div className="space-y-6">
          {/* Block 1 — Hero identity strip */}
          <SupplierHeroStrip
            companyName={companyName}
            subtitle="Console operativa del giorno · ordini, fatturato e consegne in tempo reale."
          />

          {/* Block 2 — Quick action pills */}
          <div className="animate-[fadeInUp_240ms_ease-out_both] [animation-delay:60ms]">
            <SupplierQuickActionBar />
          </div>

          {/* Block 3 — KPI summary + alerts */}
          <div className="animate-[fadeInUp_260ms_ease-out_both] [animation-delay:120ms]">
            <SectionFrame
              label="Sintesi · Questo mese"
              trailing={`${kpi.ordersToday} nuovi oggi`}
              padded={false}
            >
              <div className="px-5 pt-5 pb-6 sm:px-6 sm:pt-6 sm:pb-7">
                <SupplierKpiGrid
                  ordersToday={kpi.ordersToday}
                  orderBacklogCount={kpi.orderBacklogCount ?? 0}
                  orderBacklogOldestHours={kpi.orderBacklogOldestHours ?? 0}
                  activeClients={kpi.activeClients}
                  activeProducts={kpi.activeProducts}
                  monthlyRevenue={kpi.monthlyRevenue}
                  prevRevenue={kpi.prevRevenue}
                  revenueSparkline={revenueSparkline}
                  avgTicket={kpi.avgTicket ?? null}
                  avgTicketPrev={kpi.avgTicketPrev ?? null}
                  revenueYoYDeltaPct={kpi.revenueYoYDeltaPct ?? null}
                />
              </div>
              <div className="border-t border-border-subtle px-5 py-3 sm:px-6">
                <SupplierAlertsStrip alerts={alerts} />
              </div>
            </SectionFrame>
          </div>

          {/* Block 4 — Revenue line chart */}
          <div className="animate-[fadeInUp_280ms_ease-out_both] [animation-delay:180ms]">
            <SectionFrame
              label="Andamento fatturato · ultimi 30 giorni"
              trailing={
                hasRechartsData
                  ? `${formatCurrency(
                      chart30.reduce((s, p) => s + p.value, 0),
                    )} totale`
                  : "nessun dato"
              }
              padded={false}
            >
              <div className="px-2 pb-3" style={{ height: 240 }}>
                {chart30.length > 0 && hasRechartsData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chart30}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient
                          id="supplierRevenueLine"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--color-accent-green)"
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--color-accent-orange)"
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="var(--color-border-subtle)"
                        strokeDasharray="2 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-tertiary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        stroke="var(--color-text-tertiary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000
                            ? `€${Math.round(v / 1000)}k`
                            : `€${Math.round(v)}`
                        }
                        width={48}
                      />
                      <Tooltip
                        cursor={{
                          stroke: "var(--color-border-default)",
                          strokeWidth: 1,
                        }}
                        contentStyle={{
                          backgroundColor: "var(--color-surface-elevated)",
                          border: "1px solid var(--color-border-default)",
                          borderRadius: 12,
                          fontSize: 12,
                          color: "var(--color-text-primary)",
                        }}
                        labelStyle={{
                          color: "var(--color-text-tertiary)",
                          fontSize: 11,
                        }}
                        formatter={(value) => [
                          formatCurrency(
                            typeof value === "number"
                              ? value
                              : Number(value ?? 0),
                          ),
                          "Fatturato",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="url(#supplierRevenueLine)"
                        strokeWidth={2.2}
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: "var(--color-accent-green)",
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : chartFallback ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid
                        stroke="var(--color-border-subtle)"
                        strokeDasharray="2 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-tertiary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        stroke="var(--color-text-tertiary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000
                            ? `€${Math.round(v / 1000)}k`
                            : `€${Math.round(v)}`
                        }
                        width={48}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-accent-orange)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                    Nessun fatturato registrato negli ultimi 30 giorni
                  </div>
                )}
              </div>
            </SectionFrame>
          </div>

          {/* Block 5 — Recent orders log */}
          <div className="animate-[fadeInUp_300ms_ease-out_both] [animation-delay:240ms]">
            <SectionFrame
              label="Ordini recenti"
              trailing={
                <Link
                  href="/supplier/ordini"
                  className="text-accent-green hover:text-text-primary transition-colors"
                >
                  vedi tutti →
                </Link>
              }
              padded={false}
            >
              <div className="py-2">
                <SupplierRecentOrdersLog rows={recentOrders} />
              </div>
            </SectionFrame>
          </div>

          {/* Block 6 — Classifica top clienti / top prodotti */}
          {hasClassifica && (
            <div className="animate-[fadeInUp_320ms_ease-out_both] [animation-delay:300ms]">
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
                }}
              >
                {/* Top clienti */}
                <SectionFrame
                  label="Classifica · Top clienti · mese"
                  trailing={
                    topClientsList.length > 0
                      ? `top ${topClientsList.length}`
                      : topClients.length > 0
                        ? `top ${topClients.length}`
                        : undefined
                  }
                  padded={false}
                >
                  <TopClientsList
                    rich={topClientsList}
                    legacy={topClients}
                    max={topClientsMax}
                  />
                </SectionFrame>

                {/* Top prodotti */}
                <SectionFrame
                  label="Classifica · Top prodotti · mese"
                  trailing={
                    topProductsList.length > 0
                      ? `top ${topProductsList.length}`
                      : topProducts.length > 0
                        ? `top ${topProducts.length}`
                        : undefined
                  }
                  padded={false}
                >
                  <TopProductsList
                    rich={topProductsList}
                    legacy={topProducts}
                    max={topProductsMax}
                  />
                </SectionFrame>
              </div>
            </div>
          )}

          {/* Block 7 — Consegne recenti */}
          {recentDeliveriesList.length > 0 && (
            <div className="animate-[fadeInUp_340ms_ease-out_both] [animation-delay:360ms]">
              <SectionFrame
                label="Consegne recenti"
                trailing={
                  <Link
                    href="/supplier/consegne"
                    className="text-accent-green hover:text-text-primary transition-colors"
                  >
                    vedi tutte →
                  </Link>
                }
                padded={false}
              >
                <ul className="flex flex-col">
                  {recentDeliveriesList.map((d) => {
                    const meta =
                      DELIVERY_STATUS_META[d.status] ??
                      DELIVERY_STATUS_META.planned;
                    const isDelivered = d.status === "delivered";
                    const isInTransit = d.status === "in_transit";
                    return (
                      <li key={d.id}>
                        <div
                          className="group grid w-full grid-cols-[48px_14px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-green hover:bg-surface-hover"
                          style={{ minHeight: 44 }}
                        >
                          <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                            {formatDeliveryWhen(d)}
                          </span>
                          <span className="flex h-6 w-6 items-center justify-center">
                            {isDelivered ? (
                              <CelebrationCheck size={16} />
                            ) : isInTransit ? (
                              <PulseDot variant="live" size={8} />
                            ) : (
                              <span
                                className={`h-2 w-2 rounded-full ${meta.dot}`}
                              />
                            )}
                          </span>
                          <span className="flex min-w-0 items-center gap-3">
                            <Truck className="h-3.5 w-3.5 text-text-tertiary" />
                            <span className="truncate text-[13px] text-text-primary">
                              {d.restaurant_name}
                            </span>
                          </span>
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.08em] ${meta.text}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </SectionFrame>
            </div>
          )}

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
          `}</style>
        </div>
      </div>
    </>
  );
}

function TopClientsList({
  rich,
  legacy,
  max,
}: {
  rich: TopClientRich[];
  legacy: TopClient[];
  max: number;
}) {
  if (rich.length === 0 && legacy.length === 0) {
    return (
      <p className="px-3 py-6 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessun ordine questo mese
      </p>
    );
  }

  if (rich.length > 0) {
    return (
      <ul className="flex flex-col">
        {rich.map((c, i) => {
          const pct = max > 0 ? (c.revenue / max) * 100 : 0;
          return (
            <li key={c.restaurant_id}>
              <div
                className="group relative grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-blue hover:bg-surface-hover"
                style={{ minHeight: 40 }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 bg-accent-blue/10"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative font-mono text-[11px] tabular-nums text-text-tertiary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="relative flex min-w-0 items-center gap-3">
                  <span className="truncate text-[13px] text-text-primary">
                    {c.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                    {c.orders} ord
                  </span>
                </span>
                <span className="relative font-mono text-[13px] tabular-nums text-text-primary">
                  {formatCurrency(c.revenue)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  // Legacy fallback — fewer fields
  return (
    <ul className="flex flex-col">
      {legacy.map((c, i) => (
        <li key={c.name}>
          <div
            className="group grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-blue hover:bg-surface-hover"
            style={{ minHeight: 40 }}
          >
            <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex min-w-0 items-center gap-3">
              <span className="truncate text-[13px] text-text-primary">
                {c.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                {c.orders} ord
              </span>
            </span>
            <span className="font-mono text-[13px] tabular-nums text-text-primary">
              {formatCurrency(c.total)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopProductsList({
  rich,
  legacy,
  max,
}: {
  rich: TopProductRich[];
  legacy: TopProduct[];
  max: number;
}) {
  if (rich.length === 0 && legacy.length === 0) {
    return (
      <p className="px-3 py-6 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessun prodotto venduto questo mese
      </p>
    );
  }

  if (rich.length > 0) {
    return (
      <ul className="flex flex-col">
        {rich.map((p, i) => {
          const pct = max > 0 ? (p.revenue / max) * 100 : 0;
          return (
            <li key={p.product_id}>
              <div
                className="group relative grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-green hover:bg-surface-hover"
                style={{ minHeight: 40 }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 bg-accent-green/10"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative font-mono text-[11px] tabular-nums text-text-tertiary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="relative flex min-w-0 items-center gap-3">
                  <span className="truncate text-[13px] text-text-primary">
                    {p.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                    {p.quantity.toLocaleString("it-IT", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    unità
                  </span>
                </span>
                <span className="relative font-mono text-[13px] tabular-nums text-text-primary">
                  {formatCurrency(p.revenue)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  // Legacy fallback — just label + value
  return (
    <ul className="flex flex-col">
      {legacy.map((p, i) => (
        <li key={p.label}>
          <div
            className="group grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-green hover:bg-surface-hover"
            style={{ minHeight: 40 }}
          >
            <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex min-w-0 items-center gap-3">
              <span className="truncate text-[13px] text-text-primary">
                {p.label}
              </span>
            </span>
            <span className="font-mono text-[11px] text-text-tertiary">
              {p.subtitle}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
