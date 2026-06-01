import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";
import { SecurityClient } from "./security-client";

export const metadata: Metadata = { title: "Sicurezza" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await getRequestUser();
  if (!user) redirect("/login");

  // listFactors + getAAL are independent — run them together instead of serially.
  const supabase = await createClient();
  const [{ data: factorsData }, { data: aalData }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const verifiedTotp = (factorsData?.totp ?? []).filter((f) => f.status === "verified");

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
