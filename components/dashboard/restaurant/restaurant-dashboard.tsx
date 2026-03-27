"use client";

import { motion } from "motion/react";
import {
  ClipboardList, ShoppingCart, TrendingDown, Store,
  Search, Truck, HelpCircle,
} from "lucide-react";
import { KPICard } from "../cards/kpi-card";
import { DarkCard, DarkCardHeader, DarkCardTitle } from "../cards/dark-card";
import { QuickAction } from "../cards/quick-action";
import { AreaChart } from "../charts/area-chart";
import { StatusBadge } from "../tables/status-badge";
import { DataTable, type Column } from "../tables/data-table";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useRouter } from "next/navigation";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  supplier_name: string;
};

type Props = {
  companyName: string;
  kpi: {
    ordersThisMonth: number;
    prevMonthOrders: number;
    spending: number;
    prevSpending: number;
    savings: number;
    activeSuppliers: number;
  };
  spendingSparkline: number[];
  chartData: Array<{ label: string; value: number }>;
  recentOrders: OrderRow[];
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const columns: Column<OrderRow>[] = [
  {
    key: "supplier",
    label: "Fornitore",
    render: (row) => <span className="text-text-primary font-medium">{row.supplier_name}</span>,
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

export function RestaurantDashboard({ companyName, kpi, spendingSparkline, chartData, recentOrders }: Props) {
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
          label="Ordini questo mese"
          value={kpi.ordersThisMonth.toString()}
          numericValue={kpi.ordersThisMonth}
          previousValue={kpi.prevMonthOrders}
          icon={ClipboardList}
          sparklineData={spendingSparkline.map(() => Math.floor(Math.random() * 5) + 1)}
        />
        <KPICard
          label="Spesa totale"
          value={`€${kpi.spending.toLocaleString("it-IT")}`}
          numericValue={kpi.spending}
          previousValue={kpi.prevSpending}
          icon={ShoppingCart}
          accentColor="var(--color-accent-orange)"
          sparklineData={spendingSparkline}
        />
        <KPICard
          label="Risparmio stimato"
          value={`€${kpi.savings.toLocaleString("it-IT")}`}
          numericValue={kpi.savings}
          icon={TrendingDown}
          accentColor="var(--color-accent-green)"
        />
        <KPICard
          label="Fornitori attivi"
          value={kpi.activeSuppliers.toString()}
          numericValue={kpi.activeSuppliers}
          icon={Store}
          accentColor="var(--color-accent-blue)"
        />
      </div>

      {/* Row 2: Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spending Chart */}
        <DarkCard className="lg:col-span-2" noPadding>
          <div className="p-5 pb-0">
            <DarkCardHeader>
              <DarkCardTitle>Andamento Spesa</DarkCardTitle>
              <span className="text-xs text-text-tertiary">Ultimi 30 giorni</span>
            </DarkCardHeader>
          </div>
          <div className="px-2 pb-3">
            <AreaChart data={chartData} height={220} />
          </div>
        </DarkCard>

        {/* Quick Actions */}
        <DarkCard>
          <DarkCardHeader>
            <DarkCardTitle>Azioni rapide</DarkCardTitle>
          </DarkCardHeader>
          <div className="space-y-2">
            <QuickAction href="/cerca" label="Cerca prodotti" description="Confronta prezzi" icon={Search} index={0} />
            <QuickAction href="/fornitori" label="Scopri fornitori" description="Nuovi partner" icon={Store} index={1} />
            <QuickAction href="/ordini" label="I tuoi ordini" description="Storico completo" icon={Truck} index={2} />
            <QuickAction href="/impostazioni" label="Impostazioni" description="Gestisci account" icon={HelpCircle} index={3} />
          </div>
        </DarkCard>
      </div>

      {/* Row 3: Recent Orders + Price Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders Table */}
        <DarkCard className="lg:col-span-2" noPadding>
          <div className="p-5 pb-0">
            <DarkCardHeader>
              <DarkCardTitle>Ordini recenti</DarkCardTitle>
              <button
                onClick={() => router.push("/ordini")}
                className="text-xs text-text-link hover:text-accent-green transition-colors"
              >
                Vedi tutti →
              </button>
            </DarkCardHeader>
          </div>
          <DataTable
            columns={columns}
            data={recentOrders}
            getRowKey={(row) => row.id}
            onRowClick={(row) => router.push(`/ordini/${row.id}`)}
            emptyMessage="Nessun ordine ancora. Inizia a cercare prodotti!"
          />
        </DarkCard>

        {/* Savings / Alerts */}
        <DarkCard>
          <DarkCardHeader>
            <DarkCardTitle>Alert Risparmio</DarkCardTitle>
          </DarkCardHeader>
          {kpi.savings > 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent-green-muted">
                <TrendingDown className="h-5 w-5 text-accent-green shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Potresti risparmiare ~{formatCurrency(kpi.savings)}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Basato sul confronto prezzi dei tuoi fornitori attuali
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary py-6 text-center">
              Gli alert saranno disponibili dopo i primi ordini.
            </p>
          )}
        </DarkCard>
      </div>
    </motion.div>
  );
}
