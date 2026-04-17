"use client";

import { motion } from "motion/react";
import {
  TrendingDown, Store,
  Search, Truck, HelpCircle, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { DarkCard, DarkCardHeader, DarkCardTitle } from "../cards/dark-card";
import { QuickAction } from "../cards/quick-action";
import { SpendTrendChart } from "./spend-trend-chart/SpendTrendChart";
import type { SpendTrendPoint } from "./spend-trend-chart/types";
import { StatusBadge } from "../tables/status-badge";
import { DataTable, type Column } from "../tables/data-table";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  supplier_name: string;
  order_number: string;
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
  spendPoints: SpendTrendPoint[];
  transactionsByDate: Record<string, number>;
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
  {
    key: "order_number",
    label: "Ordine",
    render: (row) => <span className="font-mono text-text-tertiary text-xs">{row.order_number}</span>,
  },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Buonanotte";
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function formatDelta(current: number, previous: number): { sign: "+" | "-" | ""; pct: string; positive: boolean } {
  if (previous === 0) {
    if (current === 0) return { sign: "", pct: "—", positive: true };
    return { sign: "+", pct: "100%", positive: true };
  }
  const delta = ((current - previous) / previous) * 100;
  const positive = delta >= 0;
  return {
    sign: positive ? "+" : "",
    pct: `${Math.abs(Math.round(delta))}%`,
    positive,
  };
}

export function RestaurantDashboard({ companyName, kpi, spendPoints, transactionsByDate, recentOrders }: Props) {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Ciao");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const spendingDelta = formatDelta(kpi.spending, kpi.prevSpending);
  const ordersDelta = formatDelta(kpi.ordersThisMonth, kpi.prevMonthOrders);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* Hero greeting */}
      <header>
        <p
          className="uppercase mb-2"
          style={{
            fontSize: "var(--text-caption)",
            lineHeight: "var(--text-caption--line-height)",
            letterSpacing: "var(--text-caption--letter-spacing)",
            fontWeight: "var(--text-caption--font-weight)",
            color: "var(--caption-color, var(--color-brand-depth))",
          }}
        >
          {greeting}
        </p>
        <h1
          className="font-display"
          style={{
            fontSize: "var(--text-display-lg)",
            lineHeight: "var(--text-display-lg--line-height)",
            letterSpacing: "var(--text-display-lg--letter-spacing)",
            fontWeight: "var(--text-display-lg--font-weight)",
            color: "var(--color-text-primary)",
          }}
        >
          {companyName}
        </h1>
        <p
          className="mt-1.5 text-text-secondary"
          style={{
            fontSize: "var(--text-body-sm)",
            lineHeight: "var(--text-body-sm--line-height)",
          }}
        >
          Ecco il riepilogo della tua attività di questo mese.
        </p>
      </header>

      {/* Row 1: Quick Actions — full-width horizontal strip */}
      <DarkCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/cerca" label="Cerca prodotti" description="Confronta prezzi" icon={Search} index={0} />
          <QuickAction href="/fornitori" label="Scopri fornitori" description="Nuovi partner" icon={Store} index={1} />
          <QuickAction href="/ordini" label="I tuoi ordini" description="Storico completo" icon={Truck} index={2} />
          <QuickAction href="/impostazioni" label="Impostazioni" description="Gestisci account" icon={HelpCircle} index={3} />
        </div>
      </DarkCard>

      {/* Hero KPI — single big number for spending + savings alert */}
      <DarkCard className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div>
            <p
              className="uppercase mb-3"
              style={{
                fontSize: "var(--text-caption)",
                letterSpacing: "var(--text-caption--letter-spacing)",
                fontWeight: "var(--text-caption--font-weight)",
                color: "var(--color-text-tertiary)",
              }}
            >
              Spesa di questo mese
            </p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span
                className="font-mono"
                style={{
                  fontSize: "var(--text-display-2xl)",
                  lineHeight: "var(--text-display-2xl--line-height)",
                  letterSpacing: "var(--text-display-2xl--letter-spacing)",
                  fontWeight: "var(--text-display-2xl--font-weight)",
                  color: "var(--color-text-primary)",
                }}
              >
                {formatCurrency(kpi.spending)}
              </span>
              {spendingDelta.pct !== "—" && (
                <span
                  className="inline-flex items-center gap-0.5"
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: 600,
                    color: spendingDelta.positive
                      ? "var(--color-text-warning)"
                      : "var(--color-success)",
                  }}
                >
                  {spendingDelta.positive ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {spendingDelta.pct} vs mese scorso
                </span>
              )}
            </div>
            <div className="mt-6 flex items-center gap-6 flex-wrap">
              <div>
                <p
                  className="uppercase mb-1"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "+0.04em",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  Ordini
                </p>
                <p className="font-mono text-text-primary" style={{ fontSize: "var(--text-title-lg)", fontWeight: 600 }}>
                  {kpi.ordersThisMonth}{" "}
                  <span className="text-xs font-normal" style={{ color: ordersDelta.positive ? "var(--color-success)" : "var(--color-text-warning)" }}>
                    {ordersDelta.sign}{ordersDelta.pct}
                  </span>
                </p>
              </div>
              <div className="h-10 w-px bg-[color:var(--color-border-subtle)]" aria-hidden />
              <div>
                <p
                  className="uppercase mb-1"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "+0.04em",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  Spesa media ordine
                </p>
                <p className="font-mono text-text-primary" style={{ fontSize: "var(--text-title-lg)", fontWeight: 600 }}>
                  {kpi.ordersThisMonth > 0
                    ? formatCurrency(Math.round(kpi.spending / kpi.ordersThisMonth))
                    : "€0"}
                </p>
              </div>
              <div className="h-10 w-px bg-[color:var(--color-border-subtle)]" aria-hidden />
              <div>
                <p
                  className="uppercase mb-1"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "+0.04em",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  Risparmio stimato
                </p>
                <p className="font-mono text-text-primary" style={{ fontSize: "var(--text-title-lg)", fontWeight: 600 }}>
                  {formatCurrency(kpi.savings)}
                </p>
              </div>
              <div className="h-10 w-px bg-[color:var(--color-border-subtle)]" aria-hidden />
              <div>
                <p
                  className="uppercase mb-1"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "+0.04em",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  Fornitori attivi
                </p>
                <p className="font-mono text-text-primary" style={{ fontSize: "var(--text-title-lg)", fontWeight: 600 }}>
                  {kpi.activeSuppliers}
                </p>
              </div>
            </div>
          </div>
          {/* Savings alert on right */}
          <div className="flex flex-col justify-center">
            <p
              className="uppercase mb-3"
              style={{
                fontSize: "var(--text-caption)",
                letterSpacing: "var(--text-caption--letter-spacing)",
                fontWeight: "var(--text-caption--font-weight)",
                color: "var(--color-text-tertiary)",
              }}
            >
              Alert risparmio
            </p>
            {kpi.savings > 0 ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent-green-muted">
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
            ) : (
              <p className="text-sm text-text-tertiary py-3">
                Gli alert saranno disponibili dopo i primi ordini.
              </p>
            )}
          </div>
        </div>
      </DarkCard>

      {/* Row 3: Spending trend — full width */}
      <SpendTrendChart points={spendPoints} transactionsByDate={transactionsByDate} />

      {/* Row 4: Recent Orders — full width */}
      <DarkCard noPadding>
        <div className="p-5 pb-0">
          <DarkCardHeader>
            <DarkCardTitle>Ordini recenti</DarkCardTitle>
            <button
              onClick={() => router.push("/ordini")}
              className="text-xs text-text-link hover:text-accent-green transition-colors uppercase"
              style={{
                letterSpacing: "var(--text-caption--letter-spacing)",
                fontWeight: "var(--text-caption--font-weight)",
              }}
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
    </motion.div>
  );
}
