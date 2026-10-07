"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

export type CalTone = "amber" | "blue" | "accent" | "green" | "red" | "purple" | "neutral";

export type CalEvent = {
  id: string;
  /** YYYY-MM-DD (local day). */
  date: string;
  title: string;
  subtitle?: string;
  tone: CalTone;
  href?: string;
  /** Short text shown on the right of the timeline card (e.g. a total). */
  meta?: ReactNode;
};

const TONES: Record<CalTone, { bg: string; fg: string; rail: string }> = {
  amber: { bg: "#FDF1DC", fg: "#9A5B0C", rail: "#D99A2B" },
  blue: { bg: "#E6EDFD", fg: "#2848A8", rail: "#4C6FD8" },
  accent: { bg: "var(--acc-50)", fg: "var(--acc-700)", rail: "var(--acc-600)" },
  green: { bg: "#E3F4EA", fg: "#1D6B42", rail: "#2E9463" },
  red: { bg: "#FCE7E7", fg: "#A42525", rail: "#DC4B4B" },
  purple: { bg: "#EFE7FB", fg: "#5B3A93", rail: "#8A63C9" },
  neutral: { bg: "var(--f-fill-2)", fg: "var(--f-ink-2)", rail: "var(--f-faint)" },
};

export function toneStyle(t: CalTone) {
  return TONES[t];
}

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Fernly month calendar — rounded day cells with tinted event chips, today
 * ringed in the accent, prev/next + "Oggi" with an animated month change, and
 * a right column with today's timeline and the upcoming list (spec §4).
 */
