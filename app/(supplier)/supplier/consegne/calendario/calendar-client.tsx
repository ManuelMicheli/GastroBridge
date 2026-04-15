"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

type Props = {
  view: "week" | "month";
  prevHref: string;
  nextHref: string;
  todayHref: string;
};

export function CalendarClient({ view, prevHref, nextHref, todayHref }: Props) {
  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={prevHref}
        aria-label={view === "week" ? "Settimana precedente" : "Mese precedente"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary hover:text-text-primary hover:border-accent-green/40 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <Link
        href={todayHref}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border-subtle bg-surface-card text-sm text-text-secondary hover:text-text-primary hover:border-accent-green/40 transition-colors"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Oggi
      </Link>
      <Link
        href={nextHref}
        aria-label={view === "week" ? "Settimana successiva" : "Mese successivo"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary hover:text-text-primary hover:border-accent-green/40 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
