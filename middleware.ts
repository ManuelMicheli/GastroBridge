import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  apiLimiter,
  authLimiter,
  applyLimit,
  clientIp,
} from "@/lib/utils/rate-limit";

function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

function isApiPath(pathname: string): boolean {
  // Skip rate limiting on webhook endpoints (signed by provider) and on the
  // cron-token-guarded endpoints (already protected and may receive bursts).
  if (pathname.startsWith("/api/webhooks/")) return false;
  if (pathname.startsWith("/api/fiscal/webhooks/")) return false;
  if (pathname === "/api/search/sync") return false;
  if (pathname === "/api/search/sync/queue") return false;
  if (pathname === "/api/fiscal/sync") return false;
  if (pathname === "/api/fiscal/health") return false;
  if (pathname === "/api/vitals") return false;
  return pathname.startsWith("/api/");
}

function rateLimitResponse(reset?: number): NextResponse {
  const retryAfter = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 60;
  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfter),
      "Content-Type": "text/plain",
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request.headers);

  if (isAuthPath(pathname)) {
    const r = await applyLimit(authLimiter, `auth:${ip}`);
    if (!r.allowed) return rateLimitResponse(r.resetMs);
  } else if (isApiPath(pathname)) {
    const r = await applyLimit(apiLimiter, `api:${ip}`);
    if (!r.allowed) return rateLimitResponse(r.resetMs);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next internals, fav, hard reset endpoints, AND every static asset
    // extension. Without this, middleware re-verifies auth on every prefetched
    // JS chunk, CSS, font and source map — visible jank on cold routes.
    "/((?!_next/static|_next/image|favicon.ico|api/clear-cookies|clear|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|js|mjs|css|woff|woff2|ttf|otf|map|json|txt|xml)$).*)",
  ],
};
