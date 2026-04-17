// app/(app)/cerca/_components/mobile-drawer.tsx
"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";

export function MobileDrawer({
  open,
  onClose,
  side = "left",
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 lg:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} flex w-[86vw] max-w-[380px] flex-col bg-surface-card shadow-2xl`}
      >
        <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            {title}
          </h2>
          <button onClick={onClose} className="text-text-tertiary" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
