"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Streams Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to the `/api/vitals`
 * endpoint via `navigator.sendBeacon` so they outlive the page-unload.
 *
 * Mounted once at the root so every route in the app reports.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
        path:
          typeof window !== "undefined"
            ? window.location.pathname
            : undefined,
        ts: Date.now(),
      });

      if (
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/vitals", blob);
      } else {
        // Fallback — keepalive fetch so report survives unload.
        fetch("/api/vitals", {
          method: "POST",
          body,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }
    } catch {
      // silent: vitals reporting must never break the app
    }
  });

  return null;
}
