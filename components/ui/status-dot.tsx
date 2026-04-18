// components/ui/status-dot.tsx
//
// Decorative colored dot used inside status badges, filter chips, and
// dense log rows. aria-hidden -- the accessible label lives on the parent.
// When pulse=true, renders an absolute-positioned animated ring layer
// (hidden under prefers-reduced-motion).

import { cn } from "@/lib/utils/formatters";
import type { StatusTone } from "@/lib/ui/tones";

type Props = {
  tone: StatusTone;
  size?: number;
  pulse?: boolean;
  className?: string;
};

export function StatusDot({ tone, size = 6, pulse = false, className }: Props) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: `var(--tone-${tone}-fg)`,
  };

  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block shrink-0 rounded-full", className)}
      style={style}
    >
      {pulse ? (
        <span
          aria-hidden
          className="absolute inset-[-3px] rounded-full border-2 opacity-60 motion-reduce:hidden"
          style={{
            borderColor: `var(--tone-${tone}-fg)`,
            animation: "pulse-ring var(--duration-pulse, 1800ms) ease-out infinite",
          }}
        />
      ) : null}
    </span>
  );
}
