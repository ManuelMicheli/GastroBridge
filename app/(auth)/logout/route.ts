import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// `/logout` is linked from the settings pages (restaurant + supplier) with
// plain links, so GET must work. POST is supported for form-based sign-out.
async function handleSignOut(request: NextRequest) {
  // A <Link href="/logout"> makes the client router prefetch / RSC-fetch this
  // URL. Those background requests must NOT end the session: answer with a
  // non-RSC response so the router falls back to a full-page navigation,
  // which then hits this handler without the RSC headers.
  if (request.headers.get("rsc") || request.headers.get("next-router-prefetch")) {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  // 303 so a POST is followed by a GET to /login.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}
