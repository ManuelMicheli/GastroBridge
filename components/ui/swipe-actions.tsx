"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  tone?: "brand" | "destructive" | "success" | "neutral";
}

interface SwipeActionsProps {
  /** Revealed by swiping right (finger drags left→right). Mount on the left edge. */
  leading?: SwipeAction[];
  /** Revealed by swiping left (finger drags right→left). Mount on the right edge. */
  trailing?: SwipeAction[];
  children: ReactNode;
  className?: string;
  /** Max offset in px. Default 80 per action, capped at 160. */
  maxOffset?: number;
}

const toneClasses: Record<NonNullable<SwipeAction["tone"]>, string> = {
  brand:
    "bg-[color:var(--color-brand-primary)] text-[color:var(--color-brand-on-primary)]",
  destructive: "bg-[#C93737] text-white",
  success: "bg-[#1A8F50] text-white",
  neutral: "bg-[color:var(--ios-fill-quaternary)] text-[color:var(--color-text-primary)]",
};

/**
 * SwipeActions — touch drag reveals iOS-style row actions.
 * Left drag (→) reveals `trailing` actions; right drag reveals `leading`.
 * Haptic via navigator.vibrate when reveal threshold crossed.
 * Respects prefers-reduced-motion (drag works, no spring bounce).
 */
export function SwipeActions({
  leading,
  trailing,
  children,
  className,
  maxOffset = 80,
}: SwipeActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const hapticRef = useRef(false);

  const trailingWidth = Math.min(
    maxOffset * (trailing?.length ?? 0),
    maxOffset * 2
  );
  const leadingWidth = Math.min(
    maxOffset * (leading?.length ?? 0),
    maxOffset * 2
  );

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    startXRef.current = e.clientX - offset;
    hapticRef.current = false;
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    let dx = e.clientX - startXRef.current;
    // Clamp to reveal widths
    if (dx < 0) {
      dx = Math.max(-trailingWidth, dx);
    } else if (dx > 0) {
      dx = Math.min(leadingWidth, dx);
    } else {
      dx = 0;
    }
    if (
      !hapticRef.current &&
      Math.abs(dx) > 0.6 * Math.max(trailingWidth, leadingWidth) &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate?.(10);
      hapticRef.current = true;
    }
    setOffset(dx);
  }

  function onPointerUp() {
    if (startXRef.current === null) return;
    startXRef.current = null;
    // Snap: if > half reveal, stay; else close
    if (offset < 0 && Math.abs(offset) > trailingWidth / 2) {
      setOffset(-trailingWidth);
    } else if (offset > 0 && offset > leadingWidth / 2) {
      setOffset(leadingWidth);
    } else {
      setOffset(0);
    }
  }

  function close() {
    setOffset(0);
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative isolate overflow-hidden", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: "pan-y" }}
    >
      {leading && leading.length > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex"
          style={{ width: `${leadingWidth}px` }}
          aria-hidden={offset <= 0}
        >
          {leading.map((a, i) => (
            <button
              key={`l-${i}`}
              type="button"
              onClick={() => {
                a.onClick();
                close();
              }}
              className={cn(
                "flex-1 px-3 text-[11px] font-semibold",
                toneClasses[a.tone ?? "brand"]
              )}
            >
              <span className="flex flex-col items-center gap-1">
                {a.icon}
                {a.label}
              </span>
            </button>
          ))}
        </div>
      )}
      {trailing && trailing.length > 0 && (
        <div
          className="absolute inset-y-0 right-0 flex"
          style={{ width: `${trailingWidth}px` }}
          aria-hidden={offset >= 0}
        >
          {trailing.map((a, i) => (
            <button
              key={`t-${i}`}
              type="button"
              onClick={() => {
                a.onClick();
                close();
              }}
              className={cn(
                "flex-1 px-3 text-[11px] font-semibold",
                toneClasses[a.tone ?? "brand"]
              )}
            >
              <span className="flex flex-col items-center gap-1">
                {a.icon}
                {a.label}
              </span>
            </button>
          ))}
        </div>
      )}
      <div
        className="relative bg-[color:var(--ios-surface)]"
        style={{
          transform: `translateX(${offset}px)`,
          transition:
            startXRef.current === null && !prefersReducedMotion
              ? "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)"
              : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
