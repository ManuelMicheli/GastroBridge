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

function cellColor(used: number, capacity: number): string {
  if (capacity === 0) {
    return used > 0
      ? "bg-accent-amber/10 border-accent-amber/30 text-text-primary"
      : "bg-surface-base border-border-subtle text-text-secondary";
  }
  const ratio = used / capacity;
  if (ratio >= 1) {
    return "bg-accent-red/15 border-accent-red/40 text-text-primary";
  }
  if (ratio >= 0.8) {
    return "bg-accent-amber/15 border-accent-amber/40 text-text-primary";
  }
  if (used > 0) {
    return "bg-accent-green/15 border-accent-green/40 text-text-primary";
  }
  return "bg-surface-base border-border-subtle text-text-secondary";
}

function monthCellColor(count: number): string {
  if (count === 0) return "bg-surface-card border-border-subtle text-text-secondary";
  if (count >= 10) return "bg-accent-red/25 border-accent-red/50 text-text-primary";
  if (count >= 5) return "bg-accent-amber/25 border-accent-amber/50 text-text-primary";
  return "bg-accent-green/20 border-accent-green/50 text-text-primary";
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
      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
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
                  <th className="sticky left-0 z-10 bg-surface-card border-b border-r border-border-subtle px-3 py-2 text-left text-xs font-medium text-text-secondary w-32">
                    Slot
                  </th>
                  {weekDays.map((d, i) => {
                    const date = parseDate(d);
                    const isToday = d === today;
                    return (
                      <th
                        key={d}
                        className={`border-b border-border-subtle px-2 py-2 text-center text-xs font-medium min-w-[110px] ${
                          isToday ? "text-accent-green" : "text-text-secondary"
                        }`}
                      >
                        <div>{DOW_LABEL[i]}</div>
                        <div
                          className={`text-sm font-semibold ${isToday ? "text-accent-green" : "text-text-primary"}`}
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
                      <td className="sticky left-0 z-10 bg-surface-card border-b border-r border-border-subtle px-3 py-3 align-top">
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
                            className="border-b border-r border-border-subtle p-1 align-top"
                          >
                            <Link
                              href={drillHref(d)}
                              className={`block rounded-md border px-2 py-2 text-center transition-all hover:brightness-125 ${color}`}
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
    <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border-subtle">
        {DOW_LABEL.map((d) => (
          <div
            key={d}
            className="px-3 py-2 text-center text-xs font-medium text-text-secondary"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const date = parseDate(d);
          const count = counts[d] ?? 0;
          const inMonth = date.getMonth() === monthNum;
          const isToday = d === today;
          const color = monthCellColor(count);
          return (
            <Link
              key={d}
              href={drillHref(d)}
              className={`min-h-[90px] border-b border-r border-border-subtle p-2 transition-all hover:brightness-125 ${color} ${
                !inMonth ? "opacity-40" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-green text-surface-base"
                      : "text-text-primary"
                  }`}
                >
                  {dayNum(d)}
                </span>
                {count > 0 && (
                  <span className="text-xs font-medium text-text-primary bg-surface-base/60 rounded-full px-2 py-0.5 border border-border-subtle">
                    {count}
                  </span>
                )}
              </div>
              {count > 0 && (
                <div className="mt-1 text-[11px] text-text-secondary">
                  {count === 1 ? "consegna" : "consegne"}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
