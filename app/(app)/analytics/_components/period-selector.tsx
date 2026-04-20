"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PERIOD_KEYS, PERIOD_LABELS, type PeriodKey } from "@/lib/analytics/period";

const SHORT_LABELS: Record<PeriodKey, string> = {
  current: "Corrente",
  prev: "Scorso",
  last3: "3M",
  last12: "12M",
  year: "YTD",
};

type Props = {
  current: PeriodKey;
};

export function PeriodSelector({ current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setPeriod(key: PeriodKey) {
    if (key === current) return;
    const next = new URLSearchParams(params);
    next.set("period", key);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Periodo"
      className={`inline-flex items-center rounded-lg border border-border-subtle bg-surface-card p-0.5 transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      {PERIOD_KEYS.map((key) => {
        const isActive = key === current;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setPeriod(key)}
            disabled={pending}
            title={PERIOD_LABELS[key]}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
              isActive
                ? "bg-accent-green text-surface-base"
                : "text-text-tertiary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            {SHORT_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
