import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));

  // Delete every cookie
  for (const cookie of allCookies) {
    response.cookies.set(cookie.name, "", {
      expires: new Date(0),
      path: "/",
    });
  }

  return response;
}
