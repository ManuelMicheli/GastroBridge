// app/(app)/impostazioni/_components/settings-nav-row.tsx
//
// Terminal-dense numbered nav row for the restaurant Settings Terminal.
// Layout: [40px number] [14px arrow] [180px label] [1fr description] [auto chevron]
// Below 640px the description column collapses, grid becomes [32px 14px 1fr].
// Chevron fades in on hover; left border flashes accent-green.

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SettingsNavRow({
  index,
  href,
  label,
  description,
  isLast = false,
}: {
  index: number;
  href: string;
  label: string;
  description: string;
  isLast?: boolean;
}) {
  const num = String(index).padStart(2, "0");

  return (
    <Link
      href={href}
      className={[
        "group relative grid h-12 items-center gap-x-3",
        "grid-cols-[32px_14px_1fr_auto] sm:grid-cols-[40px_14px_180px_1fr_auto]",
        "px-3 sm:px-4",
        "border-l-2 border-transparent hover:border-accent-green",
        "hover:bg-surface-hover",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:ring-offset-0",
        isLast ? "" : "border-b border-border-subtle",
      ].join(" ")}
    >
      {/* index */}
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary tabular-nums">
        {num}
      </span>

      {/* arrow glyph */}
      <span
        aria-hidden
        className="font-mono text-[12px] leading-none text-text-tertiary group-hover:text-accent-green transition-colors"
      >
        {"\u25B8"}
      </span>

      {/* label */}
      <span className="font-mono text-[13px] uppercase tracking-[0.04em] text-text-primary truncate">
        {label}
      </span>

      {/* description – hidden below sm */}
      <span className="hidden sm:block text-[12px] text-text-secondary truncate">
        {description}
      </span>

      {/* chevron */}
      <ChevronRight
        aria-hidden
        className="h-4 w-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </Link>
  );
}
