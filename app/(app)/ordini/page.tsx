import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import Link from "next/link";

export const metadata: Metadata = { title: "Ordini" };

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .returns<Array<{ id: string }>>();

  const restaurantIds = (restaurants ?? []).map((r) => r.id);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, status, notes, created_at")
    .in("restaurant_id", restaurantIds.length > 0 ? restaurantIds : ["none"])
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string; total: number; status: string; notes: string | null; created_at: string }>>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">I tuoi Ordini</h1>
      {(orders ?? []).length > 0 ? (
        <div className="space-y-3">
          {(orders ?? []).map((order) => (
            <Link key={order.id} href={`/ordini/${order.id}`}>
              <Card className="hover:shadow-elevated transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-sage">#{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-sage">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg text-charcoal">
                      {formatCurrency(order.total)}
                    </p>
                    <Badge variant={order.status === "delivered" ? "success" : "info"}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-sage">Nessun ordine ancora.</p>
        </div>
      )}
    </div>
  );
}
