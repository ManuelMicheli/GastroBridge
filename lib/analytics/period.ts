// Period selection utilities shared between analytics backend, export CSV
// and PeriodSelector client component.

export const PERIOD_KEYS = ["current", "prev", "last3", "last12", "year"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  current: "Mese corrente",
  prev: "Mese scorso",
  last3: "Ultimi 3 mesi",
  last12: "Ultimi 12 mesi",
  year: "Anno corrente",
};

export function isPeriodKey(v: string | null | undefined): v is PeriodKey {
  return !!v && (PERIOD_KEYS as readonly string[]).includes(v);
}

export type PeriodRange = {
  key: PeriodKey;
  label: string;
  from: Date;
  to: Date; // exclusive upper bound
  previous: { from: Date; to: Date }; // comparison window (same length, immediately before)
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

export function computePeriodRange(key: PeriodKey, now: Date = new Date()): PeriodRange {
  let from: Date;
  let to: Date;

  switch (key) {
    case "current": {
      from = startOfMonth(now);
      to = startOfMonth(addMonths(now, 1));
      break;
    }
    case "prev": {
      from = startOfMonth(addMonths(now, -1));
      to = startOfMonth(now);
      break;
    }
    case "last3": {
      from = startOfMonth(addMonths(now, -2));
      to = startOfMonth(addMonths(now, 1));
      break;
    }
    case "last12": {
      from = startOfMonth(addMonths(now, -11));
      to = startOfMonth(addMonths(now, 1));
      break;
    }
    case "year": {
      from = startOfYear(now);
      to = startOfYear(new Date(now.getFullYear() + 1, 0, 1));
      break;
    }
  }

  const spanMs = to.getTime() - from.getTime();
  const previous = {
    from: new Date(from.getTime() - spanMs),
    to: new Date(from.getTime()),
  };

  return { key, label: PERIOD_LABELS[key], from, to, previous };
}
