"use client";

import { useEffect, useRef, type RefObject } from "react";

type Options = {
  strength?: number;
  radius?: number;
  lerp?: number;
};

export function useMagnetic<T extends HTMLElement>(
  options: Options = {}
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { strength = 0.35, radius = 120, lerp = 0.18 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarse || reduced) return;

    let raf = 0;
    let active = false;
    const current = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    function tick() {
      current.x += (target.x - current.x) * lerp;
      current.y += (target.y - current.y) * lerp;
      if (el) {
        el.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;
      }
      if (
        active ||
        Math.abs(target.x - current.x) > 0.05 ||
        Math.abs(target.y - current.y) > 0.05
      ) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    }

    function onMove(e: PointerEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        target.x = 0;
        target.y = 0;
      } else {
        target.x = dx * strength;
        target.y = dy * strength;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function onEnter() {
      active = true;
    }
    function onLeave() {
      active = false;
      target.x = 0;
      target.y = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      if (el) el.style.transform = "";
    };
  }, [strength, radius, lerp]);

  return ref;
}
