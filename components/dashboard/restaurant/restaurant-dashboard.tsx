// components/dashboard/restaurant/restaurant-dashboard.tsx
//
// Restaurant dashboard — Fernly layout (spec §6):
//   KPI row (spesa del mese hero · ordini · in consegna · in attesa)
//   Andamento spesa (weekday pill bars) · Prossima consegna · Fornitori
//   Ordini recenti · Budget del mese (gauge) · Fine mese (live countdown)
// Every figure comes from the server props built in app/(app)/dashboard/page.tsx.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Plus,
  Store,
  Truck,
  Receipt,
  Upload,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { PageHeader } from "@/components/ui/page-header";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { Chips } from "@/components/fernly/chips";
import { KpiCard } from "@/components/fernly/kpi-card";
import { PillBars, type PillBar } from "@/components/fernly/pill-bars";
import { SemiGauge } from "@/components/fernly/gauge";
import { CountUp } from "@/components/fernly/count-up";
import { useWeekStartsOn } from "@/components/fernly/appearance-provider";
import {
  Avatar,
  CardEmpty,
  DeltaChip,
  FCard,
  IconTile,
  LegendDot,
  OrderStatusPill,
  riseStyle,
} from "@/components/fernly/primitives";
import type { SpendTrendPoint } from "./spend-trend-chart/types";
import { SpendTrendChart } from "./spend-trend-chart/SpendTrendChart";
import {
  readInitialVatMode,
  persistVatMode,
  type VatMode,
} from "./_awwwards/vat-toggle";

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

export type DashboardStatusMix = {
  /** This month's orders confirmed or travelling. */
  inDelivery: number;
  /** This month's orders waiting for a supplier confirmation. */
  awaiting: number;
  /** Net spend of this month's delivered/closed orders. */
  closedSpend: number;
  /** Net spend of this month's open (not closed, not cancelled) orders. */
  openSpend: number;
};

export type DashboardDelivery = {
  orderId: string;
  supplierName: string;
  date: string; // YYYY-MM-DD
  status: string;
};

export type DashboardSupplier = {
  id: string;
  name: string;
  itemCount: number;
  deliveryDays: number | null;
  updatedAt: string;
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
  monthlyBudget: number | null;
  statusMix: DashboardStatusMix;
  nextDelivery: DashboardDelivery | null;
  upcomingCount: number;
  suppliers: DashboardSupplier[];
};

const IT_WEEKDAY_INITIAL = ["D", "L", "M", "M", "G", "V", "S"]; // JS getDay() order

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pctDelta(current: number, previous: number): { label: string; up: boolean | null } {
  if (previous === 0) return current === 0 ? { label: "0%", up: null } : { label: "nuovo", up: true };
  const d = ((current - previous) / previous) * 100;
  return { label: `${Math.abs(Math.round(d))}%`, up: d >= 0 };
}

const euro0 = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
} as Intl.NumberFormatOptions);

