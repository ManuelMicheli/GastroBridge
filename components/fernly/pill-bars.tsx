"use client";

import { cn } from "@/lib/utils/formatters";

export type PillBar = {
  key: string;
  /** Short axis label (e.g. "L"). */
  label: string;
  value: number;
  /** "filled" = real elapsed value, "hatched" = not yet elapsed / reference. */
  kind: "filled" | "hatched";
  shade?: "dark" | "mid" | "light";
  /** Accessible / tooltip description. */
  title: string;
  /** Pill label rendered above the bar (only one bar usually has it). */
  badge?: string;
};

const SHADE: Record<NonNullable<PillBar["shade"]>, string> = {
  dark: "var(--acc-900)",
  mid: "var(--acc-600)",
  light: "var(--acc-400)",
};

/**
 * Fernly "Project Analytics" chart: tall fully-rounded pill bars, filled in
 * three accent shades for elapsed days and hatched grey for days that have
 * not happened yet. Bars grow from the baseline with a 60 ms stagger.
 */
export function PillBars({ bars, height = 190 }: { bars: PillBar[]; height?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full items-end justify-between gap-[3%]" style={{ height }} role="list">
        {bars.map((b, i) => {
          const pct = Math.max(0.2, Math.min(1, b.value / max));
          return (
            <div key={b.key} role="listitem" aria-label={b.title} title={b.title} className="relative flex h-full flex-1 items-end justify-center">
              <div className="relative flex w-full max-w-[64px] flex-col items-center justify-end" style={{ height: `${pct * 100}%` }}>
                {b.badge ? (
                  <div className="f-fade absolute -top-9 flex flex-col items-center" style={{ ["--d" as string]: `${500 + i * 60}ms` }}>
                    <span className="whitespace-nowrap rounded-full border border-[var(--f-line)] bg-[var(--f-card)] px-2 py-[3px] text-[11px] font-semibold text-[var(--f-ink)] shadow-[0_2px_6px_rgba(16,24,20,0.08)] tabular-nums">
                      {b.badge}
                    </span>
                    <span className="h-2 w-px bg-[var(--f-line-strong)]" />
                  </div>
                ) : null}
                <div
                  className={cn("f-grow-y h-full w-full rounded-full", b.kind === "hatched" && "f-hatch")}
                  style={{
                    ["--i" as string]: i,
                    ["--d" as string]: "120ms",
                    background: b.kind === "filled" ? SHADE[b.shade ?? "mid"] : undefined,
                    boxShadow: b.kind === "hatched" ? "inset 0 0 0 1px var(--f-line)" : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex w-full justify-between gap-[3%]">
        {bars.map((b) => (
          <span key={b.key} className="flex-1 text-center text-[12px] font-medium text-[var(--f-muted)]">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
