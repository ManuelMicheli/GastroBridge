"use client";

import { cn } from "@/lib/utils/formatters";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * SegmentedControl — iOS-style pill-inset picker.
 * Background = --ios-fill-quinary; on = --ios-surface with shadow.
 * Touch target ≥ 32px via padding. Keyboard: arrow keys cycle.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  function handleKeyDown(e: React.KeyboardEvent) {
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = options[(idx + 1) % options.length];
      if (next) onChange(next.value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = options[(idx - 1 + options.length) % options.length];
      if (prev) onChange(prev.value);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex gap-0.5 rounded-lg p-0.5",
        "bg-[color:var(--ios-fill-quinary)]",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition",
              "min-h-[32px]",
              active
                ? "bg-[color:var(--ios-surface)] text-[color:var(--color-text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-[color:var(--color-text-secondary,#6B6B6B)]"
            )}
          >
            {opt.label}
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "ml-1.5 text-[10px] font-semibold",
                  active ? "text-[color:var(--color-brand-primary)]" : "opacity-70"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