function useNow(intervalMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function RestaurantDashboard({
  companyName,
  kpi,
  fiscal,
  spendPoints,
  spendPointsGross,
  transactionsByDate,
  recentOrders,
  monthlyBudget,
  statusMix,
  nextDelivery,
  upcomingCount,
  suppliers,
}: Props) {
  // IVA toggle — "net" on first render (matches SSR), then the saved choice.
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
  const effPoints = gross ? spendPointsGross : spendPoints;

  const spendDelta = pctDelta(effSpending, effPrevSpending);
  const orderDiff = kpi.ordersThisMonth - kpi.prevMonthOrders;

  async function handleRefresh() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.pathname + url.search);
    }
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader
          title="Dashboard"
          subtitle={`${companyName} — ordini, consegne e spesa della cucina, in un unico posto.`}
          meta={
            <Chips
              size="sm"
              ariaLabel="Visualizzazione IVA"
              value={vatMode}
              onChange={handleVatChange}
              options={[
                { value: "net", label: "Senza IVA" },
                { value: "gross", label: "Con IVA" },
              ]}
            />
          }
          actions={
            <>
              <Link href="/cerca" className="f-btn f-btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.2} /> Nuovo ordine
              </Link>
              <Link href="/cataloghi" className="f-btn f-btn-outline">
                <Upload className="h-4 w-4" /> Importa listino
              </Link>
            </>
          }
        />

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
          <KpiCard
            hero
            index={0}
            title="Spesa del mese"
            value={effSpending}
            format="currency0"
            href="/analytics"
            caption={
              <>
                <DeltaChip inverted value={spendDelta.label} up={spendDelta.up} />
                <span>rispetto al mese scorso</span>
              </>
            }
          />
          <KpiCard
            index={1}
            title="Ordini del mese"
            value={kpi.ordersThisMonth}
            href="/ordini"
            caption={
              <>
                <DeltaChip value={String(Math.abs(orderDiff))} up={orderDiff === 0 ? null : orderDiff > 0} />
                <span>{orderDiff >= 0 ? "in più" : "in meno"} del mese scorso</span>
              </>
            }
          />
          <KpiCard
            index={2}
            title="In consegna"
            value={statusMix.inDelivery}
            href="/ordini?status=confirmed,in_transit,packed,preparing,shipped,shipping"
            caption={<span>Confermati o in viaggio</span>}
          />
          <KpiCard
            index={3}
            title="In attesa"
            value={statusMix.awaiting}
            href="/ordini?status=pending,pending_confirmation,submitted"
            caption={<span className="font-medium text-[var(--acc-700)]">Attendono conferma</span>}
          />
        </div>

        {/* Main grid */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-4">
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:gap-4 md:grid-cols-12 xl:col-span-3">
            <SpendBarsCard points={effPoints} index={4} />
            <NextDeliveryCard delivery={nextDelivery} upcomingCount={upcomingCount} index={5} />
            <RecentOrdersCard rows={recentOrders} gross={gross} index={7} />
            <BudgetCard
              budget={monthlyBudget}
              spent={kpi.spending}
              closed={statusMix.closedSpend}
              open={statusMix.openSpend}
              index={8}
            />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:gap-4 md:grid-cols-2 xl:flex xl:flex-col">
            <SuppliersCard suppliers={suppliers} index={6} />
            <MonthEndCard spent={effSpending} budget={gross ? null : monthlyBudget} index={9} />
          </div>
        </div>

        {/* Below the fold: full spend trend (period toggle) + POS takings */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-3">
          <FCard index={10} className="xl:col-span-2 !p-0 overflow-hidden" ariaLabel="Trend spesa">
            <SpendTrendChart points={effPoints} transactionsByDate={transactionsByDate} bare />
          </FCard>
          <FiscalCard fiscal={fiscal} index={11} />
        </div>
      </div>
    </PullToRefresh>
  );
}

/* ------------------------------------------------------------------ */

