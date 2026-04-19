"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Clock, PackageX } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  restaurant_name: string;
};

type TopClientRich = {
  restaurant_id: string;
  name: string;
  orders: number;
  revenue: number;
};

type Alert = {
  key: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  tone: "red" | "amber";
  icon: typeof AlertTriangle;
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
  };
  recentOrders: OrderRow[];
  topClients?: TopClientRich[];
  alerts?: Alert[];
};

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buonanotte";
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function shortDate(iso: string): string {
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

const TONE_BG: Record<Alert["tone"], string> = {
  red: "#C93737",
  amber: "#7A5B18",
};

export function SupplierDashboardMobile({
  companyName,
  kpi,
  recentOrders,
  topClients,
  alerts,
}: Props) {
  const greeting = greetingByHour();
  const todayStr = useMemo(
    () =>
      new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }).format(new Date()),
    [],
  );

  const titleName = companyName.split(" ")[0] || companyName;
  const revenueDelta =
    kpi.prevRevenue > 0
      ? ((kpi.monthlyRevenue - kpi.prevRevenue) / kpi.prevRevenue) * 100
      : 0;

  const top4Orders = recentOrders.slice(0, 4);
  const top4Clients = (topClients ?? []).slice(0, 4);

  async function handleRefresh() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.pathname + url.search);
    }
  }

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
            kpi.ordersToday > 0
              ? `${kpi.ordersToday} ordin${kpi.ordersToday === 1 ? "e" : "i"} oggi`
              : "Nessun ordine oggi"
          }
        />

        {alerts && alerts.length > 0 && (
          <GroupedList className="mt-3" label="Richiede attenzione">
            {alerts.map((a) => {
              const Icon = a.icon;
              return (
                <GroupedListRow
                  key={a.key}
                  href={a.href}
                  leading={
                    <div
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-white"
                      style={{ background: TONE_BG[a.tone] }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  }
                  title={a.title}
                  subtitle={a.description}
                  trailing={
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: TONE_BG[a.tone] }}
                    >
                      {a.cta}
                    </span>
                  }
                  showChevron
                />
              );
            })}
          </GroupedList>
        )}

        {/* KPI grid 2x2 */}
        <div className="mt-5 grid grid-cols-2 gap-px border-t border-b border-[color:var(--ios-separator)] bg-[color:var(--ios-separator)]">
          <div className="bg-[color:var(--ios-grouped-bg)] px-5 py-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
              Ricavi mese
            </div>
            <div
              className="mt-1 font-serif text-[22px] font-medium tracking-[-0.018em] text-[color:var(--color-brand-primary)]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {formatCurrency(kpi.monthlyRevenue)}
            </div>
            <div
              className={
                "mt-0.5 text-[11px] " +
                (revenueDelta >= 0
                  ? "text-[#1A8F50]"
                  : "text-[#B8621E]")
              }
            >
              {revenueDelta >= 0 ? "+" : ""}
              {Math.round(revenueDelta)}% vs mese prec.
            </div>
          </div>
          <div className="bg-[color:var(--ios-grouped-bg)] px-5 py-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
              Ordini oggi
            </div>
            <div
              className="mt-1 font-serif text-[22px] font-medium tracking-[-0.018em] text-[color:var(--color-brand-primary)]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {kpi.ordersToday}
            </div>
            <div className="mt-0.5 text-[11px] text-[color:var(--text-muted-light)]">
              {kpi.orderBacklogCount
                ? `${kpi.orderBacklogCount} in attesa`
                : "Tutto smaltito"}
            </div>
          </div>
          <div className="bg-[color:var(--ios-grouped-bg)] px-5 py-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
              Clienti attivi
            </div>
            <div
              className="mt-1 font-serif text-[22px] font-medium tracking-[-0.018em] text-[color:var(--color-brand-primary)]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {kpi.activeClients}
            </div>
            <div className="mt-0.5 text-[11px] text-[color:var(--text-muted-light)]">
              relazioni aperte
            </div>
          </div>
          <div className="bg-[color:var(--ios-grouped-bg)] px-5 py-4">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
              Ticket medio
            </div>
            <div
              className="mt-1 font-serif text-[22px] font-medium tracking-[-0.018em] text-[color:var(--color-brand-primary)]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {kpi.avgTicket ? formatCurrency(kpi.avgTicket) : "—"}
            </div>
            <div className="mt-0.5 text-[11px] text-[color:var(--text-muted-light)]">
              {kpi.activeProducts} prodotti attivi
            </div>
          </div>
        </div>

        {/* Ordini recenti */}
        <GroupedList
          className="mt-3"
          label="Ordini recenti"
          labelAction={
            top4Orders.length > 0 ? (
              <Link
                href="/supplier/ordini"
                className="text-[11px] text-[color:var(--color-brand-primary)]"
              >
                Vedi tutti →
              </Link>
            ) : null
          }
        >
          {top4Orders.length === 0 ? (
            <GroupedListRow
              title={
                <span className="text-[color:var(--text-muted-light)]">
                  Nessun ordine recente
                </span>
              }
            />
          ) : (
            top4Orders.map((o) => (
              <GroupedListRow
                key={o.id}
                href={`/supplier/ordini/${o.id}`}
                leading={
                  <div
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] font-serif text-[10px] font-medium text-[color:var(--color-brand-on-primary)]"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {initials(o.restaurant_name)}
                  </div>
                }
                title={o.restaurant_name}
                subtitle={
                  <span className="font-mono">
                    {shortDate(o.created_at)} · {formatCurrency(o.total)}
                  </span>
                }
                trailing={<OrderStatusBadge status={o.status} size="xs" />}
              />
            ))
          )}
        </GroupedList>

        {/* Top clienti */}
        {top4Clients.length > 0 && (
          <GroupedList
            className="mt-2"
            label="Top clienti (mese)"
            labelAction={
              <Link
                href="/supplier/clienti"
                className="text-[11px] text-[color:var(--color-brand-primary)]"
              >
                Tutti →
              </Link>
            }
          >
            {top4Clients.map((c) => (
              <GroupedListRow
                key={c.restaurant_id}
                href={`/supplier/clienti/${c.restaurant_id}`}
                leading={
                  <div
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#2B6F42] font-serif text-[10px] font-medium text-white"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {initials(c.name)}
                  </div>
                }
                title={c.name}
                subtitle={
                  <span>
                    {c.orders} ordini · {formatCurrency(c.revenue)}
                  </span>
                }
                showChevron
              />
            ))}
          </GroupedList>
        )}

        {/* Quick actions */}
        <GroupedList className="mt-2" label="Azioni veloci">
          <GroupedListRow
            href="/supplier/ordini/kanban"
            leading={
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[color:var(--color-brand-primary)] text-white"
                aria-hidden
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <rect x="2" y="3" width="3" height="10" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="6.5" y="3" width="3" height="6" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="11" y="3" width="3" height="8" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            }
            title="Kanban ordini"
            subtitle="Gestisci stato ordini"
            showChevron
          />
          <GroupedListRow
            href="/supplier/catalogo"
            leading={
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[#2B6F42] text-white"
                aria-hidden
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path
                    d="M2 4h12v9H2zM2 4l6 4 6-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            }
            title="Catalogo prodotti"
            subtitle={`${kpi.activeProducts} attivi`}
            showChevron
          />
          <GroupedListRow
            href="/supplier/analytics"
            leading={
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[#7A5B18] text-white"
                aria-hidden
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path
                    d="M2 14V4M6 14V7M10 14V10M14 14V2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            }
            title="Analytics"
            subtitle="Trend e performance"
            showChevron
          />
        </GroupedList>
      </div>
    </PullToRefresh>
  );
}
