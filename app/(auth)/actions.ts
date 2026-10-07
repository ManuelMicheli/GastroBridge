"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NEXT_PATH_COOKIE, postLoginPath, safeNextPath } from "@/lib/auth/redirect";
import {
  RESTAURANT_PLANS,
  SUPPLIER_PLANS,
  SUPPLIER_PLATFORM_ENABLED,
} from "@/lib/utils/constants";
import { validateNewPassword } from "@/lib/auth/pwned-password";
import type { UserRole } from "@/types/database";

// Generic error to avoid disclosing whether an account exists or whether the
// failure is due to wrong password vs missing user vs unconfirmed email.
const GENERIC_AUTH_ERROR = "Credenziali non valide o email non confermata.";

// Magic link / OAuth leave the site: remember the requested page in a
// short-lived cookie that /callback consumes (keeps the Supabase redirect URL
// allow-list unchanged).
async function rememberNextPath(raw: string | null | undefined) {
  const next = safeNextPath(raw);
  const store = await cookies();
  if (next) {
    store.set(NEXT_PATH_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 15,
    });
  } else {
    store.delete(NEXT_PATH_COOKIE);
  }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: GENERIC_AUTH_ERROR };
  }

  // Get user role for redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    role = profile?.role ?? null;
  }

  // Honour ?redirect= (passed by the login form), path-only.
  const redirectTo = postLoginPath(role, formData.get("redirect") as string | null);
  return { success: true, redirectTo };
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const companyName = formData.get("companyName") as string;
  const role = formData.get("role") as UserRole;
  // Only known plan ids for the chosen role are stored.
  const rawPlan = formData.get("plan");
  const plan =
    typeof rawPlan === "string" &&
    (role === "supplier" ? SUPPLIER_PLANS : RESTAURANT_PLANS).some((p) => p.id === rawPlan)
      ? rawPlan
      : null;

  // v1 is restaurant-only. Reject supplier signups server-side even if the
  // disabled client control is bypassed. Supplier onboarding returns in v2.
  if (role === "supplier" && !SUPPLIER_PLATFORM_ENABLED) {
    return {
      error:
        "La registrazione come fornitore non è ancora disponibile. Arriverà nella versione 2.",
    };
  }

  // Reject weak / breached passwords (free equivalent of Supabase Pro's leaked
  // password protection). Runs before signUp so a pwned password never creates
  // an account.
  const pwCheck = await validateNewPassword(password);
  if (!pwCheck.ok) return { error: pwCheck.error };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        company_name: companyName,
        // Plan picked on /pricing (?plan=), kept so it is not lost at signup.
        ...(plan ? { plan } : {}),
      },
    },
  });

  if (error) {
    // Distinguish only password-policy errors (helpful for the user); any
    // other failure returns a generic message to avoid email enumeration.
    const msg = error.message.toLowerCase();
    if (msg.includes("password")) {
      return { error: error.message };
    }
    return { error: "Registrazione non riuscita. Verifica i dati e riprova." };
  }

  const redirectTo = role === "supplier" ? "/supplier/dashboard" : "/dashboard";
  // No session means email confirmation is required: the client must not
  // navigate to the (protected) dashboard, middleware would bounce to /login.
  return { success: true, redirectTo, hasSession: Boolean(data.session) };
}

export async function signInWithGoogle(next?: string | null) {
  const supabase = await createClient();
  await rememberNextPath(next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  await rememberNextPath(formData.get("redirect") as string | null);

  // Always return the same success message — never reveal whether the email
  // is registered (enumeration vector). Real errors are swallowed.
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
    },
  });

  return { success: true, message: "Se l'indirizzo è registrato, riceverai un'email con il link di accesso." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Server-side password policy check for the password-change flow (client component
// in impostazioni/sicurezza). Keeps the HaveIBeenPwned lookup on the server.
export async function checkPasswordSafe(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return validateNewPassword(password);
}
