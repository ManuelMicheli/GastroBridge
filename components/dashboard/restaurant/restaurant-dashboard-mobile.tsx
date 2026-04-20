"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils/formatters";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { VatToggle, type VatMode } from "./_awwwards/vat-toggle";

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
  firstName?: string;
  kpi: {
    ordersThisMonth: number;
    prevMonthOrders: number;
    spending: number;
    prevSpending: number;
    savings: number;
    activeSuppliers: number;
  };
  recentOrders: OrderRow[];
  vatMode?: VatMode;
  onVatModeChange?: (v: VatMode) => void;
};

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buonanotte";
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function deltaPct(current: number, previous: number): {
  text: string;
  positive: boolean;
  neutral: boolean;
} {
  if (previous === 0) {
    if (current === 0) return { text: "—", positive: true, neutral: true };
    return { text: "+100%", positive: true, neutral: false };
  }
  const d = ((current - previous) / previous) * 100;
  const pct = Math.abs(Math.round(d));
  return {
    text: `${d >= 0 ? "+" : "−"}${pct}%`,
    positive: d >= 0,
    neutral: pct === 0,
  };
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function RestaurantDashboardMobile({
  companyName,
  firstName,
  kpi,
  recentOrders,
  vatMode,
  onVatModeChange,
}: Props) {
  const greeting = greetingByHour();
  const todayStr = useMemo(
    () =>
      new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }).format(new Date()),
    []
  );

  const spendDelta = deltaPct(kpi.spending, kpi.prevSpending);
  const ordersDelta = deltaPct(kpi.ordersThisMonth, kpi.prevMonthOrders);
  const openOrders = recentOrders.filter(
    (o) => !["delivered", "completed", "cancelled", "rejected"].includes(o.status)
  ).length;
  const top3 = recentOrders.slice(0, 4);

  async function handleRefresh() {
    // Hard refresh via navigation — server components refetch.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.pathname + url.search);
    }
  }

  const titleName = firstName || companyName.split(" ")[0] || "";

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-4">
        <LargeTitle
          eyebrow={<span className="capitalize">{todayStr}</span>}
          title={
            <span>
              {greeting},
              <br />
              {titleName}.
            </span>
          }
          subtitle={
            openOrders > 0
              ? `${openOrders} ordin${openOrders === 1 ? "e" : "i"} aperti`
              : "Nessun ordine aperto al momento"
          }
        />

        {/* IVA toggle — sits just above the KPI grid so the user sees
            immediately which view the totals reflect. */}
        {vatMode && onVatModeChange ? (
          <div className="mt-4 flex items-center justify-between px-[10px]">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
              Vista IVA
            </span>
            <VatToggle value={vatMode} onChange={onVatModeChange} size="xs" />
          </div>
        ) : null}

        {/* KPI grid — edge-to-edge hairline */}
        <div
          className="mt-3 grid grid-cols-2 gap-px border-t border-b border-[color:var(--ios-separator)] bg-[color:var(--ios-separator)]"
        >
          <div className="bg-[color:var(--ios-grouped-bg)] px-5 py-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
              Speso mese{" "}
              <span className="text-[color:var(--text-muted-light)] normal-case tracking-normal">
                ({vatMode === "gross" ? "IVA incl." : "no IVA"})
              </span>
            </div>
            <div
              className="mt-1 font-serif text-[22px] font-medium tracking-[-0.018em] text-[color:var(--color-brand-primary)]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {formatCurrency(kpi.spending)}
            </div>
            <div
              className={
                "mt-0.5 text-[11px] " +
                (spendDelta.neutral
                  ? "text-[color:var(--text-muted-light)]"
                  : !spendDelta.positive
                    ? "text-[#1A8F50]"
                    : "text-[#B8621E]")
              }
            >
              {spendDelta.text} vs mese prec.
            </div>
          </div>
          <div className="bg-[color:var(--ios-grouped-bg)] px-5 py-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
              Ordini
            </div>
            <div
              className="mt-1 font-serif text-[22px] font-medium tracking-[-0.018em] text-[color:var(--color-brand-primary)]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {kpi.ordersThisMonth}
            </div>
            <div className="mt-0.5 text-[11px] text-[color:var(--text-muted-light)]">
              {ordersDelta.text} · {kpi.activeSuppliers} fornitori
            </div>
          </div>
        </div>

        {/* Risparmio highlight se > 0 */}
        {kpi.savings > 0 && (
          <div className="mt-2 px-[10px]">
            <div
              className="rounded-xl bg-gradient-to-br from-[color:var(--color-brand-primary-subtle)] to-transparent px-4 py-3 ring-[0.5px] ring-[color:var(--color-brand-primary-border)]"
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
                Risparmiato
              </div>
              <div
                className="mt-1 font-serif text-[20px] font-medium text-[color:var(--color-brand-primary)]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {formatCurrency(kpi.savings)}
              </div>
              <p className="mt-0.5 text-[11px] text-[color:var(--text-muted-light)]">
                Confrontando prezzi dei fornitori.
              </p>
            </div>
          </div>
        )}

        {/* Ordini recenti */}
        <GroupedList
          className="mt-2"
          label="Attività recente"
          labelAction={
            top3.length > 0 ? (
              <Link
                href="/ordini"
                className="text-[11px] text-[color:var(--color-brand-primary)]"
              >
                Vedi tutti →
              </Link>
            ) : null
          }
        >
          {top3.length === 0 ? (
            <GroupedListRow
              title={
                <span className="text-[color:var(--text-muted-light)]">
                  Nessun ordine ancora
                </span>
              }
              subtitle={
                <Link
                  href="/cerca"
                  className="text-[color:var(--color-brand-primary)]"
                >
                  Inizia a cercare prodotti →
                </Link>
              }
            />
          ) : (
            top3.map((o) => (
              <GroupedListRow
                key={o.id}
                href={`/ordini/${o.id}`}
                leading={
                  <div
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] font-serif text-[10px] font-medium text-[color:var(--color-brand-on-primary)]"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {initials(o.supplier_name)}
                  </div>
                }
                title={o.supplier_name}
                subtitle={
                  <span className="font-mono">
                    {o.order_number} · {formatShortDate(o.created_at)} ·{" "}
                    {formatCurrency(o.total)}
                  </span>
                }
                trailing={<OrderStatusBadge status={o.status} size="xs" />}
              />
            ))
          )}
        </GroupedList>

        {/* Quick jumps */}
        <GroupedList className="mt-2" label="Azioni veloci">
          <GroupedListRow
            href="/cerca"
            leading={
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[color:var(--color-brand-primary)] text-white"
                aria-hidden="true"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <circle
                    cx="7"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="m10 10 3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            }
            title="Cerca prodotti"
            subtitle="Confronta prezzi tra fornitori"
            showChevron
          />
          <GroupedListRow
            href="/carrello"
            leading={
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[color:var(--color-brand-primary)] text-white"
                aria-hidden="true"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path
                    d="M2 3h2l1.5 9h8L15 5H5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="14" r="1" fill="currentColor" />
                  <circle cx="12" cy="14" r="1" fill="currentColor" />
                </svg>
              </div>
            }
            title="Carrello"
            subtitle="Rivedi e conferma ordini"
            showChevron
          />
          <GroupedListRow
            href="/fornitori"
            leading={
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[#2B6F42] text-white"
                aria-hidden="true"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path
                    d="M2 6h12v7H2zM4 6V3h8v3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            }
            title="Fornitori"
            subtitle={`${kpi.activeSuppliers} partnership attive`}
            showChevron
          />
        </GroupedList>
      </div>
    </PullToRefresh>
  );
}
