// app/(supplier)/supplier/ordini/_lib/bucketize.ts
//
// Pure function: group supplier splits into time buckets by createdAt.
// Input is expected pre-sorted by createdAt desc (newest first).

import { isSameDay, subDays, startOfWeek } from "date-fns";
import type {
  BucketedSupplierFeed,
  SupplierTimelineRow,
  TimeBucket,
} from "./types";

export function bucketize(
  rows: SupplierTimelineRow[],
  now: Date = new Date(),
): BucketedSupplierFeed {
  const yesterday = subDays(now, 1);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const buckets: Record<TimeBucket, SupplierTimelineRow[]> = {
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
