// Post-login redirect helpers (open-redirect safe).
//
// Only same-origin, path-only targets are honoured: "/x/y?z" yes;
// absolute URLs, protocol-relative ("//host"), backslash variants and
// control characters no. Auth pages are never a destination.

/** Cookie that carries the target across magic-link / OAuth round-trips. */
export const NEXT_PATH_COOKIE = "gb_next";

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return null;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  const path = raw.split(/[?#]/)[0] ?? "";
  if (path === "/login" || path === "/signup" || path === "/logout" || path === "/callback") {
    return null;
  }
  return raw;
}

/** Where to land after authentication: the safe `next` path or the role home. */
export function postLoginPath(
  role: string | null | undefined,
  rawNext: string | null | undefined,
): string {
  return (
    safeNextPath(rawNext) ??
    (role === "supplier" ? "/supplier/dashboard" : "/dashboard")
  );
}
