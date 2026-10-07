"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PERIOD_KEYS, PERIOD_LABELS, type PeriodKey } from "@/lib/analytics/period";
import { Chips } from "@/components/fernly/chips";

const SHORT_LABELS: Record<PeriodKey, string> = {
  current: "Mese",
  prev: "Mese scorso",
  last3: "3M",
  last12: "12M",
  year: "Anno",
};

type Props = {
  current: PeriodKey;
};

/** Range segmented control (?period=) — the active pill slides on change. */
export function PeriodSelector({ current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Optimistic selection so the pill moves immediately while data loads.
  const [selected, setSelected] = useState<PeriodKey>(current);
  useEffect(() => setSelected(current), [current]);

  function setPeriod(key: PeriodKey) {
    if (key === current) return;
    setSelected(key);
    const next = new URLSearchParams(params);
    next.set("period", key);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <Chips
      ariaLabel="Periodo"
      size="sm"
      value={selected}
      onChange={setPeriod}
      className={pending ? "opacity-80" : undefined}
      options={PERIOD_KEYS.map((k) => ({ value: k, label: SHORT_LABELS[k], title: PERIOD_LABELS[k] }))}
    />
  );
}
