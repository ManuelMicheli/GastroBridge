import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { loadQuickOrderData } from "@/lib/restaurants/ordering/quick-server";
import { QuickOrderClient } from "./quick-order-client";

export const metadata: Metadata = { title: "Ordine veloce" };

export default async function QuickOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getRestaurantContext();
  if (!ctx) redirect("/dashboard");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 2000) ?? "";
  const data = await loadQuickOrderData(ctx);
  return (
    <QuickOrderClient
      offers={data.offers}
      timesOrdered={data.timesOrdered}
      initialText={q}
      canOrder={contextCan(ctx, "order.submit")}
      canDraft={contextCan(ctx, "order.draft")}
    />
  );
}
