import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  PackageOpen,
  Phone,
  Route,
  Truck,
  UserRoundX,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CardEmpty, FCard, IconTile, StatusPill } from "@/components/fernly/primitives";
import { KpiCard } from "@/components/fernly/kpi-card";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSupplierMember } from "@/lib/supplier/current-member";
import { ROLE_LABELS } from "@/lib/supplier/permissions";
import { getTodayBoard } from "@/lib/supplier/intel/today";
import { CADENCE_LABEL, CADENCE_TONE } from "@/lib/supplier/intel/cadence";
import { daysBetweenKeys } from "@/lib/supplier/intel/time";
import { formatDate } from "@/lib/utils/formatters";
import { CutoffStrip, PendingIntake } from "./today-client";

export const metadata: Metadata = { title: "Oggi — GastroBridge Fornitore" };
export const dynamic = "force-dynamic";

const WORKFLOW_LABEL: Record<string, string> = {
  confirmed: "Da preparare",
  preparing: "In preparazione",
  packed: "Imballato",
};

function dayLabel(date: string | null, today: string): string {
  if (!date) return "Senza data";
  const diff = daysBetweenKeys(today, date);
  if (diff < 0) return `In ritardo (${formatDate(date)})`;
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  return formatDate(date);
}

export default async function SupplierTodayPage() {
  const member = await getCurrentSupplierMember();
  if (!member) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader title="Oggi" subtitle="Il tuo account non risulta membro attivo di un fornitore." />
      </div>
    );
  }

  const supabase = await createClient();
  const board = await getTodayBoard(supabase, member);
  const { can } = board;

  const prettyDate = new Date(`${board.today}T12:00:00Z`).toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const deliveriesOpen = board.deliveries
    ? board.deliveries.planned + board.deliveries.loaded + board.deliveries.inTransit
    : 0;

  const kpis: Array<{ title: string; value: number; href: string; caption: string; show: boolean }> = [
    {
      title: "Da confermare",
      value: board.pending.length,
      href: "/supplier/ordini",
      caption: board.pending.length
        ? `il più vecchio da ${Math.round(Math.max(...board.pending.map((p) => p.ageHours)))} h`
        : "nessun ordine in attesa",
      show: can.accept,
    },
    {
      title: "Da preparare",
      value: board.prep.length,
      href: "/supplier/ordini/kanban",
      caption: `${board.prep.filter((p) => p.expectedDeliveryDate && p.expectedDeliveryDate <= board.today).length} per oggi o in ritardo`,
      show: can.prepare,
    },
    {
      title: board.deliveries?.onlyMine ? "Le mie consegne" : "Consegne di oggi",
      value: board.deliveries?.total ?? 0,
      href: "/supplier/giro",
      caption: board.deliveries ? `${board.deliveries.delivered} consegnate · ${deliveriesOpen} aperte` : "",
      show: can.deliveries,
    },
    {
      title: "Problemi aperti",
      value: board.issues.length,
      href: "#problemi",
      caption: board.issues.length ? "da risolvere oggi" : "tutto in ordine",
      show: true,
    },
  ];
  const visibleKpis = kpis.filter((k) => k.show);

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <RealtimeRefresh
        subscriptions={[
          { table: "order_splits", filter: `supplier_id=eq.${member.supplier_id}` },
          { table: "deliveries", filter: `scheduled_date=eq.${board.today}` },
        ]}
      />
      <PageHeader
        title="Oggi"
        subtitle={`${prettyDate.charAt(0).toUpperCase()}${prettyDate.slice(1)} · ${ROLE_LABELS[member.role]}`}
        actions={
          <>
            {can.accept && (
              <Link href="/supplier/ordini/nuovo" className="f-btn f-btn-primary">
                <Phone className="h-4 w-4" aria-hidden /> Ordine telefonico
              </Link>
            )}
            {can.deliveries && (
              <Link href="/supplier/giro" className="f-btn f-btn-outline">
                <Route className="h-4 w-4" aria-hidden /> Giro consegne
              </Link>
            )}
          </>
        }
      />

      {(can.accept || can.prepare) && board.cutoffs.length > 0 && <CutoffStrip cutoffs={board.cutoffs} />}

      <div
        className={`mb-4 grid grid-cols-2 gap-3 lg:gap-4 ${visibleKpis.length >= 4 ? "xl:grid-cols-4" : visibleKpis.length === 3 ? "xl:grid-cols-3" : ""}`}
      >
        {visibleKpis.map((k, i) => (
          <KpiCard
            key={k.title}
            index={i}
            hero={i === 0}
            title={k.title}
            value={k.value}
            href={k.href}
            caption={<span>{k.caption}</span>}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-2 lg:gap-4">
          {can.accept && (
            <FCard
              index={4}
              title={
                <span className="inline-flex items-center gap-2">
                  <ClipboardCheck className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden /> Da confermare
                </span>
              }
              action={
                <Link href="/supplier/ordini" className="f-btn f-btn-ghost f-btn-xs">
                  Tutti gli ordini
                </Link>
              }
            >
              <PendingIntake orders={board.pending} />
            </FCard>
          )}

          {can.prepare && (
            <FCard
              index={5}
              title={
                <span className="inline-flex items-center gap-2">
                  <PackageOpen className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden /> Coda preparazione
                </span>
              }
              action={
                <Link href="/supplier/ordini/kanban" className="f-btn f-btn-ghost f-btn-xs">
                  Kanban
                </Link>
              }
            >
              {board.prep.length === 0 ? (
                <CardEmpty>Nessun ordine da preparare.</CardEmpty>
              ) : (
                <ul className="divide-y divide-[var(--f-line)]">
                  {board.prep.slice(0, 15).map((p) => {
                    const late = p.expectedDeliveryDate !== null && p.expectedDeliveryDate < board.today;
                    return (
                      <li key={p.splitId} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{p.restaurantName}</p>
                          <p className="text-[12px] text-[var(--f-muted)]">
                            {p.lineCount} righe · {WORKFLOW_LABEL[p.workflow] ?? p.workflow}
                          </p>
                        </div>
                        <StatusPill tone={late ? "danger" : p.expectedDeliveryDate === board.today ? "warning" : "neutral"}>
                          {dayLabel(p.expectedDeliveryDate, board.today)}
                        </StatusPill>
                        <Link
                          href={`/supplier/ordini/${p.splitId}/preparazione`}
                          className="f-btn f-btn-soft f-btn-xs"
                        >
                          Picking
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </FCard>
          )}

          {can.stock && (
            <FCard
              index={6}
              title={
                <span className="inline-flex items-center gap-2">
                  <Boxes className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden /> Magazzino: da riordinare e in scadenza
                </span>
              }
              action={
                <Link href="/supplier/magazzino" className="f-btn f-btn-ghost f-btn-xs">
                  Magazzino
                </Link>
              }
            >
              {board.reorder.length === 0 && board.expiring.length === 0 ? (
                <CardEmpty>
                  Nessun prodotto sotto il punto di riordino e nessun lotto in scadenza entro 3 giorni.
                  <br />
                  <span className="text-[12px]">
                    Il punto di riordino si imposta per prodotto (soglia scorta minima).
                  </span>
                </CardEmpty>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="f-eyebrow mb-2">Da riordinare</p>
                    {board.reorder.length === 0 ? (
                      <p className="text-[13px] text-[var(--f-muted)]">Scorte sopra soglia.</p>
                    ) : (
                      <ul className="space-y-2">
                        {board.reorder.map((r) => (
                          <li key={r.productId} className="rounded-[12px] bg-[var(--f-fill)] px-3 py-2">
                            <p className="truncate text-[13.5px] font-medium text-[var(--f-ink)]">{r.name}</p>
                            <p className="text-[12px] text-[var(--f-muted)] tabular-nums">
                              Disp. {fmtQty(r.available)} · soglia {fmtQty(r.threshold)}
                              {r.openDemand > 0 ? ` · ordini aperti ${fmtQty(r.openDemand)}` : ""}
                            </p>
                            <p className="text-[12px] font-medium text-[var(--acc-800)] tabular-nums">
                              Riordina almeno {fmtQty(r.suggested)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="f-eyebrow mb-2">In scadenza (≤ 3 gg) — vendi prima questi</p>
                    {board.expiring.length === 0 ? (
                      <p className="text-[13px] text-[var(--f-muted)]">Nessun lotto in scadenza.</p>
                    ) : (
                      <ul className="space-y-2">
                        {board.expiring.map((l) => (
                          <li key={l.lotId} className="flex items-center gap-2 rounded-[12px] bg-[var(--f-fill)] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] font-medium text-[var(--f-ink)]">{l.productName}</p>
                              <p className="text-[12px] text-[var(--f-muted)] tabular-nums">
                                Lotto {l.lotCode} · {fmtQty(l.quantity)} pz base
                              </p>
                            </div>
                            <StatusPill tone={l.daysLeft <= 0 ? "danger" : "warning"}>
                              {l.daysLeft < 0 ? "Scaduto" : l.daysLeft === 0 ? "Oggi" : `${l.daysLeft} gg`}
                            </StatusPill>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </FCard>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          {board.deliveries && (
            <FCard
              index={7}
              title={
                <span className="inline-flex items-center gap-2">
                  <Truck className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden />
                  {board.deliveries.onlyMine ? "Il mio giro" : "Consegne di oggi"}
                </span>
              }
            >
              {board.deliveries.total === 0 ? (
                <CardEmpty>Nessuna consegna programmata per oggi.</CardEmpty>
              ) : (
                <>
                  <DeliveryBar d={board.deliveries} />
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
                    <Stat label="Da caricare" value={board.deliveries.planned} />
                    <Stat label="Caricate" value={board.deliveries.loaded} />
                    <Stat label="In viaggio" value={board.deliveries.inTransit} />
                    <Stat label="Consegnate" value={board.deliveries.delivered} />
                    {board.deliveries.failed > 0 && <Stat label="Fallite" value={board.deliveries.failed} danger />}
                  </dl>
                </>
              )}
              <Link href="/supplier/giro" className="f-btn f-btn-primary f-btn-block mt-4">
                <Route className="h-4 w-4" aria-hidden /> Apri il giro
              </Link>
            </FCard>
          )}

          <FCard
            index={8}
            id="problemi"
            title={
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-[18px] w-[18px] text-[var(--f-danger)]" aria-hidden /> Problemi
              </span>
            }
          >
            {board.issues.length === 0 ? (
              <CardEmpty>Nessun problema aperto.</CardEmpty>
            ) : (
              <ul className="space-y-2">
                {board.issues.slice(0, 12).map((i) => (
                  <li key={i.key}>
                    <Link
                      href={i.href}
                      className="block rounded-[12px] border border-[var(--f-line)] px-3 py-2 transition-colors hover:bg-[var(--f-fill)]"
                    >
                      <p className="text-[13.5px] font-medium text-[var(--f-ink)]">{i.title}</p>
                      <p className="text-[12px] text-[var(--f-muted)]">{i.detail}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </FCard>

          {can.financial && (
            <FCard
              index={9}
              title={
                <span className="inline-flex items-center gap-2">
                  <UserRoundX className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden /> Clienti da richiamare
                </span>
              }
              action={
                <Link href="/supplier/insight" className="f-btn f-btn-ghost f-btn-xs">
                  Insight clienti
                </Link>
              }
            >
              {board.atRisk.length === 0 ? (
                <CardEmpty>Tutti i clienti ordinano con la solita frequenza.</CardEmpty>
              ) : (
                <ul className="space-y-2">
                  {board.atRisk.map((c) => (
                    <li key={c.restaurantId} className="flex items-center gap-3">
                      <IconTile seed={c.name}>
                        <CalendarClock className="h-4 w-4" aria-hidden />
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/supplier/clienti/${c.relationshipId}`}
                          className="block truncate text-[13.5px] font-medium text-[var(--f-ink)] hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="text-[12px] text-[var(--f-muted)]">
                          Non ordina da {c.daysSinceLast} gg (di solito ogni {c.cadenceDays} gg)
                        </p>
                      </div>
                      <StatusPill tone={CADENCE_TONE[c.status]}>{CADENCE_LABEL[c.status]}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </FCard>
          )}

        </div>
      </div>
    </div>
  );
}

function fmtQty(n: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(n);
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-[10px] bg-[var(--f-fill)] px-2.5 py-1.5">
      <dt className="text-[var(--f-muted)]">{label}</dt>
      <dd className={`text-[18px] font-medium tabular-nums ${danger ? "text-[var(--f-danger)]" : "text-[var(--f-ink)]"}`}>
        {value}
      </dd>
    </div>
  );
}

function DeliveryBar({ d }: { d: NonNullable<Awaited<ReturnType<typeof getTodayBoard>>["deliveries"]> }) {
  const total = Math.max(d.total, 1);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--f-fill-2)]" aria-hidden>
        <span style={{ width: seg(d.delivered) }} className="bg-[var(--f-success)]" />
        <span style={{ width: seg(d.inTransit) }} className="bg-[var(--acc-600)]" />
        <span style={{ width: seg(d.loaded) }} className="bg-[var(--acc-400)]" />
        <span style={{ width: seg(d.failed) }} className="bg-[var(--f-danger)]" />
      </div>
      <p className="mt-2 text-[12.5px] text-[var(--f-muted)] tabular-nums">
        {d.delivered}/{d.total} consegnate
      </p>
    </div>
  );
}
