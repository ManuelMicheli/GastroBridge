// Fernly primitives shared by the redesigned app pages.
// Visual spec: docs/superpowers/specs/2026-10-07-fernly-style-redesign.md

import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";

/* ------------------------------------------------------------------ */
/* Rise — stagger-in wrapper (CSS keyframes, spec §5 "page enter")      */
/* ------------------------------------------------------------------ */

export function riseStyle(i: number, extraDelayMs = 0): CSSProperties {
  return { ["--i" as string]: i, ["--d" as string]: `${extraDelayMs}ms` } as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* FCard — white card with optional header row                          */
/* ------------------------------------------------------------------ */

export function FCard({
  title,
  action,
  children,
  className,
  bodyClassName,
  index,
  as: Tag = "section",
  id,
  ariaLabel,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Stagger index for the enter animation; omit to skip the animation. */
  index?: number;
  as?: "section" | "div" | "article" | "aside";
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <Tag
      id={id}
      aria-label={ariaLabel}
      className={cn("f-card flex min-w-0 flex-col p-5 sm:px-[22px]", index !== undefined && "f-rise", className)}
      style={index !== undefined ? riseStyle(index) : undefined}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="f-card-title truncate">{title}</h2> : <span />}
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      )}
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Arrow circle (KPI card corner)                                       */
/* ------------------------------------------------------------------ */

export function ArrowCircle({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:rotate-45",
        inverted
          ? "bg-white text-[var(--acc-900)]"
          : "border-[1.5px] border-[var(--f-ink)] text-[var(--f-ink)]",
        className,
      )}
    >
      <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status pill                                                          */
/* ------------------------------------------------------------------ */

export type FTone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";

export function StatusPill({
  tone,
  children,
  className,
  dot = false,
}: {
  tone: FTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("f-status", className)} data-tone={tone}>
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const TONE_MAP: Record<string, FTone> = {
  emerald: "success",
  amber: "warning",
  rose: "danger",
  blue: "info",
  brand: "accent",
  neutral: "neutral",
};

export function orderTone(status: string): FTone {
  return TONE_MAP[getOrderStatusMeta(status).tone] ?? "neutral";
}

export function OrderStatusPill({ status, className }: { status: string; className?: string }) {
  const meta = getOrderStatusMeta(status);
  return (
    <span className={cn("f-status", className)} data-tone={orderTone(status)} role="status" aria-label={`Stato: ${meta.label}`}>
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar — pastel initials circle with optional presence dot           */
/* ------------------------------------------------------------------ */

const PASTELS: Array<[string, string]> = [
  ["#F6D5CC", "#7A3B2A"], // peach
  ["#F4CFD3", "#7B2E3A"], // rose
  ["#D3EBD9", "#2E5E3E"], // mint
  ["#D9DCF7", "#3A3F8A"], // periwinkle
  ["#F6E7C1", "#6E5316"], // butter
  ["#E4D6F2", "#5A3A80"], // lilac
  ["#CFEAEA", "#2B5D5E"], // aqua
  ["#F2DCC6", "#6E4520"], // sand
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "—";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";
}

export function pastelFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PASTELS[h % PASTELS.length]!;
}

export function Avatar({
  name,
  size = 40,
  presence,
  className,
  ring = false,
}: {
  name: string;
  size?: number;
  presence?: "online" | "away" | null;
  className?: string;
  ring?: boolean;
}) {
  const [bg, fg] = pastelFor(name);
  const dot = Math.max(8, Math.round(size * 0.22));
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold", ring && "ring-2 ring-[var(--f-card)]", className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.34) }}
      aria-hidden
    >
      {initialsOf(name)}
      {presence ? (
        <span
          className="absolute rounded-full ring-2 ring-[var(--f-card)]"
          style={{
            width: dot,
            height: dot,
            right: size > 48 ? 2 : -1,
            bottom: size > 48 ? 2 : -1,
            background: presence === "online" ? "#22A55B" : "#E2A21B",
          }}
        />
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Icon tile — small colourful square used in list cards                */
/* ------------------------------------------------------------------ */

export function IconTile({ seed, children, size = 36 }: { seed: string; children: ReactNode; size?: number }) {
  const [bg, fg] = pastelFor(seed);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[11px]"
      style={{ width: size, height: size, background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Delta chip — "5 ▲" tiny outlined chip of the KPI caption             */
/* ------------------------------------------------------------------ */

export function DeltaChip({
  value,
  up,
  inverted = false,
}: {
  value: string;
  up: boolean | null;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center gap-0.5 rounded-[5px] border px-1 text-[10.5px] font-medium tabular-nums",
        inverted ? "border-white/45 text-white/85" : "border-[var(--f-line-strong)] text-[var(--f-ink-2)]",
      )}
    >
      {value}
      {up === null ? null : (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={up ? "" : "rotate-180"}>
          <path d="M4 1.5 7 6H1z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Legend dot                                                           */
/* ------------------------------------------------------------------ */

export function LegendDot({ color, hatch = false, children }: { color?: string; hatch?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--f-muted)]">
      <span
        aria-hidden
        className={cn("inline-block h-3 w-3 rounded-full", hatch && "f-hatch ring-1 ring-[var(--f-line-strong)]")}
        style={hatch ? undefined : { background: color }}
      />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Empty block inside a card                                            */
/* ------------------------------------------------------------------ */

export function CardEmpty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[var(--f-line-strong)] px-4 py-6 text-center text-[13px] text-[var(--f-muted)]">
      <div>{children}</div>
      {action}
    </div>
  );
}
