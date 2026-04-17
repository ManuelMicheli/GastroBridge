"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ClipboardList, TrendingUp, Users, Package,
  Plus, MapPin, BarChart3, Star,
  AlertTriangle, Clock, PackageX, Receipt, Hourglass, Truck,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { KPICard } from "../cards/kpi-card";
import { DarkCard, DarkCardHeader, DarkCardTitle } from "../cards/dark-card";
import { QuickAction } from "../cards/quick-action";
import { AreaChart } from "../charts/area-chart";
import { MiniBar } from "../charts/mini-bar";
import { StatusBadge } from "../tables/status-badge";
import { DataTable, type Column } from "../tables/data-table";
import {
  SerifGreeting,
  Ticker,
  type TickerItem,
  PulseDot,
  CelebrationCheck,
} from "@/components/supplier/signature";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useRouter } from "next/navigation";

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
    // Nuovi KPI (Task 11)
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
  // Task 12
  revenueChart30d?: RevenueChartPoint[];
  topClientsRich?: TopClientRich[];
  topProductsRich?: TopProductRich[];
  recentDeliveries?: RecentDelivery[];
};

const DELIVERY_STATUS_META: Record<
  RecentDelivery["status"],
  { label: string; dot: string; text: string; bg: string }
> = {
  planned: { label: "Pianificata", dot: "bg-text-tertiary", text: "text-text-tertiary", bg: "bg-surface-hover" },
  loaded: { label: "Caricata", dot: "bg-accent-orange", text: "text-accent-orange", bg: "bg-accent-orange-muted" },
  in_transit: { label: "In viaggio", dot: "bg-accent-blue", text: "text-accent-blue", bg: "bg-accent-blue-muted" },
  delivered: { label: "Consegnata", dot: "bg-accent-green", text: "text-accent-green", bg: "bg-accent-green-muted" },
  failed: { label: "Fallita", dot: "bg-accent-red", text: "text-accent-red", bg: "bg-accent-red-muted" },
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

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const orderColumns: Column<OrderRow>[] = [
  {
    key: "restaurant",
    label: "Cliente",
    render: (row) => <span className="text-text-primary font-medium">{row.restaurant_name}</span>,
  },
  {
    key: "status",
    label: "Stato",
    render: (row) => (
      <StatusBadge status={row.status as "draft" | "submitted" | "confirmed" | "preparing" | "shipping" | "delivered" | "cancelled"} />
    ),
  },
  {
    key: "total",
    label: "Totale",
    sortable: true,
    render: (row) => <span className="font-mono text-text-primary">{formatCurrency(row.total)}</span>,
  },
  {
    key: "date",
    label: "Data",
    render: (row) => <span className="text-text-tertiary">{formatDate(row.created_at)}</span>,
  },
];

type AlertItem = {
  key: string;
  tone: "amber" | "red";
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  href: string;
  cta: string;
};

function buildTickerItems({
  kpi,
  topClientsRich,
  recentDeliveries,
}: {
  kpi: Props["kpi"];
  topClientsRich?: TopClientRich[];
  recentDeliveries?: RecentDelivery[];
}): TickerItem[] {
  const items: TickerItem[] = [
    {
      key: "orders-today",
      label: "Evasi oggi",
      value: kpi.ordersToday.toString(),
    },
    {
      key: "mtd",
      label: "Fatturato MTD",
      value: formatCurrency(kpi.monthlyRevenue),
    },
    {
      key: "clients",
      label: "Clienti attivi",
      value: kpi.activeClients.toString(),
    },
    {
      key: "products",
      label: "Prodotti attivi",
      value: kpi.activeProducts.toString(),
    },
  ];

  if (kpi.avgTicket !== undefined && kpi.avgTicket > 0) {
    items.push({
      key: "avg-ticket",
      label: "Ticket medio",
      value: formatCurrency(Math.round(kpi.avgTicket)),
    });
  }

  if (kpi.orderBacklogCount !== undefined && kpi.orderBacklogCount > 0) {
    const oldest = kpi.orderBacklogOldestHours ?? 0;
    items.push({
      key: "backlog",
      label: "Backlog",
      value:
        oldest > 0
          ? `${kpi.orderBacklogCount} · ${oldest}h`
          : kpi.orderBacklogCount.toString(),
    });
  }

  const topClient = topClientsRich?.[0];
  if (topClient) {
    items.push({
      key: "top-client",
      label: "Top cliente",
      value: topClient.name,
    });
  }

  const deliveredCount = (recentDeliveries ?? []).filter(
    (d) => d.status === "delivered",
  ).length;
  if (deliveredCount > 0) {
    items.push({
      key: "delivered",
      label: "Consegnate",
      value: deliveredCount.toString(),
    });
  }

  return items;
}

function buildAlerts(alerts: Props["alerts"]): AlertItem[] {
  if (!alerts) return [];
  const list: AlertItem[] = [];
  if (alerts.pendingOverdueCount > 0) {
    list.push({
      key: "pending",
      tone: "amber",
      icon: Clock,
      title: `${alerts.pendingOverdueCount} ordin${alerts.pendingOverdueCount === 1 ? "e" : "i"} in attesa da oltre 24h`,
      description: "Conferma o rifiuta per evitare rallentamenti alla consegna.",
      href: "/supplier/ordini?status=pending",
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
  const router = useRouter();
  const alertItems = buildAlerts(alerts);
  const chart30 = revenueChart30d ?? [];
  const hasRecharts = chart30.some((d) => d.value > 0);
  const topClientsList = (topClientsRich && topClientsRich.length > 0)
    ? topClientsRich
    : [];
  const topProductsList = (topProductsRich && topProductsRich.length > 0)
    ? topProductsRich
    : [];
  const recentDeliveriesList = recentDeliveries ?? [];
  const topClientsMax = topClientsList.reduce(
    (m, c) => (c.revenue > m ? c.revenue : m),
    0,
  );
  const topProductsMax = topProductsList.reduce(
    (m, p) => (p.revenue > m ? p.revenue : m),
    0,
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Editorial hero — serif greeting + live ticker */}
      <div className="space-y-4">
        <SerifGreeting name={companyName} />
        <Ticker
          items={buildTickerItems({ kpi, topClientsRich, recentDeliveries })}
        />
      </div>

      {/* Alert banner (Task 11) */}
      {alertItems.length > 0 && (
        <div className="space-y-2">
          {alertItems.map((a) => {
            const Icon = a.icon;
            const toneClasses =
              a.tone === "red"
                ? "border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                : "border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15";
            const iconTone = a.tone === "red" ? "text-red-300" : "text-amber-300";
            return (
              <Link
                key={a.key}
                href={a.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${toneClasses}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${iconTone}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <p className="text-xs opacity-80 truncate">{a.description}</p>
                </div>
                <span className="text-xs font-semibold whitespace-nowrap">
                  {a.cta} →
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Ordini oggi"
          value={kpi.ordersToday.toString()}
          numericValue={kpi.ordersToday}
          icon={ClipboardList}
        />
        <KPICard
          label="Fatturato mese"
          value={`€${kpi.monthlyRevenue.toLocaleString("it-IT")}`}
          numericValue={kpi.monthlyRevenue}
          previousValue={kpi.prevRevenue}
          icon={TrendingUp}
          accentColor="var(--color-accent-orange)"
          sparklineData={revenueSparkline}
        />
        <KPICard
          label="Clienti attivi"
          value={kpi.activeClients.toString()}
          numericValue={kpi.activeClients}
          icon={Users}
          accentColor="var(--color-accent-blue)"
        />
        <KPICard
          label="Prodotti attivi"
          value={kpi.activeProducts.toString()}
          numericValue={kpi.activeProducts}
          icon={Package}
          accentColor="var(--color-accent-green)"
        />
      </div>

      {/* Secondary KPI row (Task 11: ticket medio, backlog, YoY delta) */}
      {(kpi.avgTicket !== undefined ||
        kpi.orderBacklogCount !== undefined ||
        kpi.revenueYoYDeltaPct !== undefined) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {kpi.avgTicket !== undefined && (
            <KPICard
              label="Ticket medio (14gg)"
              value={`€${Math.round(kpi.avgTicket).toLocaleString("it-IT")}`}
              numericValue={Math.round(kpi.avgTicket)}
              previousValue={kpi.avgTicketPrev}
              icon={Receipt}
              accentColor="var(--color-accent-orange)"
            />
          )}
          {kpi.orderBacklogCount !== undefined && (
            <KPICard
              label="Backlog ordini"
              value={kpi.orderBacklogCount.toString()}
              numericValue={kpi.orderBacklogCount}
              icon={Hourglass}
              accentColor="var(--color-accent-blue)"
            />
          )}
          {kpi.revenueYoYDeltaPct !== undefined && kpi.revenueYoYDeltaPct !== null && (
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-accent-green) 12%, transparent)" }}
                >
                  <TrendingUp className="h-4 w-4 text-accent-green" />
                </div>
                <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Revenue vs 14gg prec.
                </span>
              </div>
              <p className="text-2xl font-mono font-bold text-text-primary">
                {kpi.revenueYoYDeltaPct >= 0 ? "+" : ""}
                {kpi.revenueYoYDeltaPct.toFixed(1)}%
              </p>
              <p className="text-xs text-text-tertiary mt-1.5">
                Confronto ultimi 14gg vs 14gg precedenti
              </p>
            </div>
          )}
        </div>
      )}

      {/* Row 2: Revenue Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DarkCard className="lg:col-span-2" noPadding>
          <div className="p-5 pb-0">
            <DarkCardHeader>
              <DarkCardTitle>Andamento Fatturato</DarkCardTitle>
              <span className="text-xs text-text-tertiary">Ultimi 30 giorni</span>
            </DarkCardHeader>
          </div>
          {chart30.length > 0 ? (
            <div className="px-4 pb-4" style={{ height: 240 }}>
              {hasRecharts ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chart30}
                    margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="revenueLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--color-accent-green)" />
                        <stop offset="100%" stopColor="var(--color-accent-orange)" />
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
                        v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`
                      }
                      width={48}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--color-border-default)", strokeWidth: 1 }}
                      contentStyle={{
                        backgroundColor: "var(--color-surface-elevated)",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--color-text-primary)",
                      }}
                      labelStyle={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
                      formatter={(value) => [
                        formatCurrency(typeof value === "number" ? value : Number(value ?? 0)),
                        "Fatturato",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="url(#revenueLine)"
                      strokeWidth={2.2}
                      dot={false}
                      activeDot={{ r: 4, fill: "var(--color-accent-green)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
                  Nessun fatturato registrato negli ultimi 30 giorni.
                </div>
              )}
            </div>
          ) : (
            <div className="px-2 pb-3">
              <AreaChart data={chartData} height={220} color="var(--color-accent-orange)" />
            </div>
          )}
        </DarkCard>

        <DarkCard>
          <DarkCardHeader>
            <DarkCardTitle>Azioni rapide</DarkCardTitle>
          </DarkCardHeader>
          <div className="space-y-2">
            <QuickAction href="/supplier/catalogo/nuovo" label="Aggiungi prodotto" description="Nuovo nel catalogo" icon={Plus} index={0} />
            <QuickAction href="/supplier/impostazioni/zone" label="Zone consegna" description="Gestisci aree" icon={MapPin} index={1} />
            <QuickAction href="/supplier/analytics" label="Analytics" description="Dati avanzati" icon={BarChart3} index={2} />
            <QuickAction href="/supplier/recensioni" label="Recensioni" description="Feedback clienti" icon={Star} index={3} />
          </div>
        </DarkCard>
      </div>

      {/* Row 3: Orders + Products + Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <DarkCard className="lg:col-span-2" noPadding>
          <div className="p-5 pb-0">
            <DarkCardHeader>
              <DarkCardTitle>Ordini recenti</DarkCardTitle>
              <button
                onClick={() => router.push("/supplier/ordini")}
                className="text-xs text-text-link hover:text-accent-green transition-colors"
              >
                Vedi tutti →
              </button>
            </DarkCardHeader>
          </div>
          <DataTable
            columns={orderColumns}
            data={recentOrders}
            getRowKey={(row) => row.id}
            onRowClick={(row) => router.push(`/supplier/ordini/${row.id}`)}
            emptyMessage="Nessun ordine ricevuto ancora."
          />
        </DarkCard>

        {/* Top Products */}
        <DarkCard>
          <DarkCardHeader>
            <DarkCardTitle>Prodotti piu richiesti</DarkCardTitle>
          </DarkCardHeader>
          {topProducts.length > 0 ? (
            <MiniBar items={topProducts} color="var(--color-accent-green)" />
          ) : (
            <p className="text-sm text-text-tertiary py-6 text-center">
              I dati saranno disponibili dopo i primi ordini.
            </p>
          )}
        </DarkCard>
      </div>

      {/* Row 4: Top Clienti + Top Prodotti (Task 12) */}
      {(topClientsList.length > 0 || topProductsList.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Clienti ranked */}
          <DarkCard>
            <DarkCardHeader>
              <DarkCardTitle>Top clienti (mese)</DarkCardTitle>
              <span className="text-xs text-text-tertiary">
                {topClientsList.length > 0 ? `Top ${topClientsList.length}` : ""}
              </span>
            </DarkCardHeader>
            {topClientsList.length > 0 ? (
              <ul className="space-y-2">
                {topClientsList.map((c, i) => {
                  const pct = topClientsMax > 0 ? (c.revenue / topClientsMax) * 100 : 0;
                  return (
                    <li
                      key={c.restaurant_id}
                      className="relative rounded-xl bg-surface-hover/40 border border-border-subtle/50 p-3 overflow-hidden"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-accent-blue/10"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-accent-blue-muted flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-accent-blue">
                            {i + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {c.name}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {c.orders} ordin{c.orders === 1 ? "e" : "i"}
                          </p>
                        </div>
                        <span className="text-sm font-mono font-semibold text-text-primary whitespace-nowrap">
                          {formatCurrency(c.revenue)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary py-6 text-center">
                Nessun ordine questo mese.
              </p>
            )}
          </DarkCard>

          {/* Top Prodotti ranked */}
          <DarkCard>
            <DarkCardHeader>
              <DarkCardTitle>Top prodotti (mese)</DarkCardTitle>
              <span className="text-xs text-text-tertiary">
                {topProductsList.length > 0 ? `Top ${topProductsList.length}` : ""}
              </span>
            </DarkCardHeader>
            {topProductsList.length > 0 ? (
              <ul className="space-y-2">
                {topProductsList.map((p, i) => {
                  const pct = topProductsMax > 0 ? (p.revenue / topProductsMax) * 100 : 0;
                  return (
                    <li
                      key={p.product_id}
                      className="relative rounded-xl bg-surface-hover/40 border border-border-subtle/50 p-3 overflow-hidden"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-accent-green/10"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-accent-green-muted flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-accent-green">
                            {i + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {p.quantity.toLocaleString("it-IT", {
                              maximumFractionDigits: 2,
                            })} unità
                          </p>
                        </div>
                        <span className="text-sm font-mono font-semibold text-text-primary whitespace-nowrap">
                          {formatCurrency(p.revenue)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-text-tertiary py-6 text-center">
                Nessun prodotto venduto questo mese.
              </p>
            )}
          </DarkCard>
        </div>
      )}

      {/* Row 5: Consegne recenti (Task 12) */}
      {recentDeliveriesList.length > 0 && (
        <DarkCard>
          <DarkCardHeader>
            <DarkCardTitle>Consegne recenti</DarkCardTitle>
            <Link
              href="/supplier/consegne"
              className="text-xs text-text-link hover:text-accent-green transition-colors"
            >
              Vedi tutte →
            </Link>
          </DarkCardHeader>
          <ul className="divide-y divide-border-subtle/60">
            {recentDeliveriesList.map((d) => {
              const meta = DELIVERY_STATUS_META[d.status] ?? DELIVERY_STATUS_META.planned;
              const isDelivered = d.status === "delivered";
              const isInTransit = d.status === "in_transit";
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="h-8 w-8 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
                    {isDelivered ? (
                      <CelebrationCheck size={20} />
                    ) : (
                      <Truck className="h-4 w-4 text-text-tertiary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {d.restaurant_name}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {formatDeliveryWhen(d)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.text} ${meta.bg}`}
                  >
                    {isInTransit ? (
                      <PulseDot variant="live" size={6} />
                    ) : (
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    )}
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </DarkCard>
      )}

      {/* Fallback: legacy topClients (empty state backward compat) */}
      {topClientsList.length === 0 && topClients.length > 0 && (
        <DarkCard>
          <DarkCardHeader>
            <DarkCardTitle>Top Clienti</DarkCardTitle>
          </DarkCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topClients.map((client, i) => (
              <motion.div
                key={client.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-hover/50"
              >
                <div className="h-9 w-9 rounded-lg bg-accent-blue-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-accent-blue">
                    {client.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{client.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {client.orders} ordini · {formatCurrency(client.total)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </DarkCard>
      )}
    </motion.div>
  );
}
