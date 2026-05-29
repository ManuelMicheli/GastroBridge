"use client";

import { useEffect, type ReactNode } from "react";

export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Smooth scroll is a desktop-only nicety. On touch devices it adds nothing
    // (native momentum scroll is better) and would drag in the Lenis + GSAP
    // chunks. Bail before importing so mobile never pays for them.
    if (coarse || reduced) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    Promise.all([import("lenis"), import("@/lib/gsap-config")]).then(
      ([{ default: Lenis }, { gsap, ScrollTrigger }]) => {
        if (cancelled) return;

        const lenis = new Lenis({
          duration: 1.1,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          wheelMultiplier: 1,
          touchMultiplier: 1.5,
          smoothWheel: true,
        });

        const onScroll = () => ScrollTrigger.update();
        lenis.on("scroll", onScroll);

        const tickerCb = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tickerCb);
        gsap.ticker.lagSmoothing(0);

        cleanup = () => {
          gsap.ticker.remove(tickerCb);
          lenis.off("scroll", onScroll);
          lenis.destroy();
        };
      }
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <>{children}</>;
}
