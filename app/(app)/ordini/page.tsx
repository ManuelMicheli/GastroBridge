import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyOrdersIllustration } from "@/components/illustrations";
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

  const orderList = orders ?? [];

  return (
    <div>
      <PageHeader
        title="Ordini"
        subtitle="Gestione ordini e ricezione merce dai tuoi fornitori."
        meta={
          orderList.length > 0 ? (
            <Badge variant="default">{orderList.length} totali</Badge>
          ) : undefined
        }
      />
      {orderList.length > 0 ? (
        <div className="space-y-2">
          {orderList.map((order) => (
            <Link
              key={order.id}
              href={`/ordini/${order.id}`}
              className="block focus-ring rounded-2xl"
            >
              <Card className="motion-lift hover:shadow-elevated transition-shadow min-h-[72px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-sage">#{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-sage">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
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
        <EmptyState
          title="Nessun ordine ancora"
          description="Quando crei il primo ordine, comparirà qui con stato e timeline."
          illustration={<EmptyOrdersIllustration />}
          context="page"
        />
      )}
    </div>
  );
}
