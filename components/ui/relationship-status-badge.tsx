// components/ui/relationship-status-badge.tsx
//
// Domain twin of OrderStatusBadge for supplier<->restaurant relationship
// states. No pulse, no celebrate.

import { cn } from "@/lib/utils/formatters";
import { getRelationshipStatusMeta } from "@/lib/relationships/status-meta";
import { StatusDot } from "./status-dot";

type Size = "xs" | "sm" | "md";

type Props = {
  status: string;
  size?: Size;
  showIcon?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "text-[10px] px-1.5 py-0 gap-1",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-[12px] px-2.5 py-1 gap-1.5",
};

const DOT_SIZE: Record<Size, number> = { xs: 4, sm: 6, md: 7 };

export function RelationshipStatusBadge({
  status,
  size = "sm",
  showIcon = true,
  className,
}: Props) {
  const meta = getRelationshipStatusMeta(status);
  const style = {
    background: `var(--tone-${meta.tone}-bg)`,
    color: `var(--tone-${meta.tone}-fg)`,
    boxShadow: `inset 0 0 0 1px var(--tone-${meta.tone}-ring)`,
  } as React.CSSProperties;

  return (
    <span
      role="status"
      aria-label={`Partnership: ${meta.label}`}
      data-tone={meta.tone}
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums tracking-tight whitespace-nowrap",
        SIZE_CLASSES[size],
        className,
      )}
      style={style}
    >
      {showIcon ? <StatusDot tone={meta.tone} size={DOT_SIZE[size]} /> : null}
      <span>{meta.label}</span>
    </span>
  );
}
