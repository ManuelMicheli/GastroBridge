// components/ui/order-status-badge.tsx
//
// Tinted pill rendering the canonical meta for an order status.
// Reads from ORDER_STATUS_META via getOrderStatusMeta, falling back to
// a neutral capitalized label for unknown statuses.

import { cn } from "@/lib/utils/formatters";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { StatusDot } from "./status-dot";
import { CelebrationCheck } from "./celebration-check";

type Size = "xs" | "sm" | "md";

type Props = {
  status: string;
  size?: Size;
  showIcon?: boolean;
  celebrate?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "text-[10px] px-1.5 py-0 gap-1",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-[12px] px-2.5 py-1 gap-1.5",
};

const DOT_SIZE: Record<Size, number> = { xs: 4, sm: 6, md: 7 };
const CHECK_SIZE: Record<Size, number> = { xs: 10, sm: 12, md: 14 };

export function OrderStatusBadge({
  status,
  size = "sm",
  showIcon = true,
  celebrate = false,
  className,
}: Props) {
  const meta = getOrderStatusMeta(status);
  const style = {
    background: `var(--tone-${meta.tone}-bg)`,
    color: `var(--tone-${meta.tone}-fg)`,
    boxShadow: `inset 0 0 0 1px var(--tone-${meta.tone}-ring)`,
  } as React.CSSProperties;

  return (
    <span
      role="status"
      aria-label={`Stato: ${meta.label}`}
      data-tone={meta.tone}
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums tracking-tight whitespace-nowrap",
        SIZE_CLASSES[size],
        className,
      )}
      style={style}
    >
      {showIcon ? (
        <StatusDot
          tone={meta.tone}
          size={DOT_SIZE[size]}
          pulse={meta.pulse}
        />
      ) : null}
      {celebrate && meta.terminal === "ok" ? (
        <CelebrationCheck size={CHECK_SIZE[size]} tone="emerald" />
      ) : null}
      <span>{meta.label}</span>
    </span>
  );
}