function SpendBarsCard({ points, index }: { points: SpendTrendPoint[]; index: number }) {
  const weekStartsOn = useWeekStartsOn();
  const now = useNow(60_000);

  const bars = useMemo<PillBar[] | null>(() => {
    if (!now) return null;
    const byDate = new Map(points.map((p) => [p.date, p.value]));
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const offset = (today.getDay() - weekStartsOn + 7) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - offset);

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const prev = new Date(d);
      prev.setDate(d.getDate() - 7);
      const key = toKey(d);
      return {
        d,
        key,
        value: byDate.get(key) ?? 0,
        lastWeek: byDate.get(toKey(prev)) ?? 0,
        future: d.getTime() > today.getTime(),
        isToday: d.getTime() === today.getTime(),
      };
    });

    const elapsed = days.filter((x) => !x.future && !x.isToday && x.value > 0);
    const peak = elapsed.reduce<string | null>(
      (best, x) => (best === null || x.value > (days.find((y) => y.key === best)?.value ?? 0) ? x.key : best),
      null,
    );
    const longDay = (d: Date) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "short" }).format(d);

    return days.map((x) => {
      if (x.future) {
        return {
          key: x.key,
          label: IT_WEEKDAY_INITIAL[x.d.getDay()]!,
          value: x.lastWeek,
          kind: "hatched",
          title: `${longDay(x.d)} — non ancora trascorso · settimana scorsa ${formatCurrency(x.lastWeek)}`,
        } satisfies PillBar;
      }
      if (x.value <= 0 && !x.isToday) {
        return {
          key: x.key,
          label: IT_WEEKDAY_INITIAL[x.d.getDay()]!,
          value: 0,
          kind: "hatched",
          title: `${longDay(x.d)} — nessun ordine`,
        } satisfies PillBar;
      }
      return {
        key: x.key,
        label: IT_WEEKDAY_INITIAL[x.d.getDay()]!,
        value: x.value,
        kind: "filled",
        shade: x.isToday ? "light" : x.key === peak ? "dark" : "mid",
        badge: x.isToday ? euro0.format(x.value) : undefined,
        title: `${longDay(x.d)} — ${formatCurrency(x.value)}`,
      } satisfies PillBar;
    });
  }, [points, now, weekStartsOn]);

  const weekTotal = bars?.filter((b) => b.kind === "filled").reduce((s, b) => s + b.value, 0) ?? 0;

  return (
    <FCard
      index={index}
      className="md:col-span-12 lg:col-span-7 xl:col-span-8"
      title="Andamento spesa"
      action={
        <span className="text-[12.5px] text-[var(--f-muted)]">
          Settimana: <span className="font-semibold text-[var(--f-ink)] tabular-nums">{euro0.format(weekTotal)}</span>
        </span>
      }
    >
      <div className="pt-6">
        {bars ? <PillBars bars={bars} height={180} /> : <div style={{ height: 211 }} />}
      </div>
    </FCard>
  );
}

function NextDeliveryCard({
  delivery,
  upcomingCount,
  index,
}: {
  delivery: DashboardDelivery | null;
  upcomingCount: number;
  index: number;
}) {
  const when = delivery
    ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(
        new Date(`${delivery.date}T12:00:00`),
      )
    : null;
  return (
    <FCard index={index} className="md:col-span-12 lg:col-span-5 xl:col-span-4" title="Prossima consegna">
      <div className="flex h-full flex-col">
        {delivery ? (
          <>
            <p className="line-clamp-2 text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--acc-ink)]">
              {delivery.supplierName}
            </p>
            <p className="mt-2 text-[13px] text-[var(--f-muted)]">
              Prevista: <span className="capitalize">{when}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--f-muted)]">
              Stato: {getOrderStatusMeta(delivery.status).label}
              {upcomingCount > 1 ? ` · altre ${upcomingCount - 1} in arrivo` : ""}
            </p>
            <div className="mt-auto pt-6">
              <Link href={`/ordini/${delivery.orderId}`} className="f-btn f-btn-primary f-btn-block">
                <Truck className="h-4 w-4" /> Apri ordine
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--acc-ink)]">
              Nessuna consegna in programma
            </p>
            <p className="mt-2 text-[13px] text-[var(--f-muted)]">
              Quando un fornitore indica una data di consegna, la trovi qui.
            </p>
            <div className="mt-auto pt-6">
              <Link href="/cerca" className="f-btn f-btn-primary f-btn-block">
                <Plus className="h-4 w-4" /> Nuovo ordine
              </Link>
            </div>
          </>
        )}
      </div>
    </FCard>
  );
}

