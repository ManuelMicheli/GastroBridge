// app/(app)/cerca/_components/facet-group.tsx
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function FacetGroup({
  label,
  children,
  defaultOpen = true,
  activeCount = 0,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  activeCount?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          {label}
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-accent-green/15 px-1 font-mono text-[9px] text-accent-green">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-tertiary transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </section>
  );
}

export function FacetCheckboxRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1 text-[13px] hover:bg-surface-hover">
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-accent-green)]"
        />
        <span className={`truncate ${checked ? "text-text-primary" : "text-text-secondary"}`}>
          {label}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-tertiary">
        {count}
      </span>
    </label>
  );
}
