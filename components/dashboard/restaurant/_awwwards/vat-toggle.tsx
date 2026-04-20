// components/dashboard/restaurant/_awwwards/vat-toggle.tsx
//
// Compact segmented control for switching the dashboard between net (no IVA)
// and gross (IVA-inclusive) figures. Uses the same terminal/mono vocabulary
// as the rest of the awwwards dashboard and persists the user's choice in
// localStorage so the preference sticks across reloads.

"use client";

export type VatMode = "net" | "gross";

const STORAGE_KEY = "dashboard.vatMode";

export function readInitialVatMode(): VatMode {
  if (typeof window === "undefined") return "net";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "gross" ? "gross" : "net";
}

export function persistVatMode(mode: VatMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage not available (private mode) — silently ignore */
  }
}

export function VatToggle({
  value,
  onChange,
  size = "sm",
}: {
  value: VatMode;
  onChange: (v: VatMode) => void;
  size?: "xs" | "sm";
}) {
  const pad = size === "xs" ? "px-2 py-0.5" : "px-2.5 py-1";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";

  return (
    <div
      role="tablist"
      aria-label="Visualizzazione IVA"
      className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-surface-hover p-0.5"
    >
      {(["net", "gross"] as const).map((m) => {
        const active = m === value;
        const label = m === "net" ? "Senza IVA" : "Con IVA";
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={[
              "rounded-[4px] font-mono uppercase tracking-[0.06em] transition-colors",
              pad,
              text,
              active
                ? "bg-[var(--color-text-primary)] text-[var(--color-surface-card)]"
                : "text-text-tertiary hover:text-text-primary",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
