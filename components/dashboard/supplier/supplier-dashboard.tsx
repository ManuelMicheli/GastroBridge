"use client";

import { motion } from "motion/react";
import {
  ClipboardList, TrendingUp, Users, Package,
  Plus, MapPin, BarChart3, Star,
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
  };
  revenueSparkline: number[];
  chartData: Array<{ label: string; value: number }>;
  recentOrders: OrderRow[];
  topProducts: TopProduct[];
  topClients: TopClient[];
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

export function SupplierDashboard({
  companyName,
  kpi,
  revenueSparkline,
  chartData,
  recentOrders,
  topProducts,
  topClients,
}: Props) {
  const router = useRouter();

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
