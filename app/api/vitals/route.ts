import { NextResponse } from "next/server";

// Lightweight Web Vitals ingest. Logged at info level — downstream log
// collectors (Vercel, PostHog) can ship to dashboards. Kept intentionally
// minimal to avoid overhead on every field-collected sample.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VitalsPayload = {
  name: string;
  value: number;
  id: string;
  rating?: "good" | "needs-improvement" | "poor";
  delta?: number;
  navigationType?: string;
  path?: string;
  ts?: number;
};

function isValidPayload(x: unknown): x is VitalsPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.value === "number" &&
    typeof o.id === "string"
  );
}

// Strip control characters (incl. CR/LF) that could forge log entries and
// cap length to keep log lines bounded.
function sanitizeForLog(s: string, max = 200): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1f\x7f]/g, "").slice(0, max);
}

const ALLOWED_VITAL_NAMES = new Set([
  "CLS", "FCP", "FID", "INP", "LCP", "TTFB", "Next.js-hydration", "Next.js-route-change-to-render", "Next.js-render",
]);

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    if (!isValidPayload(raw)) {
      return new NextResponse(null, { status: 204 });
    }
    const name = ALLOWED_VITAL_NAMES.has(raw.name) ? raw.name : "other";
    const rating = raw.rating === "good" || raw.rating === "needs-improvement" || raw.rating === "poor" ? raw.rating : "-";
    const path = sanitizeForLog(raw.path ?? "-");
    const value = Number.isFinite(raw.value) ? raw.value.toFixed(1) : "0";
    console.log(`[web-vitals] ${name}=${value} rating=${rating} path=${path}`);
  } catch {
    // silent drop — vitals best-effort
  }
  return new NextResponse(null, { status: 204 });
}
