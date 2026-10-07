import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { buildOrderGuide } from "@/lib/restaurants/ordering/guide";
import { ReorderClient } from "./reorder-client";

export const metadata: Metadata = { title: "Riordino rapido" };

export default async function ReorderPage() {
  const ctx = await getRestaurantContext();
  if (!ctx) redirect("/dashboard");
  const guide = await buildOrderGuide(ctx);
  return (
    <ReorderClient
      suppliers={guide.suppliers}
      canOrder={contextCan(ctx, "order.submit")}
      canEditPar={contextCan(ctx, "par_levels.manage")}
    />
  );
}
