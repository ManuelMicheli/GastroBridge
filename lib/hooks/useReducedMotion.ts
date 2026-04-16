"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the user prefers reduced motion.
 * SSR-safe: first render returns false to avoid hydration mismatch,
 * then updates on the client once the media query resolves.
 */
export function useReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return prefers;
}
