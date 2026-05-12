"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

// Generic error to avoid disclosing whether an account exists or whether the
// failure is due to wrong password vs missing user vs unconfirmed email.
const GENERIC_AUTH_ERROR = "Credenziali non valide o email non confermata.";

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

  let redirectTo = "/dashboard";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();

    if (profile?.role === "supplier") {
      redirectTo = "/supplier/dashboard";
    }
  }

  return { success: true, redirectTo };
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const companyName = formData.get("companyName") as string;
  const role = formData.get("role") as UserRole;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        company_name: companyName,
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
  return { success: true, redirectTo };
}

export async function signInWithGoogle() {
  const supabase = await createClient();

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
