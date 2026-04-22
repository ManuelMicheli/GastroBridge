// components/dashboard/restaurant/restaurant-dashboard.tsx
//
// Restaurant "Operator Console" — awwwards-grade premium terminal-dense
// redesign. Orchestrates six blocks:
//   1. HeroStrip            — greeting · date · time + live pulse
//   2. QuickActionBar       — compact pill bar (replaces 4-tile grid)
//   3. KpiGrid + Savings    — big € number + 4 sub-KPIs + alert strip
//   4. SectionFrame + chart — terminal-framed SpendTrendChart
//   5. RecentOrdersLog      — dense 40px rows, /ordini-style
//
// Props shape is preserved: server fetch in app/(app)/dashboard/page.tsx is
// untouched. Motion/react stagger is dropped in favour of CSS fade-in-up.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SpendTrendChart } from "./spend-trend-chart/SpendTrendChart";
import type { SpendTrendPoint } from "./spend-trend-chart/types";
import { HeroStrip } from "./_awwwards/hero-strip";
import { QuickActionBar } from "./_awwwards/quick-action-bar";
import { KpiGrid, type Delta } from "./_awwwards/kpi-grid";
import { SavingsAlert } from "./_awwwards/savings-alert";
import { SectionFrame } from "./_awwwards/section-frame";
import { RecentOrdersLog } from "./_awwwards/recent-orders-log";
import {
  VatToggle,
  readInitialVatMode,
  persistVatMode,
  type VatMode,
} from "./_awwwards/vat-toggle";
import { RestaurantDashboardMobile } from "./restaurant-dashboard-mobile";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  totalGross: number;
  created_at: string;
  supplier_name: string;
  order_number: string;
};

type FiscalSummary = {
  enabled: boolean;
  revenueCents: number;
  foodCostPct: number | null;
  receipts: number;
  covers: number;
  restaurantId: string | null;
  revenueSpark: number[];
  receiptsSpark: number[];
  coversSpark: number[];
  foodCostSpark: number[];
};

type Props = {
  companyName: string;
  kpi: {
    ordersThisMonth: number;
    prevMonthOrders: number;
    spending: number;
    spendingGross: number;
    prevSpending: number;
    prevSpendingGross: number;
    savings: number;
    savingsGross: number;
    activeSuppliers: number;
  };
  fiscal: FiscalSummary;
  spendPoints: SpendTrendPoint[];
  spendPointsGross: SpendTrendPoint[];
  transactionsByDate: Record<string, number>;
  recentOrders: OrderRow[];
};

