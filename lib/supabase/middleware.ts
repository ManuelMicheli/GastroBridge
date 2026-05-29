import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/cerca",
  "/cataloghi",
  "/ordini",
  "/carrello",
  "/analytics",
  "/impostazioni",
  "/supplier",
];

const AUTH_ROUTES = new Set(["/login", "/signup"]);

// Sections that step up to an elevated session (aal2 = TOTP verified) when —
// and only when — the user already has MFA enrolled. MFA is optional: users
// without any verified factor keep full access. Users who DID enrol MFA must
// step up (otherwise an aal1 session would weaken their own 2FA).
const MFA_REQUIRED_PREFIXES = ["/finanze", "/supplier/finanze"];

function isMfaRequired(pathname: string): boolean {
  return MFA_REQUIRED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function hasAuthCookie(request: NextRequest): boolean {
  // Supabase SSR stores tokens in `sb-<projectRef>-auth-token` (and `.0`/`.1`
  // chunked variants). Probing all cookies is cheap and avoids paying for a
  // Supabase client + getUser() round-trip on every anonymous prefetch.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      return true;
    }
  }
  return false;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

function isPublicTokenRoute(pathname: string): boolean {
  // Plan 1C Task 11: ordini/[id]/conferma uses HMAC in querystring as
  // credential — must be reachable without session.
  return /^\/ordini\/[^/]+\/conferma\/?$/.test(pathname);
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedRoute = isProtectedPath(pathname);
  const authRoute = AUTH_ROUTES.has(pathname);
  const cookiePresent = hasAuthCookie(request);

  // Fast path: anonymous request to a non-auth page → no Supabase client at all.
  // The vast majority of asset requests in a session land here.
  if (!cookiePresent && !authRoute) {
    if (protectedRoute && !isPublicTokenRoute(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && protectedRoute && !isPublicTokenRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isMfaRequired(pathname)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // currentLevel = aal1/aal2 of the active session; nextLevel = the level the
    // user's enrolled factors allow. nextLevel === "aal2" means a verified MFA
    // factor exists. MFA is optional: only step up when the user enrolled MFA
    // (next aal2) but the current session is still aal1. No factor → allow.
    const current = aal?.currentLevel ?? "aal1";
    const next = aal?.nextLevel ?? "aal1";
    if (next === "aal2" && current !== "aal2") {
      const url = new URL("/impostazioni/sicurezza", request.url);
      url.searchParams.set("mfa", "required");
      return NextResponse.redirect(url);
    }
  }

  if (user && authRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile as { role: string } | null)?.role;
    const dest = role === "supplier" ? "/supplier/dashboard" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return supabaseResponse;
}
