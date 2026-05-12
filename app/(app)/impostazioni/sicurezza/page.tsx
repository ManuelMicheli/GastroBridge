import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SecurityClient } from "./security-client";

export const metadata: Metadata = { title: "Sicurezza" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = (factorsData?.totp ?? []).filter((f) => f.status === "verified");
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  return (
    <SecurityClient
      email={user.email ?? ""}
      emailVerified={Boolean(user.email_confirmed_at)}
      lastSignInAt={user.last_sign_in_at ?? null}
      enrolled={verifiedTotp.length > 0}
      currentAal={aalData?.currentLevel ?? "aal1"}
      nextAal={aalData?.nextLevel ?? "aal1"}
      factorIds={verifiedTotp.map((f) => f.id)}
    />
  );
}
