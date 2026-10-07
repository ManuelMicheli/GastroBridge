"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";
import { CountUp, type CountFormat } from "./count-up";
import { ArrowCircle, riseStyle } from "./primitives";

type Props = {
  title: string;
  value: number;
  format?: CountFormat;
  /** Filled accent gradient card (first card of the row). */
  hero?: boolean;
  href?: string;
  /** Caption row under the number (e.g. <DeltaChip/> + text). */
  caption?: ReactNode;
  index?: number;
  className?: string;
  /** Replaces the counted number (e.g. "—" when not applicable). */
  valueOverride?: ReactNode;
};

/**
 * KPI card — title, ↗ circle, big counted number, caption row.
 * Hero variant = accent gradient + arc texture, white text.
 */
export function KpiCard({
  title,
  value,
  format = "number",
  hero = false,
  href,
  caption,
  index,
  className,
  valueOverride,
}: Props) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("text-[15px] font-medium leading-5 tracking-[-0.01em]", hero ? "text-white/92" : "text-[var(--f-ink)]")}>
          {title}
        </h3>
        <ArrowCircle inverted={hero} />
      </div>
      <div
        className={cn(
          "mt-3 text-[32px] font-medium leading-none tracking-[-0.035em] tabular-nums sm:text-[42px] xl:text-[46px]",
          hero ? "text-white" : "text-[var(--f-ink)]",
        )}
      >
        {valueOverride ?? <CountUp value={value} format={format} />}
      </div>
      {caption ? (
        <div className={cn("mt-3 flex min-h-[18px] items-center gap-1.5 text-[12px]", hero ? "text-white/72" : "text-[var(--f-muted)]")}>
          {caption}
        </div>
      ) : null}
    </>
  );

  const cls = cn(
    "group f-card relative flex min-w-0 flex-col overflow-hidden px-5 pb-4 pt-[18px]",
    hero && "f-hero",
    index !== undefined && "f-rise",
    href && "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls} style={index !== undefined ? riseStyle(index) : undefined}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} style={index !== undefined ? riseStyle(index) : undefined}>
      {body}
    </div>
  );
}
