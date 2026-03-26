"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanType } from "@/types/database";
import { hasFeature } from "@/lib/stripe/plans";

export function useSubscription() {
  const [plan, setPlan] = useState<PlanType>("free");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSubscription() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("subscriptions")
          .select("plan")
          .eq("profile_id", user.id)
          .eq("status", "active")
          .single<{ plan: string }>();
        if (data) setPlan(data.plan as PlanType);
      }
      setIsLoading(false);
    }
    loadSubscription();
  }, []);

  return {
    plan,
    isLoading,
    isPro: plan === "pro" || plan === "business",
    isBusiness: plan === "business",
    isGrowth: plan === "growth" || plan === "enterprise",
    isEnterprise: plan === "enterprise",
    hasFeature: (feature: string) => hasFeature(plan, feature),
  };
}
