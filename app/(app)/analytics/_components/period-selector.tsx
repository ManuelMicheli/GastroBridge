"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PERIOD_KEYS, PERIOD_LABELS, type PeriodKey } from "@/lib/analytics/period";

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
      className={`inline-flex flex-wrap gap-1 p-1 rounded-xl bg-surface-elevated border border-border-subtle ${
        pending ? "opacity-60" : ""
      }`}
    >
      {PERIOD_KEYS.map((key) => {
        const isActive = key === current;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            disabled={pending}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? "bg-accent-green text-surface-base shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
