import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (_err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Use admin client (bypasses RLS) - cast to any for insert/update operations
  // since our Database type system resolves to 'never' for mutations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const profileId = session.metadata?.profile_id;
      const plan = session.metadata?.plan;

      if (profileId && plan) {
        await supabase.from("subscriptions").upsert({
          profile_id: profileId,
          plan: plan as string,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: "active",
        }, { onConflict: "profile_id" });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as {
        id: string; status: string;
        current_period_start: number; current_period_end: number;
      };
      await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", plan: "free" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
