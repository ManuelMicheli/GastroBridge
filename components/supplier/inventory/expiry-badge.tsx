import { getExpiryInfo, getExpiryLabel } from "@/lib/supplier/stock/expiry-severity";

type Props = {
  expiryDate: string | null;
  /** Override di "oggi" per test/snapshot. */
  today?: Date;
  className?: string;
};

const CLASSES: Record<
  "expired" | "critical" | "warning" | "ok" | "none",
  string
> = {
  expired: "bg-accent-red/20 text-accent-red border border-accent-red/30",
  critical: "bg-accent-amber/20 text-accent-amber border border-accent-amber/30",
  warning: "bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30",
  ok: "bg-surface-hover text-text-secondary border border-border-subtle",
  none: "bg-surface-hover text-text-tertiary border border-border-subtle",
};

/**
 * Badge "semaforo" per la scadenza di un lotto.
 *
 * - rosso: scaduto (giorni < 0)
 * - ambra: ≤ 7 giorni
 * - giallo: ≤ 30 giorni
 * - neutro: oltre 30 giorni o nessuna data
 */
export function ExpiryBadge({ expiryDate, today, className }: Props) {
  const info = getExpiryInfo(expiryDate, today);
  const label = getExpiryLabel(info);
  const dateLabel = expiryDate
    ? new Date(expiryDate).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSES[info.severity]} ${className ?? ""}`}
      title={dateLabel ?? "Senza scadenza"}
    >
      <span>{label}</span>
      {dateLabel && info.severity !== "none" ? (
        <span className="text-[0.65rem] opacity-70">{dateLabel}</span>
      ) : null}
    </span>
  );
}
