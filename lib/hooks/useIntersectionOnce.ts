"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sets `hasIntersected` to true the first time the target enters the viewport.
 * Never resets. Use for one-shot enter animations (counters, reveals).
 */
export function useIntersectionOnce<T extends Element>(
  options?: IntersectionObserverInit,
): { ref: React.RefObject<T | null>; hasIntersected: boolean } {
  const ref = useRef<T | null>(null);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || hasIntersected) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasIntersected(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2, ...options },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasIntersected, options]);

  return { ref, hasIntersected };
}
