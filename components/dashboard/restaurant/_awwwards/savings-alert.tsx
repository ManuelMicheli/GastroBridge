// components/dashboard/restaurant/_awwwards/savings-alert.tsx
//
// Single-line alert strip used below the KPI hero. When savings > 0 we show
// a green-accented actionable bar; otherwise a tertiary placeholder.

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/formatters";

export function SavingsAlert({ savings }: { savings: number }) {
  if (savings <= 0) {
    return (
      <p className="px-4 py-2 font-mono text-[11px] text-text-tertiary">
        Gli alert saranno disponibili dopo i primi ordini.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-r-lg border-l-[3px] border-accent-green bg-accent-green/5 px-4 py-3">
      <span
        aria-hidden
        className="font-mono text-[13px] leading-none text-accent-green"
      >
        ◆
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green">
        Alert · Risparmio
      </span>
      <span className="flex-1 min-w-[200px] text-[13px] text-text-secondary">
        Potresti risparmiare{" "}
        <span className="font-mono tabular-nums text-text-primary">
          ~{formatCurrency(savings)}
        </span>{" "}
        analizzando il confronto prezzi dei fornitori.
      </span>
      <Link
        href="/fornitori"
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green hover:text-text-primary transition-colors"
      >
        scopri come →
      </Link>
    </div>
  );
}
