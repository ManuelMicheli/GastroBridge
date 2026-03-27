import { cn } from "@/lib/utils/formatters";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";

type OrderStatus = "draft" | "submitted" | "confirmed" | "preparing" | "shipping" | "delivered" | "cancelled";

const STATUS_STYLES: Record<OrderStatus, { dot: string; text: string; bg: string }> = {
  draft: { dot: "bg-text-tertiary", text: "text-text-tertiary", bg: "bg-surface-hover" },
  submitted: { dot: "bg-accent-orange", text: "text-accent-orange", bg: "bg-accent-orange-muted" },
  confirmed: { dot: "bg-accent-green", text: "text-accent-green", bg: "bg-accent-green-muted" },
  preparing: { dot: "bg-accent-orange", text: "text-accent-orange", bg: "bg-accent-orange-muted" },
  shipping: { dot: "bg-accent-blue", text: "text-accent-blue", bg: "bg-accent-blue-muted" },
  delivered: { dot: "bg-accent-green", text: "text-accent-green", bg: "bg-accent-green-muted" },
  cancelled: { dot: "bg-accent-red", text: "text-accent-red", bg: "bg-accent-red-muted" },
};

type Props = {
  status: OrderStatus;
};

export function StatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const label = ORDER_STATUS_LABELS[status] || status;

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", style.text, style.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {label}
    </span>
  );
}
