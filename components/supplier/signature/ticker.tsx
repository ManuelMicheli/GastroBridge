"use client";

import { type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils/formatters";

export type TickerItem = {
  key: string;
  label: string;
  value: string;
  icon?: ReactNode;
};

type Props = {
  items: TickerItem[];
  speed?: number;
  pauseOnHover?: boolean;
  className?: string;
};

export function Ticker({
  items,
  speed = 45,
  pauseOnHover = true,
  className,
}: Props) {
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-border-subtle bg-surface-page",
        "[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      aria-label="Live data ticker"
    >
      <div
        ref={trackRef}
        className="flex items-center gap-6 whitespace-nowrap py-2.5 px-4 motion-reduce:animate-none"
        style={{
          animation: `ticker-scroll ${speed}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}
      >
        {doubled.map((item, i) => (
          <span
            key={`${item.key}-${i}`}
            className="flex items-center gap-2 font-mono text-[11px] text-brand-depth"
          >
            {item.icon}
            <span className="text-text-secondary">{item.label}</span>
            <b className="text-brand-primary font-semibold">{item.value}</b>
            <span
              aria-hidden
              className="mx-4 inline-block size-1 rounded-full bg-brand-highlight"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
