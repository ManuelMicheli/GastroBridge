"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
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
    return { error: error.message };
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

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Controlla la tua email per il link di accesso." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
