// Fernly card with a title row — drop-in for the former terminal-style
// "─ LABEL ─" SectionFrame used across both areas (same props).

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
    <section aria-label={label} className={`f-card min-w-0 ${className}`}>
      <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-[18px] sm:px-[22px]">
        <h2 className="f-card-title truncate">{label}</h2>
        {trailing ? (
          <span className="shrink-0 text-[12.5px] text-[var(--f-muted)] tabular-nums">{trailing}</span>
        ) : null}
      </header>
      <div className={padded ? "px-5 pb-5 pt-3 sm:px-[22px]" : "pb-2"}>{children}</div>
    </section>
  );
}
