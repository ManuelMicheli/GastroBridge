import type { Metadata } from "next";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { SUPPLIER_PLANS } from "@/lib/utils/constants";
import { SubscriptionOverview } from "@/components/settings/subscription-overview";

export const metadata: Metadata = { title: "Abbonamento" };

export default async function SupplierSubscriptionPage() {
  const user = await getCachedUser();
  const plan: unknown = user?.user_metadata?.plan;
  return (
    <SubscriptionOverview
      plans={SUPPLIER_PLANS}
      chosenPlanId={typeof plan === "string" ? plan : null}
      eyebrow="Account fornitore"
    />
  );
}
