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

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    if (!isValidPayload(raw)) {
      return new NextResponse(null, { status: 204 });
    }
    console.log(
      `[web-vitals] ${raw.name}=${raw.value.toFixed(1)} rating=${raw.rating ?? "-"} path=${raw.path ?? "-"}`,
    );
  } catch {
    // silent drop — vitals best-effort
  }
  return new NextResponse(null, { status: 204 });
}