export function MonthCalendar({
  events,
  weekStartsOn = 1,
  legend,
  todayTitle = "Oggi",
  upcomingTitle = "In arrivo",
  emptyToday = "Nessun evento oggi.",
  emptyUpcoming = "Niente in programma.",
  initialMonth,
}: {
  events: CalEvent[];
  weekStartsOn?: 0 | 1;
  legend?: Array<{ tone: CalTone; label: string }>;
  todayTitle?: string;
  upcomingTitle?: string;
  emptyToday?: string;
  emptyUpcoming?: string;
  initialMonth?: Date;
}) {
  const reduce = useReducedMotion();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [month, setMonth] = useState(() => {
    const base = initialMonth ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [dir, setDir] = useState(1);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() - weekStartsOn + 7) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month, weekStartsOn]);

  const weekdays = useMemo(() => {
    const base = new Date(2024, 0, 7 + weekStartsOn); // a Sunday + offset
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(d).replace(".", "");
    });
  }, [weekStartsOn]);

  const todayKey = key(today);
  const todays = byDay.get(todayKey) ?? [];
  const upcoming = useMemo(
    () => events.filter((e) => e.date > todayKey).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6),
    [events, todayKey],
  );

  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(month);

  function shift(n: number) {
    setDir(n);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  }
  function goToday() {
    const t = new Date(today.getFullYear(), today.getMonth(), 1);
    setDir(t.getTime() >= month.getTime() ? 1 : -1);
    setMonth(t);
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="f-card f-rise min-w-0 p-4 sm:p-5" aria-label="Calendario">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold capitalize tracking-[-0.015em] text-[var(--f-ink)]">{monthLabel}</h2>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={goToday} className="f-btn f-btn-xs f-btn-outline">
              <CalendarDays className="h-3.5 w-3.5" /> Oggi
            </button>
            <button type="button" onClick={() => shift(-1)} className="f-icon-btn !h-8 !w-8" aria-label="Mese precedente">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => shift(1)} className="f-icon-btn !h-8 !w-8" aria-label="Mese successivo">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-7 gap-1.5 pb-1.5">
          {weekdays.map((w, i) => (
            <div key={`${w}-${i}`} className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--f-muted)]">
              {w}
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={month.toISOString()}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 18 }}
              animate={{ opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.28, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
              className="grid grid-cols-7 gap-1.5"
            >
              {cells.map((d) => {
                const k = key(d);
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = k === todayKey;
                const evs = byDay.get(k) ?? [];
                return (
                  <div
                    key={k}
                    className={cn(
                      "relative flex min-h-[84px] flex-col gap-1 rounded-[12px] p-1.5 sm:min-h-[96px] sm:p-2",
                      inMonth ? "bg-[var(--f-fill)]" : "bg-transparent",
                      isToday && "ring-[1.5px] ring-[var(--acc-600)] bg-[var(--f-card)]",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-semibold tabular-nums",
                        isToday ? "bg-[var(--acc-700)] text-white" : inMonth ? "text-[var(--f-ink)]" : "text-[var(--f-faint)]",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {evs.slice(0, 2).map((e) => {
                      const t = TONES[e.tone];
                      const chip = (
                        <span
                          className="block truncate rounded-[6px] px-1.5 py-[3px] text-[11px] font-medium leading-tight"
                          style={{ background: t.bg, color: t.fg }}
                          title={e.subtitle ? `${e.title} — ${e.subtitle}` : e.title}
                        >
                          {e.title}
                        </span>
                      );
                      return e.href ? (
                        <Link key={e.id} href={e.href} className="block min-w-0 hover:opacity-80">
                          {chip}
                        </Link>
                      ) : (
                        <span key={e.id} className="block min-w-0">
                          {chip}
                        </span>
                      );
                    })}
                    {evs.length > 2 ? (
                      <span className="px-1 text-[10.5px] font-medium text-[var(--f-muted)]">+{evs.length - 2} altri</span>
                    ) : null}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {legend && legend.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--f-muted)]">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: TONES[l.tone].rail }} />
                {l.label}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
        <section className="f-card f-rise p-5" style={{ ["--i" as string]: 1 }} aria-label={todayTitle}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--acc-700)]">
            {todayTitle} · {new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(today)}
          </p>
          <p className="mt-1 text-[24px] font-semibold capitalize tracking-[-0.02em] text-[var(--f-ink)]">
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(today)}
          </p>
          <div className="mt-4 space-y-2.5">
            {todays.length === 0 ? (
              <p className="text-[13px] text-[var(--f-muted)]">{emptyToday}</p>
            ) : (
              todays.map((e) => <TimelineCard key={e.id} e={e} />)
            )}
          </div>
        </section>

        <section className="f-card f-rise p-5" style={{ ["--i" as string]: 2 }} aria-label={upcomingTitle}>
          <h3 className="f-card-title">{upcomingTitle}</h3>
          <ul className="mt-3 space-y-2">
            {upcoming.length === 0 ? (
              <li className="text-[13px] text-[var(--f-muted)]">{emptyUpcoming}</li>
            ) : (
              upcoming.map((e) => {
                const d = new Date(`${e.date}T12:00:00`);
                const body = (
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[11px] leading-none"
                      style={{ background: TONES[e.tone].bg, color: TONES[e.tone].fg }}
                    >
                      <span className="text-[9.5px] font-semibold uppercase">
                        {new Intl.DateTimeFormat("it-IT", { month: "short" }).format(d).replace(".", "")}
                      </span>
                      <span className="mt-0.5 text-[15px] font-semibold tabular-nums">{d.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-[var(--f-ink)]">{e.title}</span>
                      <span className="block truncate text-[12px] text-[var(--f-muted)]">
                        <span className="capitalize">{new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(d)}</span>
                        {e.subtitle ? ` · ${e.subtitle}` : ""}
                      </span>
                    </span>
                  </span>
                );
                return (
                  <li key={e.id}>
                    {e.href ? (
                      <Link href={e.href} className="-mx-1.5 block rounded-[12px] px-1.5 py-1 hover:bg-[var(--f-fill)]">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function TimelineCard({ e }: { e: CalEvent }) {
  const t = TONES[e.tone];
  const body = (
    <div className="relative overflow-hidden rounded-[14px] bg-[var(--f-fill)] py-3 pl-4 pr-3">
      <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full" style={{ background: t.rail }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[var(--f-ink)]">{e.title}</p>
          {e.subtitle ? (
            <p className="mt-0.5 truncate text-[12.5px] font-medium" style={{ color: t.fg }}>
              {e.subtitle}
            </p>
          ) : null}
        </div>
        {e.meta ? <div className="shrink-0 text-[12.5px] text-[var(--f-muted)] tabular-nums">{e.meta}</div> : null}
      </div>
    </div>
  );
  return e.href ? (
    <Link href={e.href} className="block transition-opacity hover:opacity-85">
      {body}
    </Link>
  ) : (
    body
  );
}
