// app/(app)/ordini/_lib/bucketize.ts
//
// Pure function: group orders into time buckets (today/yesterday/this_week/earlier).
// Input is expected pre-sorted by createdAt desc (newest first).
// Output preserves that ordering within each bucket.

import {
  isSameDay,
  subDays,
  startOfWeek,
} from "date-fns";
import type { BucketedFeed, OrderFeedRow, TimeBucket } from "./types";

export function bucketize(
  rows: OrderFeedRow[],
  now: Date = new Date(),
): BucketedFeed {
  const yesterday = subDays(now, 1);
  // Week starts on Monday in Italy. "This week" means: from Monday 00:00
  // up to (but not including) yesterday.
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const buckets: Record<TimeBucket, OrderFeedRow[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    earlier: [],
  };

  for (const row of rows) {
    const d = new Date(row.createdAt);
    if (Number.isNaN(d.getTime())) {
      buckets.earlier.push(row);
      continue;
    }
    if (isSameDay(d, now)) {
      buckets.today.push(row);
    } else if (isSameDay(d, yesterday)) {
      buckets.yesterday.push(row);
    } else if (d >= weekStart) {
      buckets.this_week.push(row);
    } else {
      buckets.earlier.push(row);
    }
  }

  const order: TimeBucket[] = ["today", "yesterday", "this_week", "earlier"];
  return order
    .map((b) => ({ bucket: b, rows: buckets[b] }))
    .filter((g) => g.rows.length > 0);
}

export function bucketLabel(b: TimeBucket): string {
  switch (b) {
    case "today":
      return "OGGI";
    case "yesterday":
      return "IERI";
    case "this_week":
      return "QUESTA SETTIMANA";
    case "earlier":
      return "PRECEDENTI";
  }
}

// Status → colored dot helper. Returns a tailwind bg class.
export function statusColorClass(status: string): string {
  switch (status) {
    case "pending":
    case "pending_confirmation":
    case "submitted":
      return "bg-amber-500";
    case "confirmed":
      return "bg-blue-500";
    case "preparing":
    case "in_transit":
    case "shipping":
    case "shipped":
      return "bg-yellow-500";
    case "delivered":
    case "completed":
      return "bg-accent-green";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-text-tertiary";
  }
}
