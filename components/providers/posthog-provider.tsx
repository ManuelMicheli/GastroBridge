"use client";

import { useEffect, type ReactNode } from "react";

// Defer the PostHog SDK off the critical path. The bundle is ~50 kB minified
// and adds a non-trivial main-thread cost on init; it never needs to run
// before LCP. We:
//   1. Skip in dev to keep HMR snappy.
//   2. Skip when keys are absent.
//   3. Dynamically import posthog-js inside requestIdleCallback so the SDK
//      itself is not even fetched until the browser is idle.
//   4. Fall back to a 1.5s setTimeout for browsers without requestIdleCallback.
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) return;

    const init = async () => {
      const mod = await import("posthog-js");
      mod.default.init(key, {
        api_host: host,
        capture_pageview: false,
        capture_pageleave: true,
        // Defer autocapture to keep first interaction free of contention.
        autocapture: false,
        disable_session_recording: true,
      });
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => void init(), { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => void init(), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return <>{children}</>;
}
