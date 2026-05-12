import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