function SuppliersCard({ suppliers, index }: { suppliers: DashboardSupplier[]; index: number }) {
  return (
    <FCard
      index={index}
      className="xl:flex-1"
      title="Fornitori"
      action={
        <Link href="/fornitori" className="f-btn f-btn-xs f-btn-outline">
          <Plus className="h-3.5 w-3.5" /> Nuovo
        </Link>
      }
    >
      {suppliers.length === 0 ? (
        <CardEmpty action={<Link href="/fornitori" className="f-btn f-btn-sm f-btn-primary">Aggiungi listino</Link>}>
          Nessun fornitore ancora: importa il primo listino.
        </CardEmpty>
      ) : (
        <ul className="-mx-1 space-y-1">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Link
                href={`/cataloghi/${s.id}`}
                className="flex items-center gap-3 rounded-[12px] px-1 py-1.5 transition-colors hover:bg-[var(--f-fill)]"
              >
                <IconTile seed={s.name} size={34}>
                  <Store className="h-4 w-4" />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[var(--f-ink)]">{s.name}</span>
                  <span className="block truncate text-[12px] text-[var(--f-muted)]">
                    {s.itemCount} prodott{s.itemCount === 1 ? "o" : "i"}
                    {s.deliveryDays !== null ? ` · consegna in ${s.deliveryDays}g` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FCard>
  );
}

function RecentOrdersCard({ rows, gross, index }: { rows: OrderRow[]; gross: boolean; index: number }) {
  const shown = rows.slice(0, 4);
  return (
    <FCard
      index={index}
      className="md:col-span-12 lg:col-span-7"
      title="Ordini recenti"
      action={
        <Link href="/ordini" className="f-btn f-btn-xs f-btn-outline">
          Vedi tutti
        </Link>
      }
    >
      {shown.length === 0 ? (
        <CardEmpty action={<Link href="/cerca" className="f-btn f-btn-sm f-btn-primary">Cerca prodotti</Link>}>
          Nessun ordine ancora.
        </CardEmpty>
      ) : (
        <ul className="space-y-1">
          {shown.map((o) => {
            const name = o.supplier_name !== "—" ? o.supplier_name : `Ordine ${o.order_number}`;
            const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" }).format(new Date(o.created_at));
            return (
              <li key={o.id}>
                <Link
                  href={`/ordini/${o.id}`}
                  className="-mx-1 flex items-center gap-3 rounded-[12px] px-1 py-1.5 transition-colors hover:bg-[var(--f-fill)]"
                >
                  <Avatar name={name} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[var(--f-ink)]">{name}</span>
                    <span className="block truncate text-[12px] text-[var(--f-muted)]">
                      {date} · totale{" "}
                      <b className="font-semibold text-[var(--f-ink-2)] tabular-nums">
                        {formatCurrency(o.total)}
                      </b>
                      {gross ? " IVA incl." : ""}
                    </span>
                  </span>
                  <OrderStatusPill status={o.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </FCard>
  );
}

function BudgetCard({
  budget,
  spent,
  closed,
  open,
  index,
}: {
  budget: number | null;
  spent: number;
  closed: number;
  open: number;
  index: number;
}) {
  return (
    <FCard index={index} className="md:col-span-12 lg:col-span-5" title="Budget del mese">
      {budget === null || budget <= 0 ? (
        <CardEmpty
          action={
            <Link href="/impostazioni/budget" className="f-btn f-btn-sm f-btn-primary">
              <Wallet className="h-3.5 w-3.5" /> Imposta budget
            </Link>
          }
        >
          Imposta un budget mensile per vedere quanto hai già impegnato.
        </CardEmpty>
      ) : (
        <BudgetGauge budget={budget} spent={spent} closed={closed} open={open} />
      )}
    </FCard>
  );
}

function BudgetGauge({ budget, spent, closed, open }: { budget: number; spent: number; closed: number; open: number }) {
  const denom = Math.max(budget, spent, 1);
  const remaining = Math.max(0, budget - spent);
  // Gauge segments are shares of the half circle; closed + open sum to the
  // spend that the order statuses account for.
  const accounted = closed + open || spent;
  const scale = accounted > 0 ? spent / accounted : 0;
  const pct = (spent / budget) * 100;
  return (
    <div className="flex flex-col items-center">
      <SemiGauge
        width={250}
        segments={[
          { value: (closed * scale) / denom, color: "var(--acc-600)", label: "Consegnato" },
          { value: (open * scale) / denom, color: "var(--acc-900)", label: "In corso" },
          { value: remaining / denom, hatch: true, label: "Residuo" },
        ]}
        center={<CountUp value={pct} format="percent" />}
        caption={`di ${euro0.format(budget)} · IVA esclusa`}
      />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <LegendDot color="var(--acc-600)">Consegnato</LegendDot>
        <LegendDot color="var(--acc-900)">In corso</LegendDot>
        <LegendDot hatch>Residuo</LegendDot>
      </div>
    </div>
  );
}

function MonthEndCard({ spent, budget, index }: { spent: number; budget: number | null; index: number }) {
  const now = useNow(1000);
  let label = "--:--:--";
  let days = 0;
  let elapsedDays = 1;
  if (now) {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = Math.max(0, end.getTime() - now.getTime());
    days = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const sec = Math.floor((diff % 60_000) / 1000);
    label = [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
    elapsedDays = Math.max(1, now.getDate());
  }
  const perDay = spent / elapsedDays;
  return (
    <section
      className="f-card f-deep f-rise relative flex min-h-[188px] flex-col overflow-hidden p-5"
      style={riseStyle(index)}
      aria-label="Tempo alla chiusura del mese"
    >
      <h2 className="text-[16px] font-medium text-white/90">Fine mese tra</h2>
      <div className="mt-2 flex items-baseline gap-2 text-white" suppressHydrationWarning>
        <span className="text-[20px] font-medium tabular-nums text-white/70">{now ? `${days}g` : ""}</span>
        <span className="text-[38px] font-medium leading-none tracking-[-0.03em] tabular-nums">{label}</span>
      </div>
      <p className="mt-2 text-[12px] text-white/60">
        Speso {euro0.format(spent)} · {euro0.format(perDay)}/giorno
        {budget ? ` · budget ${euro0.format(budget)}` : ""}
      </p>
      <div className="mt-auto flex items-center justify-center gap-3 pt-4">
        <Link
          href="/analytics"
          aria-label="Apri analytics"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff] text-[var(--acc-950)] transition-transform hover:scale-105"
        >
          <BarChart3 className="h-[18px] w-[18px]" />
        </Link>
        <Link
          href="/impostazioni/budget"
          aria-label="Budget mensile"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--acc-600)] text-white transition-transform hover:scale-105"
        >
          <ArrowUpRight className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </section>
  );
}

function FiscalCard({ fiscal, index }: { fiscal: FiscalSummary; index: number }) {
  const href = fiscal.restaurantId ? `/finanze?r=${fiscal.restaurantId}` : "/finanze";
  if (!fiscal.enabled) {
    return (
      <FCard index={index} title="Incassi POS">
        <CardEmpty
          action={
            <Link
              href={fiscal.restaurantId ? `/finanze/integrazioni?r=${fiscal.restaurantId}` : "/finanze"}
              className="f-btn f-btn-sm f-btn-primary"
            >
              <Receipt className="h-3.5 w-3.5" /> Attiva cassetto fiscale
            </Link>
          }
        >
          Collega una cassa POS per vedere incasso, food cost, scontrini e coperti qui in automatico.
        </CardEmpty>
      </FCard>
    );
  }
  const stats: Array<{ label: string; node: React.ReactNode }> = [
    { label: "Incasso", node: <CountUp value={fiscal.revenueCents / 100} format="currency0" /> },
    {
      label: "Food cost",
      node: fiscal.foodCostPct === null ? "—" : <CountUp value={fiscal.foodCostPct} format="percent" />,
    },
    { label: "Scontrini", node: <CountUp value={fiscal.receipts} /> },
    { label: "Coperti", node: <CountUp value={fiscal.covers} /> },
  ];
  return (
    <FCard
      index={index}
      title="Incassi POS · 30 giorni"
      action={
        <Link href={href} className="f-btn f-btn-xs f-btn-outline">
          Finanze
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] bg-[var(--f-fill)] px-3.5 py-3">
            <div className="text-[12px] text-[var(--f-muted)]">{s.label}</div>
            <div className="mt-1 text-[22px] font-medium tracking-[-0.03em] text-[var(--f-ink)] tabular-nums">{s.node}</div>
          </div>
        ))}
      </div>
    </FCard>
  );
}
