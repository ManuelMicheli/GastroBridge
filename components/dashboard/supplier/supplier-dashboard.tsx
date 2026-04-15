"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ClipboardList, TrendingUp, Users, Package,
  Plus, MapPin, BarChart3, Star,
  AlertTriangle, Clock, PackageX, Receipt, Hourglass,
} from "lucide-react";
import { KPICard } from "../cards/kpi-card";
import { DarkCard, DarkCardHeader, DarkCardTitle } from "../cards/dark-card";
import { QuickAction } from "../cards/quick-action";
import { AreaChart } from "../charts/area-chart";
import { MiniBar } from "../charts/mini-bar";
import { StatusBadge } from "../tables/status-badge";
import { DataTable, type Column } from "../tables/data-table";
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
};

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
}: Props) {
  const router = useRouter();
  const alertItems = buildAlerts(alerts);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Ciao, {companyName}
        </h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Ecco il riepilogo della tua attivita.
        </p>
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
          <div className="px-2 pb-3">
            <AreaChart data={chartData} height={220} color="var(--color-accent-orange)" />
          </div>
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

      {/* Row 4: Top Clients */}
      {topClients.length > 0 && (
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
