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
    <div className="inline-flex items-center gap-1.5">
      <Link
        href={prevHref}
        aria-label={view === "week" ? "Settimana precedente" : "Mese precedente"}
        className="f-icon-btn !h-9 !w-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <Link
        href={todayHref}
        className="f-btn f-btn-sm f-btn-outline"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Oggi
      </Link>
      <Link
        href={nextHref}
        aria-label={view === "week" ? "Settimana successiva" : "Mese successivo"}
        className="f-icon-btn !h-9 !w-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
