// components/dashboard/restaurant/_awwwards/quick-action-bar.tsx
//
// Horizontal pill bar of quick actions. Replaces the 4-tile grid.
// Each pill: mono label + arrow glyph, wraps on narrow viewports.

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Pill = { href: string; label: string };

const PILLS: Pill[] = [
  { href: "/cerca", label: "Cerca prodotti" },
  { href: "/fornitori", label: "Fornitori" },
  { href: "/ordini", label: "Ordini" },
  { href: "/cerca/ordine", label: "Carrello" },
];

export function QuickActionBar() {
  return (
    <nav
      aria-label="Azioni rapide"
      className="flex flex-wrap items-center gap-2"
    >
      {PILLS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className="group inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 font-mono text-[12px] text-text-secondary transition-colors hover:border-accent-green/40 hover:text-text-primary"
        >
          <ArrowRight
            className="h-3 w-3 text-text-tertiary transition-colors group-hover:text-accent-green"
            aria-hidden
          />
          <span>{p.label}</span>
        </Link>
      ))}
      <span
        aria-hidden
        className="ml-auto hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary sm:inline-flex"
      >
        <kbd className="rounded border border-border-subtle bg-surface-base px-1.5 py-0.5 text-[10px] text-text-tertiary">
          ?
        </kbd>
        shortcuts
      </span>
    </nav>
  );
}
