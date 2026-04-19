"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  /** Threshold in px to trigger refresh. Default 70. */
  threshold?: number;
  /** Disable on non-mobile. Default: always on (component itself only acts on touch pointerType). */
  disabled?: boolean;
}

/**
 * PullToRefresh — touch-driven pull gesture to reload data.
 * Only triggers when scrollTop is 0 and pointerType is touch.
 * Respects prefers-reduced-motion (no bounce animation, instant feedback).
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 70,
  disabled = false,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || refreshing || e.pointerType !== "touch") return;
    const el = containerRef.current;
    if (!el) return;
    // Only start if user is at top of scroll
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) return;
    startYRef.current = e.clientY;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startYRef.current === null || refreshing) return;
    const dy = e.clientY - startYRef.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Damped pull (logarithmic-ish)
    const damped = Math.min(threshold * 1.4, dy * 0.5);
    setPull(damped);
  }

  async function handlePointerUp() {
    if (startYRef.current === null) return;
    const pulled = pull;
    startYRef.current = null;
    if (pulled >= threshold && !refreshing) {
      setRefreshing(true);
      setPull(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  const translate = refreshing ? threshold : pull;
  const progress = Math.min(1, translate / threshold);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn("relative", className)}
      style={{ touchAction: "pan-y" }}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 right-0 flex justify-center",
          prefersReducedMotion ? "" : "transition-[top,opacity] duration-150"
        )}
        style={{
          top: `${translate - 28}px`,
          opacity: progress,
        }}
      >
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            "bg-[color:var(--color-brand-primary)] text-white shadow-md",
            refreshing ? "animate-spin" : ""
          )}
          style={
            !refreshing
              ? { transform: `rotate(${progress * 360}deg)` }
              : undefined
          }
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <path
              d="M8 2 L8 8 L12 10"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${translate}px)`,
          transition:
            startYRef.current === null && !refreshing && !prefersReducedMotion
              ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)"
              : refreshing && !prefersReducedMotion
                ? "transform 180ms ease-out"
                : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
