"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { formatCountdown, relativeDayLabel, romeToday } from "@/lib/restaurants/ordering/schedule";

/** Current time, ticking every `intervalMs` (null until mounted: no hydration drift). */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const timeFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

/**
 * "Ordina entro 18:00 · 2 h 14 min — consegna domani". Turns amber under
 * 3 hours and red under 1 hour.
 */
export function CutoffChip({
  deadlineMs,
  deliveryDate,
  compact = false,
  className,
}: {
  deadlineMs: number | null;
  deliveryDate: string | null;
  compact?: boolean;
  className?: string;
}) {
  const now = useNow(30_000);
  if (deadlineMs === null || deliveryDate === null) {
    return (
      <span className={cn("f-status", className)} data-tone="neutral">
        Consegne non impostate
      </span>
    );
  }
  const left = now === null ? null : deadlineMs - now;
  const tone = left === null ? "neutral" : left < 3_600_000 ? "danger" : left < 3 * 3_600_000 ? "warning" : "info";
  const day = now === null ? "" : relativeDayLabel(deliveryDate, now);
  const orderDay = now === null ? "oggi" : relativeDayLabel(romeToday(deadlineMs), now);
  return (
    <span className={cn("f-status gap-1.5", className)} data-tone={tone} suppressHydrationWarning>
      <Clock className="h-3 w-3" aria-hidden />
      <span suppressHydrationWarning>
        entro {orderDay === "oggi" ? "" : `${orderDay} `}
        {timeFmt.format(new Date(deadlineMs))}
        {left !== null ? ` · ${formatCountdown(left)}` : ""}
        {!compact && day ? ` · consegna ${day}` : ""}
      </span>
    </span>
  );
}
