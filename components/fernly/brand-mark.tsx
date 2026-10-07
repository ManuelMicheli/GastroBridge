import { cn } from "@/lib/utils/formatters";

/**
 * GastroBridge mark for the app shell: rounded square in the workspace
 * accent with a bridge arch — sized like the reference logo tile.
 */
export function BrandMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px]", className)}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(160deg, var(--acc-600), var(--acc-800))",
        boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, 0 4px 10px color-mix(in oklab, var(--acc-800) 30%, transparent)",
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
        <path d="M3 17.5h18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M5 17.5V14a7 7 0 0 1 14 0v3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M9.2 17.5v-2.6M14.8 17.5v-2.6M12 17.5v-3.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[18px] font-semibold tracking-[-0.02em] text-[var(--f-ink)]", className)}>
      Gastro<span className="text-[var(--acc-600)]">Bridge</span>
    </span>
  );
}
