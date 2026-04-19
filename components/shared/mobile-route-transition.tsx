"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const EDGE_SWIPE_WIDTH = 20;
const COMMIT_THRESHOLD_RATIO = 0.45;
const COMMIT_VELOCITY = 0.6;

/**
 * MobileRouteTransition — shared page-transition wrapper for restaurant
 * and supplier area templates. Provides:
 *   - fade-up enter on route change (respects reduced-motion)
 *   - scroll-top + h1 focus for a11y
 *   - edge-swipe-back gesture (touch-only, bordo sx 20px) → router.back()
 */
export function MobileRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathname = useRef(pathname);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const isRouteChange = prevPathname.current !== pathname;
    prevPathname.current = pathname;
    const el = wrapperRef.current;
    if (!el) return;

    if (isRouteChange) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

      requestAnimationFrame(() => {
        const h1 = el.querySelector("h1");
        if (h1) {
          if (!h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
          (h1 as HTMLElement).focus({ preventScroll: true });
        }
      });

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) return;
      el.style.opacity = "0";
      el.style.transform = "translateY(4px)";
      requestAnimationFrame(() => {
        el.style.transition =
          "opacity var(--duration-page, 240ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)), transform var(--duration-page, 240ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1))";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    }
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      if (e.clientX > EDGE_SWIPE_WIDTH) return;
      if (window.scrollX > 0) return;
      if (typeof window !== "undefined" && window.history.length <= 1) return;
      startRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      activeRef.current = true;
    }
    function onPointerMove(e: PointerEvent) {
      if (!activeRef.current || !startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = Math.abs(e.clientY - startRef.current.y);
      if (dy > Math.abs(dx) * 0.75) {
        activeRef.current = false;
        setSwipeOffset(0);
        return;
      }
      if (dx < 0) return;
      const clamped = Math.min(window.innerWidth, dx);
      setSwipeOffset(clamped);
    }
    function onPointerUp(e: PointerEvent) {
      if (!activeRef.current || !startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dt = performance.now() - startRef.current.t;
      const velocity = dt > 0 ? dx / dt : 0;
      activeRef.current = false;
      startRef.current = null;

      const shouldCommit =
        dx > window.innerWidth * COMMIT_THRESHOLD_RATIO ||
        velocity > COMMIT_VELOCITY;

      if (shouldCommit) {
        setSwipeOffset(window.innerWidth);
        window.setTimeout(() => {
          router.back();
          setSwipeOffset(0);
        }, 160);
      } else {
        setSwipeOffset(0);
      }
    }

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [router]);

  return (
    <div
      ref={wrapperRef}
      key={pathname}
      style={{
        opacity: 1,
        transform: `translate3d(${swipeOffset}px, 0, 0)`,
        transition:
          swipeOffset === 0 && !startRef.current
            ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity var(--duration-page, 240ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1))"
            : swipeOffset > 0 && !startRef.current
              ? "transform 160ms ease-out"
              : "none",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
