import Link from "next/link";

type Slot = {
  from: string;
  to: string;
  label: string;
  capacity: number;
};

type Props = {
  view: "week" | "month";
  days: string[];
  slots: Slot[];
  /** key = `${yyyy-mm-dd}|${from}-${to}` → count */
  usage: Record<string, number>;
  /** key = `${yyyy-mm-dd}` → total deliveries */
  counts: Record<string, number>;
  rangeStart: string;
};

const DOW_LABEL = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function dayNum(s: string): string {
  return String(parseDate(s).getDate());
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Load tints (Fernly calendar chips): semantic, not accent-driven.
const TINT = {
  idle: "bg-[var(--f-fill)] border-transparent text-[var(--f-muted)]",
  ok: "bg-[#E3F4EA] border-transparent text-[#1D6B42]",
  busy: "bg-[#FDF1DC] border-transparent text-[#9A5B0C]",
  full: "bg-[#FCE7E7] border-transparent text-[#A42525]",
} as const;

function cellColor(used: number, capacity: number): string {
  if (capacity === 0) return used > 0 ? TINT.busy : TINT.idle;
  const ratio = used / capacity;
  if (ratio >= 1) return TINT.full;
  if (ratio >= 0.8) return TINT.busy;
  if (used > 0) return TINT.ok;
  return TINT.idle;
}

function monthChip(count: number): string {
  if (count >= 10) return TINT.full;
  if (count >= 5) return TINT.busy;
  return TINT.ok;
}

function drillHref(dateIso: string): string {
  return `/supplier/consegne?date=${dateIso}`;
}

export function DeliveryCalendar({
  view,
  days,
  slots,
  usage,
  counts,
  rangeStart,
}: Props) {
  const today = isoToday();

  if (view === "week") {
    const weekDays = days.slice(0, 7);
    return (
      <div className="f-card f-rise overflow-hidden">
        {slots.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            Nessuno slot orario configurato. Aggiungi gli slot dalle{" "}
            <Link
              href="/supplier/impostazioni/zone"
              className="text-accent-green hover:underline"
            >
              zone di consegna
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-32 bg-[var(--f-card)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--f-muted)]">
                    Slot
                  </th>
                  {weekDays.map((d, i) => {
                    const date = parseDate(d);
                    const isToday = d === today;
                    return (
                      <th
                        key={d}
                        className={`min-w-[110px] px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] ${
                          isToday ? "text-[var(--acc-700)]" : "text-[var(--f-muted)]"
                        }`}
                      >
                        <div>{DOW_LABEL[i]}</div>
                        <div
                          className={`mt-0.5 text-[13px] font-semibold normal-case tracking-normal ${isToday ? "text-[var(--acc-700)]" : "text-[var(--f-ink)]"}`}
                        >
                          {date.toLocaleDateString("it-IT", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const slotKey = `${slot.from}-${slot.to}`;
                  return (
                    <tr key={slotKey}>
                      <td className="sticky left-0 z-10 bg-[var(--f-card)] px-4 py-2 align-top">
                        <div className="text-sm font-medium text-text-primary">
                          {slot.label}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {slot.from}–{slot.to}
                        </div>
                        {slot.capacity > 0 && (
                          <div className="text-[11px] text-text-secondary mt-0.5">
                            cap. {slot.capacity}
                          </div>
                        )}
                      </td>
                      {weekDays.map((d) => {
                        const key = `${d}|${slotKey}`;
                        const used = usage[key] ?? 0;
                        const color = cellColor(used, slot.capacity);
                        return (
                          <td
                            key={d}
                            className="p-1 align-top"
                          >
                            <Link
                              href={drillHref(d)}
                              className={`block rounded-[12px] border px-2 py-2.5 text-center transition-[transform,opacity] hover:opacity-85 ${color}`}
                            >
                              <div className="text-sm font-semibold">
                                {used}
                                <span className="text-text-secondary font-normal">
                                  /{slot.capacity || "∞"}
                                </span>
                              </div>
                              <div className="text-[10px] text-text-secondary mt-0.5">
                                {used === 1 ? "consegna" : "consegne"}
                              </div>
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Month view: 6x7 grid
  const monthDate = parseDate(rangeStart);
  const monthNum = monthDate.getMonth();

  return (
    <div className="f-card f-rise p-4 sm:p-5">
      <div className="grid grid-cols-7 gap-1.5 pb-1.5">
        {DOW_LABEL.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--f-muted)]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const date = parseDate(d);
          const count = counts[d] ?? 0;
          const inMonth = date.getMonth() === monthNum;
          const isToday = d === today;
          return (
            <Link
              key={d}
              href={drillHref(d)}
              style={{ ["--i" as string]: Math.floor(i / 7) * 0.6 }}
              className={`f-fade flex min-h-[92px] flex-col gap-1.5 rounded-[12px] p-2 transition-opacity hover:opacity-85 ${
                inMonth ? "bg-[var(--f-fill)]" : "bg-transparent opacity-50"
              } ${isToday ? "!bg-[var(--f-card)] ring-[1.5px] ring-[var(--acc-600)]" : ""}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-semibold tabular-nums ${
                  isToday ? "bg-[var(--acc-700)] text-white" : "text-[var(--f-ink)]"
                }`}
              >
                {dayNum(d)}
              </span>
              {count > 0 && (
                <span className={`block truncate rounded-[6px] border px-1.5 py-[3px] text-[11px] font-medium ${monthChip(count)}`}>
                  {count} {count === 1 ? "consegna" : "consegne"}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--f-muted)]">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-[#2E9463]" />1–4 consegne</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-[#D99A2B]" />5–9</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-[#DC4B4B]" />10+</span>
      </div>
    </div>
  );
}
