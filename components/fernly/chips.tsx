"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

export type ChipOption<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number;
  title?: string;
};

type Props<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  /** Chips share the full width (segmented control). */
  stretch?: boolean;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
};

/**
 * Fernly chip group: white rounded rail, the active chip is a filled accent
 * pill that slides between chips (spec §5, ≈320 ms). Behaves as a radio
 * group (arrow keys cycle).
 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  stretch = false,
  size = "md",
  className,
  disabled,
}: Props<T>) {
  const rail = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = rail.current;
    if (!el) return;
    const measure = () => {
      const active = el.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) return setInd(null);
      setInd({ x: active.offsetLeft, w: active.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    let next: ChipOption<T> | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = options[(idx + 1) % options.length];
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = options[(idx - 1 + options.length) % options.length];
    if (next) {
      e.preventDefault();
      onChange(next.value);
      requestAnimationFrame(() => {
        rail.current?.querySelector<HTMLElement>('[data-active="true"]')?.focus();
      });
    }
  }

  return (
    <div
      ref={rail}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("f-chips", stretch && "flex w-full", disabled && "opacity-60", className)}
    >
      <span
        aria-hidden
        className="f-chip-indicator"
        style={{
          width: ind?.w ?? 0,
          transform: `translateX(${ind?.x ?? 0}px)`,
          opacity: ind ? 1 : 0,
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "f-chip",
              stretch && "flex-1 justify-center",
              size === "sm" && "!h-7 !px-3 !text-[12px]",
            )}
          >
            {o.label}
            {typeof o.count === "number" ? <span className="f-chip-count">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
