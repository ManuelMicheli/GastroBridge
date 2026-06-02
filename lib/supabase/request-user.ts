import { headers } from "next/headers";
import { getCachedUser } from "./cached-user";

export type RequestUser = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
};

/**
 * Identity of the current request, read from the headers middleware sets after
 * it has already validated the session via getUser(). This avoids a second
 * getUser() network round-trip (1–3s under auth load) on every page render.
 *
 * Falls back to a real getUser() call when the headers are absent (e.g. a route
 * not covered by middleware) so callers never silently lose the user.
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  const h = await headers();
  const id = h.get("x-gb-user-id");

  if (id) {
    return {
      id,
      email: h.get("x-gb-user-email"),
      email_confirmed_at: h.get("x-gb-email-confirmed-at"),
      last_sign_in_at: h.get("x-gb-last-sign-in-at"),
    };
  }

  const user = await getCachedUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
  };
}
