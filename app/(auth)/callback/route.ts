import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NEXT_PATH_COOKIE, postLoginPath } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // `next` from the query, else the cookie set before magic link / OAuth.
  const cookieStoreForNext = await cookies();
  const rawNext =
    requestUrl.searchParams.get("next") ??
    cookieStoreForNext.get(NEXT_PATH_COOKIE)?.value ??
    null;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check user role for proper redirect
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const redirectTo = postLoginPath(profile?.role, rawNext);
        const res = NextResponse.redirect(new URL(redirectTo, request.url));
        res.cookies.delete(NEXT_PATH_COOKIE);
        return res;
      }
    }
  }

  // Auth error — redirect to login
  return NextResponse.redirect(new URL("/login", request.url));
}
