// components/dashboard/restaurant/_awwwards/section-frame.tsx
//
// Terminal-styled frame with a "─ LABEL ─" header rule.
// Used across the restaurant dashboard to wrap KPI grids, chart, feeds.
// The header renders a caption label on the left and an optional trailing
// accessory (usually a "vedi tutti →" link or a live timestamp).

import type { ReactNode } from "react";

export function SectionFrame({
  label,
  trailing,
  className = "",
  padded = true,
  children,
}: {
  label: string;
  trailing?: ReactNode;
  className?: string;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={`rounded-xl border border-border-subtle bg-surface-card ${className}`}
    >
      <header className="flex items-center gap-3 px-4 pt-3 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-primary">
          {label}
        </span>
        <span
          aria-hidden
          className="h-px flex-1 bg-border-subtle"
        />
        {trailing ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            {trailing}
          </span>
        ) : null}
      </header>
      <div className={padded ? "px-4 pb-4 pt-2" : ""}>{children}</div>
    </section>
  );
}
