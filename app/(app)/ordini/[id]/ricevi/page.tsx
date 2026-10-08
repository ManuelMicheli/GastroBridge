import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accessCan, getRestaurantAccess } from "@/lib/restaurants/context";
import { loadHaccpSettings, loadOrderChecks, loadReceivingBlocks } from "@/lib/restaurants/receiving/server";
import { ReceiveClient } from "./receive-client";

export const metadata: Metadata = { title: "Ricevi merce" };

export default async function ReceivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, restaurant_id, status, notes, created_at")
    .eq("id", id)
    .maybeSingle<{ id: string; restaurant_id: string; status: string; notes: string | null; created_at: string }>();
  if (!order) notFound();
  const access = await getRestaurantAccess(order.restaurant_id);
  if (!access) notFound();

  const [blocks, settings, previous] = await Promise.all([
    loadReceivingBlocks(order),
    loadHaccpSettings(order.restaurant_id),
    loadOrderChecks(order.id),
  ]);

  return (
    <ReceiveClient
      orderId={order.id}
      orderDate={order.created_at}
      cancelled={order.status === "cancelled"}
      canReceive={accessCan(access, "order.receive")}
      blocks={blocks}
      settings={settings}
      alreadyChecked={previous.checks.length > 0}
    />
  );
}
