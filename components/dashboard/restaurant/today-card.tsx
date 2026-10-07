"use client";

// "Oggi in cucina" — the first thing a chef needs at 7 am or after service:
// which supplier closes orders soon, what arrives today, what the brigade asked.

import Link from "next/link";
import { CalendarClock, ChefHat, PackageCheck, RotateCcw, Tag, Truck, Wand2 } from "lucide-react";
import { FCard } from "@/components/fernly/primitives";
import { CutoffChip, useNow } from "@/components/restaurant/ordering/cutoff-chip";
import { relativeDayLabel } from "@/lib/restaurants/ordering/schedule";

export type DashboardToday = {
  deadlines: { key: string; name: string; deadlineMs: number; deliveryDate: string }[];
  dueCount: number;
  receive: { orderId: string; supplierName: string; date: string }[];
  kitchenOpen: number;
  canOrder: boolean;
  canReceive: boolean;
  hasSchedules: boolean;
};

export function TodayCard({ today, index }: { today: DashboardToday; index: number }) {
  const now = useNow(60_000);
  return (
    <FCard index={index} className="mb-3 lg:mb-4" title="Oggi in cucina">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section aria-label="Ordina entro">
          <p className="f-eyebrow mb-2 flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Ordina entro
          </p>
          {today.deadlines.length === 0 ? (
            <p className="text-[13px] text-[var(--f-muted)]">
              {today.hasSchedules ? "Nessuna scadenza nelle prossime ore." : "Imposta i giorni di consegna dei fornitori."}{" "}
              <Link href="/consegne" className="font-medium text-[var(--acc-700)]">
                Consegne
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {today.deadlines.map((d) => (
                <li key={d.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[14px] font-medium text-[var(--f-ink)]">{d.name}</span>
                  <CutoffChip deadlineMs={d.deadlineMs} deliveryDate={d.deliveryDate} compact />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Da ricevere">
          <p className="f-eyebrow mb-2 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> In arrivo
          </p>
          {today.receive.length === 0 ? (
            <p className="text-[13px] text-[var(--f-muted)]">Nessuna consegna annunciata per oggi o domani.</p>
          ) : (
            <ul className="space-y-2">
              {today.receive.map((r) => (
                <li key={r.orderId + r.supplierName} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-[var(--f-ink)]">{r.supplierName}</span>
                    <span className="block text-[12px] capitalize text-[var(--f-muted)]" suppressHydrationWarning>
                      {now !== null ? relativeDayLabel(r.date, now) : ""}
                    </span>
                  </span>
                  {today.canReceive && (
                    <Link href={`/ordini/${r.orderId}/ricevi`} className="f-btn f-btn-xs f-btn-outline shrink-0">
                      <PackageCheck className="h-3 w-3" /> Ricevi
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Azioni rapide">
          <p className="f-eyebrow mb-2 flex items-center gap-1.5">
            <ChefHat className="h-3.5 w-3.5" /> Da fare
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/riordina" className="f-btn f-btn-sm f-btn-primary">
              <RotateCcw className="h-3.5 w-3.5" /> Riordina
              {today.dueCount > 0 ? (
                <span className="rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">{today.dueCount}</span>
              ) : null}
            </Link>
            <Link href="/lista-cucina" className="f-btn f-btn-sm f-btn-outline">
              <ChefHat className="h-3.5 w-3.5" /> Lista cucina
              {today.kitchenOpen > 0 ? (
                <span className="rounded-full bg-[var(--acc-100)] px-1.5 text-[11px] tabular-nums text-[var(--acc-ink)]">
                  {today.kitchenOpen}
                </span>
              ) : null}
            </Link>
            {today.canOrder && (
              <Link href="/ordine-veloce" className="f-btn f-btn-sm f-btn-outline">
                <Wand2 className="h-3.5 w-3.5" /> Ordine veloce
              </Link>
            )}
            <Link href="/prezzi" className="f-btn f-btn-sm f-btn-ghost">
              <Tag className="h-3.5 w-3.5" /> Prezzi
            </Link>
          </div>
          {today.dueCount > 0 && (
            <p className="mt-2 text-[12.5px] text-[var(--f-muted)]">
              {today.dueCount} prodott{today.dueCount === 1 ? "o" : "i"} da riordinare secondo la tua frequenza abituale.
            </p>
          )}
        </section>
      </div>
    </FCard>
  );
}
