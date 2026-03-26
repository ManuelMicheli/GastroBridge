import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth routes: redirect authenticated users to their dashboard
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const dashboardUrl =
      profile?.role === "supplier" ? "/supplier/dashboard" : "/dashboard";
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // Protected restaurant routes
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!user && request.nextUrl.pathname.startsWith("/cerca")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!user && request.nextUrl.pathname.startsWith("/fornitori")) {
    // Marketing fornitori page is public, app fornitori is protected
    // Only protect if it looks like an app route (has UUID segments, etc.)
  }
  if (!user && request.nextUrl.pathname.startsWith("/ordini")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!user && request.nextUrl.pathname.startsWith("/carrello")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!user && request.nextUrl.pathname.startsWith("/analytics")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!user && request.nextUrl.pathname.startsWith("/impostazioni")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protected supplier routes
  if (!user && request.nextUrl.pathname.startsWith("/supplier")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Role-based protection
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // Restaurant user trying to access supplier area
    if (
      profile?.role === "restaurant" &&
      request.nextUrl.pathname.startsWith("/supplier")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Supplier user trying to access restaurant area
    const restaurantRoutes = [
      "/dashboard",
      "/cerca",
      "/ordini",
      "/carrello",
      "/analytics",
      "/impostazioni",
    ];
    if (
      profile?.role === "supplier" &&
      restaurantRoutes.some(
        (route) =>
          request.nextUrl.pathname === route ||
          request.nextUrl.pathname.startsWith(route + "/")
      )
    ) {
      return NextResponse.redirect(
        new URL("/supplier/dashboard", request.url)
      );
    }
  }

  return supabaseResponse;
}