function formatDelta(current: number, previous: number): Delta {
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

function formatClock(d: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function RestaurantDashboard({
  companyName,
  kpi,
  fiscal,
  spendPoints,
  spendPointsGross,
  transactionsByDate,
  recentOrders,
}: Props) {
  // IVA toggle — default "net" on first render (matches SSR) then hydrates
  // from localStorage in a commit-phase effect to avoid hydration mismatch.
  const [vatMode, setVatMode] = useState<VatMode>("net");
  useEffect(() => {
    setVatMode(readInitialVatMode());
  }, []);
  const handleVatChange = (v: VatMode) => {
    setVatMode(v);
    persistVatMode(v);
  };
  const gross = vatMode === "gross";

  const effSpending = gross ? kpi.spendingGross : kpi.spending;
  const effPrevSpending = gross ? kpi.prevSpendingGross : kpi.prevSpending;
  const effSavings = gross ? kpi.savingsGross : kpi.savings;
  const effPoints = gross ? spendPointsGross : spendPoints;
  const effRecentOrders = useMemo(
    () =>
      recentOrders.map((o) => ({
        ...o,
        total: gross ? o.totalGross : o.total,
      })),
    [recentOrders, gross],
  );

  const ordersDelta = formatDelta(kpi.ordersThisMonth, kpi.prevMonthOrders);

  const avgOrder =
    kpi.ordersThisMonth > 0
      ? Math.round(effSpending / kpi.ordersThisMonth)
      : 0;
  const prevAvgOrder =
    kpi.prevMonthOrders > 0
      ? Math.round(effPrevSpending / kpi.prevMonthOrders)
      : 0;

  // Live clock for the "AS OF HH:mm" caption in the KPI hero.
  const [asOf, setAsOf] = useState<string>("——");
  useEffect(() => {
    const tick = () => setAsOf(formatClock(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {/* Mobile-first dashboard — iOS-style grouped lists.
          Desktop tree below renders on lg+ viewports. */}
      <div className="lg:hidden">
        <RestaurantDashboardMobile
          companyName={companyName}
          kpi={{
            ordersThisMonth: kpi.ordersThisMonth,
            prevMonthOrders: kpi.prevMonthOrders,
            spending: effSpending,
            prevSpending: effPrevSpending,
            savings: effSavings,
            activeSuppliers: kpi.activeSuppliers,
          }}
          recentOrders={effRecentOrders}
          vatMode={vatMode}
          onVatModeChange={handleVatChange}
        />
      </div>
      <div className="hidden lg:block">
        <div className="space-y-6">
          {/* Block 1 — Hero identity strip */}
          <HeroStrip
        companyName={companyName}
        subtitle="Ecco il riepilogo della tua attività di questo mese."
      />

      {/* Block 2 — Quick action pills */}
      <div className="animate-[fadeInUp_240ms_ease-out_both] [animation-delay:60ms]">
        <QuickActionBar />
      </div>

      {/* Block 3 — KPI summary (acquisti + incassi POS) + savings alert */}
      <div className="animate-[fadeInUp_260ms_ease-out_both] [animation-delay:120ms]">
        <SectionFrame
          label={`Sintesi · Questo mese · ${gross ? "Con IVA" : "Senza IVA"}`}
          trailing={
            <span className="inline-flex items-center gap-3">
              <VatToggle value={vatMode} onChange={handleVatChange} />
              <span className="tabular-nums">AS OF {asOf}</span>
            </span>
          }
          padded={false}
        >
          <div className="px-5 pt-5 pb-6 sm:px-6 sm:pt-6 sm:pb-7">
            <KpiGrid
              ordersThisMonth={kpi.ordersThisMonth}
              prevMonthOrders={kpi.prevMonthOrders}
              ordersDelta={ordersDelta}
              avgOrder={avgOrder}
              prevAvgOrder={prevAvgOrder}
              savings={effSavings}
              activeSuppliers={kpi.activeSuppliers}
              fiscal={fiscal}
            />
          </div>
          <div className="border-t border-border-subtle px-5 py-3 sm:px-6">
            <SavingsAlert savings={effSavings} />
          </div>
        </SectionFrame>
      </div>

      {/* Block 4 — Spend trend chart (own card, not wrapped in SectionFrame
          to preserve the chart's own header, period toggle, and in-view
          animations which break when placed inside another framed container). */}
      <div className="animate-[fadeInUp_280ms_ease-out_both] [animation-delay:180ms]">
        <SpendTrendChart
          points={effPoints}
          transactionsByDate={transactionsByDate}
        />
      </div>

      {/* Block 5 — Recent orders log */}
      <div className="animate-[fadeInUp_300ms_ease-out_both] [animation-delay:240ms]">
        <SectionFrame
          label="Ordini recenti"
          trailing={
            <Link
              href="/ordini"
              className="text-accent-green hover:text-text-primary transition-colors"
            >
              vedi tutti →
            </Link>
          }
          padded={false}
        >
          <div className="py-2">
            <RecentOrdersLog rows={effRecentOrders} />
          </div>
        </SectionFrame>
      </div>

          {/* Shared keyframes for stagger reveal — MUST be global so
              `className="animate-[fadeInUp_...]"` utilities can reference the
              raw keyframe name (styled-jsx scoped mode renames it). */}
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
