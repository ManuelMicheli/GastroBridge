import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://gastro-bridge.vercel.app";

function appOrigin(): string {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return "";
  }
}

function sameOrigin(request: Request): boolean {
  // Accept either a same-origin Origin header (browsers always send it for
  // cross-site POSTs) or, when Origin is absent (some server-to-server
  // tooling), require Referer to start with the app origin.
  const expected = appOrigin();
  if (!expected) return false;
  const origin = request.headers.get("origin");
  if (origin) return origin === expected;
  const referer = request.headers.get("referer");
  return !!referer && referer.startsWith(expected + "/");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const response = NextResponse.redirect(new URL("/login", APP_URL));
  for (const cookie of allCookies) {
    response.cookies.set(cookie.name, "", {
      expires: new Date(0),
      path: "/",
    });
  }
  return response;
}
