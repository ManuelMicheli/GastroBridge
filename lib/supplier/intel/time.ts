// Italian-time helpers for the supplier operations views (cut-offs, "oggi").
// Pure functions — safe on server and client.

import { APP_TIME_ZONE, romeDateKey } from "@/lib/utils/formatters";

/** Minutes Rome is ahead of UTC at instant `d` (60 in winter, 120 in summer). */
export function romeOffsetMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - d.getTime()) / 60_000);
}

/** The UTC instant of wall-clock `HH:MM` on `dateKey` (YYYY-MM-DD) in Rome. */
export function romeWallTime(dateKey: string, hhmm: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  const offset = romeOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60_000);
}

/** `dateKey` shifted by `days` (calendar arithmetic, no timezone drift). */
export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Weekday (0 = domenica … 6 = sabato) of a YYYY-MM-DD key. */
export function weekdayOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export function todayKey(): string {
  return romeDateKey(new Date());
}

/** Whole days between two YYYY-MM-DD keys (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export type ZoneCutoffInput = {
  id: string;
  zone_name: string | null;
  cutoff_time: string | null;
  delivery_days: number[] | null;
};

export type NextCutoff = {
  zoneId: string;
  zoneName: string;
  /** ISO instant of the cut-off. */
  cutoffAt: string;
  /** "HH:MM" as configured. */
  cutoffTime: string;
  /** Delivery date served by this cut-off (YYYY-MM-DD). */
  deliveryDate: string;
};

/**
 * Next cut-off still open for each zone: an order placed before
 * `cutoff_time` on the day before a delivery day is delivered on that day.
 * Zones without cut-off or delivery days are skipped.
 */
export function nextCutoffs(zones: ZoneCutoffInput[], now: Date = new Date()): NextCutoff[] {
  const today = romeDateKey(now);
  const out: NextCutoff[] = [];
  for (const z of zones) {
    const time = (z.cutoff_time ?? "").slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(time) || !z.delivery_days || z.delivery_days.length === 0) continue;
    for (let k = 1; k <= 8; k++) {
      const deliveryDate = addDaysKey(today, k);
      if (!z.delivery_days.includes(weekdayOfKey(deliveryDate))) continue;
      const cutoffAt = romeWallTime(addDaysKey(deliveryDate, -1), time);
      if (cutoffAt.getTime() <= now.getTime()) continue;
      out.push({
        zoneId: z.id,
        zoneName: z.zone_name ?? "Zona",
        cutoffAt: cutoffAt.toISOString(),
        cutoffTime: time,
        deliveryDate,
      });
      break;
    }
  }
  return out.sort((a, b) => a.cutoffAt.localeCompare(b.cutoffAt));
}
