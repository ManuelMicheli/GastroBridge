import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UnitType } from "@/types/database";

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number as EUR currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/** Format price per unit (e.g., "€12,50/kg") */
export function formatPricePerUnit(price: number, unit: UnitType): string {
  return `${formatCurrency(price)}/${formatUnitShort(unit)}`;
}

/** Format date in Italian locale */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/** Format date with time */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
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
