"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Fires router.prefetch for a list of routes in the browser idle queue.
 *
 * Why: Next.js <Link> only prefetches when the link is in the viewport or
 * hovered. Sidebar items in a collapsed sidebar, or nav entries that scroll
 * out of view, never get prefetched. We want every top-level section to have
 * its RSC payload warm so clicks feel instant.
 *
 * Strategy: on mount, schedule prefetch calls using requestIdleCallback so we
 * don't compete with initial-paint work. Each prefetch fires independently.
 */
export function IdlePrefetch({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ric: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number =
      (window as unknown as { requestIdleCallback?: typeof requestIdleCallback })
        .requestIdleCallback ??
      ((cb) => window.setTimeout(() => cb({
        didTimeout: false,
        timeRemaining: () => 0,
      } as IdleDeadline), 200));

    const cic: (id: number) => void =
      (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback ?? ((id) => window.clearTimeout(id));

    const handles: number[] = [];

    for (const href of hrefs) {
      const h = ric(() => {
        try {
          router.prefetch(href);
        } catch {
          // noop — prefetch is best-effort
        }
      });
      handles.push(h);
    }

    return () => {
      handles.forEach((h) => cic(h));
    };
  }, [hrefs, router]);

  return null;
}
