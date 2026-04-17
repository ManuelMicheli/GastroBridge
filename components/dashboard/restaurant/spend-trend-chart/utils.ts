import type { SpendTrendPeriod, SpendTrendPoint, SpendTrendStats } from "./types";

export function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

export function formatEURCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 1_000_000) + "M";
  }
  if (abs >= 10_000) {
    return new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 1_000) + "k";
  }
  return formatInteger(value);
}

export function formatDateShort(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function formatDateFull(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTimeCET(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function periodDays(period: SpendTrendPeriod): number {
  if (period === "7D") return 7;
  if (period === "30D") return 30;
  if (period === "90D") return 90;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.max(
    1,
    Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
}

export function computeXTicks(pointsLength: number, maxTicks = 8): number[] {
  if (pointsLength <= maxTicks) {
    return Array.from({ length: pointsLength }, (_, i) => i);
  }
  const step = (pointsLength - 1) / (maxTicks - 1);
  return Array.from({ length: maxTicks }, (_, i) => Math.round(i * step));
}

/** Slice points for selected period (most recent N days). */
export function sliceForPeriod(
  points: SpendTrendPoint[],
  period: SpendTrendPeriod,
): SpendTrendPoint[] {
  const days = periodDays(period);
  return points.slice(Math.max(0, points.length - days));
}

/** Previous-period slice (immediately before current), same length. */
export function previousSlice(
  points: SpendTrendPoint[],
  period: SpendTrendPoint[] | SpendTrendPeriod,
): SpendTrendPoint[] {
  const days =
    typeof period === "string"
      ? periodDays(period)
      : period.length;
  const end = Math.max(0, points.length - days);
  const start = Math.max(0, end - days);
  return points.slice(start, end);
}

export function computeStats(
  current: SpendTrendPoint[],
  previous: SpendTrendPoint[],
  transactionsByDate?: Record<string, number>,
): SpendTrendStats {
  const safeCurrent = current.length > 0 ? current : [{ date: "", value: 0 }];
  const total = safeCurrent.reduce((sum, p) => sum + p.value, 0);
  const previousTotal = previous.reduce((sum, p) => sum + p.value, 0);
  const activeDays = safeCurrent.filter((p) => p.value > 0).length;
  const totalDays = safeCurrent.length;
  const peak = safeCurrent.reduce(
    (max, p) => (p.value > max.value ? p : max),
    safeCurrent[0]!,
  );
  const activeValues = safeCurrent.filter((p) => p.value > 0).map((p) => p.value);
  const low = activeValues.length > 0 ? Math.min(...activeValues) : 0;
  // Average over ACTIVE days (days with real orders), matches "media
  // giornaliera spesa" intuition for restaurateurs.
  const average = activeDays > 0 ? total / activeDays : 0;
  const deltaAbsolute = total - previousTotal;
  const deltaPercent = previousTotal > 0 ? (deltaAbsolute / previousTotal) * 100 : 0;
  const transactionsCount = transactionsByDate
    ? safeCurrent.reduce((sum, p) => sum + (transactionsByDate[p.date] ?? 0), 0)
    : activeDays;

  return {
    total,
    average,
    peak,
    low,
    activeDays,
    totalDays,
    transactionsCount,
    deltaPercent,
    deltaAbsolute,
    hasCurrentData: total > 0,
    hasPreviousData: previousTotal > 0,
  };
}

/** Round Y-axis upper bound to a nice number + step-aligned tick list. */
export function computeYAxis(maxValue: number): { max: number; step: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { max: 100, step: 25, ticks: [0, 25, 50, 75, 100] };
  }
  // Aim for ~5 ticks (6 including zero).
  const targetTicks = 5;
  const rawStep = maxValue / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / pow;
  let stepMultiplier: number;
  if (normalized <= 1) stepMultiplier = 1;
  else if (normalized <= 2) stepMultiplier = 2;
  else if (normalized <= 2.5) stepMultiplier = 2.5;
  else if (normalized <= 5) stepMultiplier = 5;
  else stepMultiplier = 10;
  const step = stepMultiplier * pow;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 0.0001; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return { max, step, ticks };
}
