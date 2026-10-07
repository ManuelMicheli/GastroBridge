"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarClock, PackageCheck, Pencil, RotateCcw, Store, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, ModalActions } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CardEmpty, FCard, IconTile, OrderStatusPill, StatusPill } from "@/components/fernly/primitives";
import { CutoffChip, useNow } from "@/components/restaurant/ordering/cutoff-chip";
import { cn } from "@/lib/utils/formatters";
import {
  WEEKDAYS_IT,
  formatCountdown,
  relativeDayLabel,
  shortTime,
  weekdaysLabel,
} from "@/lib/restaurants/ordering/schedule";
import { deleteSupplierSchedule, saveSupplierSchedule } from "@/lib/restaurants/ordering/actions";
import type { ScheduleInfo } from "@/lib/restaurants/ordering/types";

export type SupplierScheduleRow = {
  key: string;
  kind: "product" | "catalog";
  name: string;
  catalogLeadDays: number | null;
  schedule: ScheduleInfo | null;
  deadlineMs: number | null;
  deliveryDate: string | null;
};

export type UpcomingDelivery = {
  splitId: string;
  orderId: string;
  supplierName: string;
  date: string;
  status: string;
};

function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + n));
  return t.toISOString().slice(0, 10);
}
function dowOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}
const dayFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric" });

