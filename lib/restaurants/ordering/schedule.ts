// Delivery days + order cut-off arithmetic in Italian time.
// Pure module (node --test friendly).
//
// Rule: a delivery on day X is possible when the order is sent before
// `cutoffTime` on day X − leadDays (no cut-off time = by the end of that day).

export const ROME_TZ = "Europe/Rome";

export type DeliverySchedule = {
  /** 0 = domenica … 6 = sabato (JS getDay()). */
  weekdays: number[];
  /** "HH:MM" or "HH:MM:SS"; null = any time of the order day. */
  cutoffTime: string | null;
  leadDays: number;
};

export type NextDeadline = {
  /** Delivery date, YYYY-MM-DD (Italian calendar). */
  deliveryDate: string;
  /** Last moment to order for that delivery (UTC epoch ms). */
  deadlineMs: number;
  /** Order day, YYYY-MM-DD. */
  orderDate: string;
};

type Parts = { y: number; m: number; d: number; hh: number; mm: number; ss: number };

function romeParts(ms: number): Parts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return { y: out.year!, m: out.month!, d: out.day!, hh: out.hour!, mm: out.minute!, ss: out.second! };
}

/** UTC epoch ms of a wall-clock time in Rome (DST-safe). */
export function romeWallTimeToUtc(y: number, m: number, d: number, hh: number, mm: number): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = romeParts(guess);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  const offset = asUtc - guess;
  let result = guess - offset;
  // Second pass in case the first guess crossed a DST switch.
  const p2 = romeParts(result);
  const asUtc2 = Date.UTC(p2.y, p2.m - 1, p2.d, p2.hh, p2.mm, p2.ss);
  const offset2 = asUtc2 - result;
  if (offset2 !== offset) result = guess - offset2;
  return result;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Civil-date helper independent from the runtime zone. */
function addDays(y: number, m: number, d: number, n: number): { y: number; m: number; d: number; dow: number } {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}

function parseTime(t: string | null): { hh: number; mm: number } | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return { hh, mm };
}

/**
 * Next order deadline after `nowMs` (looks 4 weeks ahead). Null when the
 * schedule has no delivery days.
 */
export function nextDeadline(schedule: DeliverySchedule, nowMs: number): NextDeadline | null {
  const days = new Set(schedule.weekdays.filter((d) => d >= 0 && d <= 6));
  if (days.size === 0) return null;
  const lead = Math.max(0, Math.min(14, Math.round(schedule.leadDays)));
  const cut = parseTime(schedule.cutoffTime) ?? { hh: 23, mm: 59 };
  const today = romeParts(nowMs);
  for (let i = 0; i <= 28 + lead; i++) {
    const delivery = addDays(today.y, today.m, today.d, i);
    if (!days.has(delivery.dow)) continue;
    const order = addDays(delivery.y, delivery.m, delivery.d, -lead);
    const deadlineMs = romeWallTimeToUtc(order.y, order.m, order.d, cut.hh, cut.mm);
    if (deadlineMs > nowMs) {
      return {
        deliveryDate: ymd(delivery.y, delivery.m, delivery.d),
        deadlineMs,
        orderDate: ymd(order.y, order.m, order.d),
      };
    }
  }
  return null;
}

/** The deadline right before the next one (to know if we already ordered for it). */
export function previousDeadlineMs(schedule: DeliverySchedule, nowMs: number): number | null {
  const days = new Set(schedule.weekdays.filter((d) => d >= 0 && d <= 6));
  if (days.size === 0) return null;
  const lead = Math.max(0, Math.min(14, Math.round(schedule.leadDays)));
  const cut = parseTime(schedule.cutoffTime) ?? { hh: 23, mm: 59 };
  const today = romeParts(nowMs);
  for (let i = lead; i >= -28; i--) {
    const delivery = addDays(today.y, today.m, today.d, i);
    if (!days.has(delivery.dow)) continue;
    const order = addDays(delivery.y, delivery.m, delivery.d, -lead);
    const ms = romeWallTimeToUtc(order.y, order.m, order.d, cut.hh, cut.mm);
    if (ms <= nowMs) return ms;
  }
  return null;
}

export const WEEKDAYS_IT: { value: number; short: string; label: string }[] = [
  { value: 1, short: "Lun", label: "Lunedì" },
  { value: 2, short: "Mar", label: "Martedì" },
  { value: 3, short: "Mer", label: "Mercoledì" },
  { value: 4, short: "Gio", label: "Giovedì" },
  { value: 5, short: "Ven", label: "Venerdì" },
  { value: 6, short: "Sab", label: "Sabato" },
  { value: 0, short: "Dom", label: "Domenica" },
];

/** "Lun · Gio" in Monday-first order. */
export function weekdaysLabel(days: number[]): string {
  const set = new Set(days);
  const list = WEEKDAYS_IT.filter((w) => set.has(w.value)).map((w) => w.short);
  return list.length === 7 ? "Tutti i giorni" : list.join(" · ");
}

/** "2 h 14 min", "45 min", "3 g 4 h" (compact countdown). */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "scaduto";
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} g ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

/** Today's date (YYYY-MM-DD) in Rome. */
export function romeToday(nowMs: number): string {
  const p = romeParts(nowMs);
  return ymd(p.y, p.m, p.d);
}

/** "oggi", "domani", or "giovedì 9 ottobre" for a YYYY-MM-DD in Rome. */
export function relativeDayLabel(date: string, nowMs: number): string {
  const today = romeToday(nowMs);
  const p = romeParts(nowMs);
  const tomorrow = addDays(p.y, p.m, p.d, 1);
  if (date === today) return "oggi";
  if (date === ymd(tomorrow.y, tomorrow.m, tomorrow.d)) return "domani";
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)));
}

/** "18:00" from a Postgres time. */
export function shortTime(t: string | null): string | null {
  const p = parseTime(t);
  return p ? `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}` : null;
}
