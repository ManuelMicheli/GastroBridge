import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import Link from "next/link";

export const metadata: Metadata = { title: "Ordini Fornitore" };

export default async function SupplierOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers").select("id").eq("profile_id", user?.id ?? "").single<{ id: string }>();

  const { data: splits } = await supabase
    .from("order_splits")
    .select("id, order_id, subtotal, status, confirmed_at, orders(created_at, restaurants(name))")
    .eq("supplier_id", supplier?.id ?? "none")
    .order("order_id", { ascending: false })
    .returns<Array<{ id: string; order_id: string; subtotal: number; status: string; confirmed_at: string | null; orders: { created_at: string; restaurants: { name: string } } | null }>>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Ordini Ricevuti</h1>
      {(splits ?? []).length > 0 ? (
        <div className="space-y-3">
          {(splits ?? []).map((split) => {
            const order = split.orders as unknown as { created_at: string; restaurants: { name: string } } | null;
            return (
              <Link key={split.id} href={`/supplier/ordini/${split.id}`}>
                <Card className="hover:shadow-elevated transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-charcoal">{order?.restaurants?.name ?? "Ristorante"}</p>
                      <p className="text-sm text-sage">{order ? formatDate(order.created_at) : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-lg">{formatCurrency(split.subtotal)}</p>
                      <Badge variant={split.status === "delivered" ? "success" : "info"}>
                        {ORDER_STATUS_LABELS[split.status] ?? split.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-16">
          <p className="text-sage">Nessun ordine ricevuto ancora.</p>
        </Card>
      )}
    </div>
  );
}
