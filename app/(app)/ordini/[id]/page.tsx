import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single<{ id: string; total: number; status: string; notes: string | null; created_at: string }>();

  if (!order) notFound();

  type SplitRow = { id: string; order_id: string; supplier_id: string; subtotal: number; status: string; suppliers: { company_name: string } | null };
  const { data: splits } = await supabase
    .from("order_splits")
    .select("*, suppliers(company_name)")
    .eq("order_id", id)
    .returns<SplitRow[]>();

  type ItemRow = { id: string; supplier_id: string; quantity: number; subtotal: number; products: { name: string; unit: string } | null; suppliers: { company_name: string } | null };
  const { data: items } = await supabase
    .from("order_items")
    .select("*, products(name, unit), suppliers(company_name)")
    .eq("order_id", id)
    .returns<ItemRow[]>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Ordine #{id.slice(0, 8)}</h1>
          <p className="text-sm text-sage">{formatDate(order.created_at)}</p>
        </div>
        <Badge variant={order.status === "delivered" ? "success" : "info"} className="text-sm px-3 py-1">
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      {/* Splits by supplier */}
      {(splits ?? []).map((split) => {
        const supplier = split.suppliers as unknown as { company_name: string } | null;
        const splitItems = (items ?? []).filter((i) => i.supplier_id === split.supplier_id);
        return (
          <Card key={split.id} className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-charcoal">{supplier?.company_name ?? "Fornitore"}</h3>
              <Badge variant="info">{ORDER_STATUS_LABELS[split.status] ?? split.status}</Badge>
            </div>
            <div className="space-y-2">
              {splitItems.map((item) => {
                const product = item.products as unknown as { name: string; unit: string } | null;
                return (
                  <div key={item.id} className="flex justify-between text-sm py-1 border-t border-sage-muted/20 first:border-0">
                    <span className="text-charcoal">{product?.name} x{item.quantity}</span>
                    <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-sage-muted/30 mt-3 pt-3 flex justify-between font-bold">
              <span>Subtotale</span>
              <span className="font-mono">{formatCurrency(split.subtotal)}</span>
            </div>
          </Card>
        );
      })}

      <Card>
        <div className="flex justify-between text-lg font-bold">
          <span>Totale Ordine</span>
          <span className="font-mono text-forest">{formatCurrency(order.total)}</span>
        </div>
      </Card>
    </div>
  );
}