export function DeliveriesClient({
  rows,
  upcoming,
  canEdit,
  today,
}: {
  rows: SupplierScheduleRow[];
  upcoming: UpcomingDelivery[];
  canEdit: boolean;
  today: string;
}) {
  const now = useNow(30_000);
  const [editing, setEditing] = useState<SupplierScheduleRow | null>(null);

  const deadlines = useMemo(
    () =>
      rows
        .filter((r) => r.deadlineMs !== null)
        .sort((a, b) => (a.deadlineMs ?? 0) - (b.deadlineMs ?? 0))
        .slice(0, 6),
    [rows],
  );

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDaysKey(today, i);
      const dow = dowOf(key);
      return {
        key,
        announced: upcoming.filter((u) => u.date === key),
        scheduled: rows.filter((r) => r.schedule?.weekdays.includes(dow)),
      };
    });
  }, [today, upcoming, rows]);

  const unset = rows.filter((r) => !r.schedule);

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Consegne e orari limite"
        subtitle="Giorni di consegna e orario entro cui ordinare, per ogni fornitore. Ti avvisiamo prima della scadenza."
        actions={
          <Link href="/riordina" className="f-btn f-btn-primary">
            <RotateCcw className="h-4 w-4" /> Riordino rapido
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-3">
        <FCard index={0} title="Prossime scadenze" className="xl:col-span-1">
          {deadlines.length === 0 ? (
            <CardEmpty>Imposta i giorni di consegna dei fornitori per vedere qui il conto alla rovescia.</CardEmpty>
          ) : (
            <ul className="space-y-2.5">
              {deadlines.map((r) => {
                const left = now !== null && r.deadlineMs !== null ? r.deadlineMs - now : null;
                return (
                  <li key={r.key} className="flex items-center gap-3">
                    <IconTile seed={r.name} size={34}>
                      <CalendarClock className="h-4 w-4" />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{r.name}</p>
                      <p className="truncate text-[12px] text-[var(--f-muted)]" suppressHydrationWarning>
                        consegna {now !== null && r.deliveryDate ? relativeDayLabel(r.deliveryDate, now) : "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[13px] font-semibold tabular-nums",
                        left !== null && left < 3_600_000
                          ? "text-[var(--f-danger)]"
                          : left !== null && left < 3 * 3_600_000
                            ? "text-[var(--f-warning)]"
                            : "text-[var(--f-ink)]",
                      )}
                      suppressHydrationWarning
                    >
                      {left !== null ? formatCountdown(left) : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </FCard>

        <FCard index={1} title="Questa settimana" className="xl:col-span-2">
          <div className="-mx-1 grid grid-cols-2 gap-2 px-1 sm:grid-cols-4 lg:grid-cols-7">
            {week.map((d, i) => (
              <div
                key={d.key}
                className={cn(
                  "min-h-[120px] rounded-[14px] p-2.5",
                  i === 0 ? "bg-[var(--acc-50)] ring-1 ring-[var(--acc-200)]" : "bg-[var(--f-fill)]",
                )}
              >
                <p className="mb-2 text-[12px] font-semibold capitalize text-[var(--f-ink-2)]">
                  {i === 0 ? "Oggi" : dayFmt.format(new Date(`${d.key}T00:00:00Z`))}
                </p>
                <ul className="space-y-1">
                  {d.announced.map((u) => (
                    <li key={u.splitId}>
                      <Link
                        href={`/ordini/${u.orderId}`}
                        className="flex items-center gap-1 rounded-[8px] bg-[var(--f-card)] px-1.5 py-1 text-[11.5px] font-medium text-[var(--f-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        title={`${u.supplierName} — ordine in arrivo`}
                      >
                        <Truck className="h-3 w-3 shrink-0 text-[var(--acc-600)]" />
                        <span className="truncate">{u.supplierName}</span>
                      </Link>
                    </li>
                  ))}
                  {d.scheduled
                    .filter((r) => !d.announced.some((u) => u.supplierName === r.name))
                    .map((r) => (
                      <li
                        key={r.key}
                        className="truncate px-1.5 text-[11.5px] text-[var(--f-muted)]"
                        title={`${r.name} consegna in questo giorno`}
                      >
                        {r.name}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--f-muted)]">
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3 w-3 text-[var(--acc-600)]" /> ordine in arrivo
            </span>
            <span>nome in grigio = giorno di consegna del fornitore</span>
          </p>
        </FCard>
      </div>

      <FCard index={2} className="mt-3 lg:mt-4" title="Fornitori">
        {rows.length === 0 ? (
          <CardEmpty action={<Link href="/fornitori" className="f-btn f-btn-sm f-btn-primary">Aggiungi fornitori</Link>}>
            Nessun fornitore collegato o listino importato.
          </CardEmpty>
        ) : (
          <ul className="divide-y divide-[var(--f-line)]">
            {rows.map((r) => (
              <li key={r.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <IconTile seed={r.name} size={36}>
                    <Store className="h-4 w-4" />
                  </IconTile>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[var(--f-ink)]">{r.name}</p>
                    <p className="text-[12px] text-[var(--f-muted)]">
                      {r.schedule ? (
                        <>
                          {weekdaysLabel(r.schedule.weekdays)}
                          {shortTime(r.schedule.cutoffTime) ? ` · entro le ${shortTime(r.schedule.cutoffTime)}` : ""}
                          {` · ${r.schedule.leadDays === 0 ? "in giornata" : r.schedule.leadDays === 1 ? "il giorno prima" : `${r.schedule.leadDays} giorni prima`}`}
                          {r.schedule.source === "supplier" ? " · dal fornitore" : ""}
                          {!r.schedule.reminderEnabled ? " · promemoria spento" : ""}
                        </>
                      ) : (
                        "Giorni di consegna non impostati"
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {r.schedule && <CutoffChip deadlineMs={r.deadlineMs} deliveryDate={r.deliveryDate} compact />}
                  {canEdit && (
                    <button type="button" className="f-btn f-btn-xs f-btn-outline" onClick={() => setEditing(r)}>
                      <Pencil className="h-3 w-3" /> {r.schedule ? "Modifica" : "Imposta"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {unset.length > 0 && canEdit && (
          <p className="mt-3 flex items-center gap-2 rounded-[12px] bg-[var(--f-fill)] px-3 py-2 text-[12.5px] text-[var(--f-muted)]">
            <BellRing className="h-4 w-4 shrink-0 text-[var(--acc-600)]" />
            {unset.length} fornitor{unset.length === 1 ? "e" : "i"} senza giorni di consegna: impostali per ricevere il
            promemoria prima dell&apos;orario limite.
          </p>
        )}
      </FCard>

      {upcoming.length > 0 && (
        <FCard index={3} className="mt-3 lg:mt-4" title="Consegne annunciate">
          <ul className="divide-y divide-[var(--f-line)]">
            {upcoming.slice(0, 12).map((u) => (
              <li key={u.splitId} className="flex items-center gap-3 py-2.5">
                <Truck className="h-4 w-4 shrink-0 text-[var(--acc-600)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{u.supplierName}</p>
                  <p className="text-[12px] capitalize text-[var(--f-muted)]" suppressHydrationWarning>
                    {now !== null ? relativeDayLabel(u.date, now) : u.date}
                  </p>
                </div>
                <OrderStatusPill status={u.status} />
                <Link href={`/ordini/${u.orderId}/ricevi`} className="f-btn f-btn-xs f-btn-outline">
                  <PackageCheck className="h-3 w-3" /> Ricevi
                </Link>
              </li>
            ))}
          </ul>
        </FCard>
      )}

      <ScheduleModal row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ScheduleModal({ row, onClose }: { row: SupplierScheduleRow | null; onClose: () => void }) {
  return (
    <Modal
      isOpen={row !== null}
      onClose={onClose}
      title={row ? `Consegne · ${row.name}` : ""}
      description="Quando consegna e entro che ora devi ordinare."
      size="sm"
    >
      {row && <ScheduleForm key={row.key} row={row} onDone={onClose} />}
    </Modal>
  );
}

function ScheduleForm({ row, onDone }: { row: SupplierScheduleRow; onDone: () => void }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const s = row.schedule;
  const [days, setDays] = useState<number[]>(s?.weekdays ?? []);
  const [cutoff, setCutoff] = useState<string>(shortTime(s?.cutoffTime ?? null) ?? "18:00");
  const [hasCutoff, setHasCutoff] = useState<boolean>(s ? s.cutoffTime !== null : true);
  const [lead, setLead] = useState<number>(s?.leadDays ?? (row.catalogLeadDays && row.catalogLeadDays > 0 ? row.catalogLeadDays : 1));
  const [reminder, setReminder] = useState<boolean>(s?.reminderEnabled ?? true);
  const [notes, setNotes] = useState<string>(s?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function toggle(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function save() {
    startTransition(async () => {
      const res = await saveSupplierSchedule({
        kind: row.kind,
        key: row.key,
        weekdays: days,
        cutoffTime: hasCutoff ? cutoff : null,
        leadDays: lead,
        reminderEnabled: reminder,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Consegne salvate");
      onDone();
      router.refresh();
    });
  }

  function reset() {
    if (!s?.scheduleId) return;
    startTransition(async () => {
      const ok = await confirm({
        title: "Rimuovere le tue impostazioni?",
        description:
          row.kind === "product"
            ? "Torneranno a valere i giorni di consegna indicati dal fornitore (se ne ha per la tua zona)."
            : "Il fornitore resterà senza giorni di consegna.",
        confirmLabel: "Rimuovi",
        tone: "danger",
      });
      if (!ok) return;
      const res = await deleteSupplierSchedule(s.scheduleId!);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Impostazioni rimosse");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {s?.source === "supplier" && (
        <p className="rounded-[12px] bg-[var(--f-info-bg)] px-3 py-2 text-[12.5px] text-[var(--f-info)]">
          Ora valgono i giorni indicati dal fornitore per la tua zona. Salvando, userai i tuoi.
        </p>
      )}
      <fieldset>
        <legend className="f-label mb-2">Giorni di consegna</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS_IT.map((w) => {
            const on = days.includes(w.value);
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => toggle(w.value)}
                aria-pressed={on}
                aria-label={w.label}
                className={cn(
                  "h-11 rounded-[12px] text-[13px] font-medium transition-colors",
                  on ? "bg-[var(--acc-800)] text-white" : "bg-[var(--f-fill)] text-[var(--f-ink-2)] hover:bg-[var(--f-fill-2)]",
                )}
              >
                {w.short}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="f-label mb-1.5 flex items-center gap-2" htmlFor="sched-cutoff">
            <input type="checkbox" checked={hasCutoff} onChange={(e) => setHasCutoff(e.target.checked)} />
            Ordina entro le
          </label>
          <input
            id="sched-cutoff"
            type="time"
            className="f-input h-11 w-full px-3"
            value={cutoff}
            disabled={!hasCutoff}
            onChange={(e) => setCutoff(e.target.value)}
          />
        </div>
        <div>
          <span className="f-label mb-1.5 block">Del giorno</span>
          <select
            className="f-input h-11 w-full px-3"
            value={lead}
            onChange={(e) => setLead(Number(e.target.value))}
            aria-label="Anticipo rispetto alla consegna"
          >
            <option value={0}>della consegna</option>
            <option value={1}>prima</option>
            <option value={2}>2 giorni prima</option>
            <option value={3}>3 giorni prima</option>
            <option value={4}>4 giorni prima</option>
            <option value={7}>1 settimana prima</option>
          </select>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--f-fill)] px-3 py-2.5">
        <span className="text-[13.5px] text-[var(--f-ink)]">
          Promemoria 2 ore prima
          <span className="block text-[12px] text-[var(--f-muted)]">Notifica in app e push a chi può ordinare</span>
        </span>
        <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} className="h-5 w-5" />
      </label>

      <div>
        <label className="f-label mb-1.5 block" htmlFor="sched-notes">
          Note (opzionale)
        </label>
        <input
          id="sched-notes"
          className="f-input h-11 w-full px-3"
          maxLength={300}
          placeholder="Es. il pesce solo martedì e venerdì"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <ModalActions>
        {s?.source === "restaurant" && s.scheduleId && (
          <button type="button" className="f-btn f-btn-ghost mr-auto" onClick={reset} disabled={pending}>
            Rimuovi
          </button>
        )}
        <button type="button" className="f-btn f-btn-outline" onClick={onDone}>
          Annulla
        </button>
        <button type="button" className="f-btn f-btn-primary" onClick={save} disabled={pending}>
          Salva
        </button>
      </ModalActions>
      {days.length === 0 && (
        <p className="text-[12px] text-[var(--f-muted)]">
          <StatusPill tone="warning">Nessun giorno</StatusPill> senza giorni di consegna non c&apos;è orario limite.
        </p>
      )}
      {dialog}
    </div>
  );
}
