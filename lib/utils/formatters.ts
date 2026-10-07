import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UnitType } from "@/types/database";

/**
 * All dates are shown in Italian time. Formatting without an explicit zone
 * used the runtime's zone: UTC on the server, the browser's zone on the
 * client — wrong hours on server-rendered pages and hydration mismatches.
 */
export const APP_TIME_ZONE = "Europe/Rome";

/** YYYY-MM-DD of `d` in Italian time. */
export function romeDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Hour (0-23) of `d` in Italian time. */
export function romeHour(d: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(d),
  );
}

/** Whole calendar days from `a` to `b` in Italian time (b - a). */
export function romeDayDiff(a: Date, b: Date): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(romeDateKey(b)) - toUtc(romeDateKey(a))) / 86_400_000);
}

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number as EUR currency */
export function formatCurrency(amount: number): string {
  // `useGrouping: "always"` keeps server (Node ICU) and browser output
  // identical ("4.820,00 €") — CLDR's minimum-grouping-digits otherwise
  // renders "4820,00 €" on the server only and breaks hydration.
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    useGrouping: "always",
  } as Intl.NumberFormatOptions).format(amount);
}

/** Format price per unit (e.g., "€12,50/kg") */
export function formatPricePerUnit(price: number, unit: UnitType): string {
  return `${formatCurrency(price)}/${formatUnitShort(unit)}`;
}

/** Format date in Italian locale. Returns "—" for missing/invalid input. */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Format date with time. Returns "—" for missing/invalid input. */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Format relative time (e.g., "2 ore fa") */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "ora";
  if (diffMins < 60) return `${diffMins} min fa`;
  if (diffHours < 24) return `${diffHours} ore fa`;
  if (diffDays < 7) return `${diffDays} giorni fa`;
  return formatDate(date);
}

/** Short unit display */
export function formatUnitShort(unit: UnitType): string {
  const map: Record<UnitType, string> = {
    kg: "kg",
    g: "g",
    lt: "L",
    l: "L",
    ml: "ml",
    pz: "pz",
    piece: "pz",
    cartone: "ct",
    box: "ct",
    bottiglia: "bt",
    latta: "lt",
    confezione: "cf",
    bundle: "mz",
    pallet: "pl",
    other: "—",
  };
  return map[unit];
}

/** Full unit display name */
export function formatUnitFull(unit: UnitType): string {
  const map: Record<UnitType, string> = {
    kg: "Chilogrammo",
    g: "Grammo",
    lt: "Litro",
    l: "Litro",
    ml: "Millilitro",
    pz: "Pezzo",
    piece: "Pezzo",
    cartone: "Cartone",
    box: "Scatola",
    bottiglia: "Bottiglia",
    latta: "Latta",
    confezione: "Confezione",
    bundle: "Mazzo",
    pallet: "Pallet",
    other: "Altro",
  };
  return map[unit];
}

/** Format rating as "4.2/5" */
export function formatRating(rating: number): string {
  return `${rating.toFixed(1)}/5`;
}
