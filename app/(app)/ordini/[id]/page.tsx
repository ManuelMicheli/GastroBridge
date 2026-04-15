import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";

type SupplierBlock = {
  supplierName: string;
  subtotalLabel: string;
  items: { qty: string; name: string; price: string }[];
};

/**
 * Parse the `notes` field of a catalog-based order produced by
 * createCatalogOrder. Expected shape:
 *
 *   Ordine da N fornitori, M articoli
 *
 *   --- Fornitore A (€ XX.XX) ---
 *     2× Farina 00 (sacco 25kg) @ € 13.90
 *     ...
 *   --- Fornitore B (€ YY.YY) ---
 *     ...
 *
 * Unknown formats return an empty array so the fallback renders raw text.
 */
function parseCatalogOrderNotes(notes: string): { header: string; suppliers: SupplierBlock[] } {
  const lines = notes.split(/\r?\n/);
  const suppliers: SupplierBlock[] = [];
  let header = "";
  let current: SupplierBlock | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^---\s*(.+?)\s*\((.+?)\)\s*---$/);
    if (headerMatch) {
      current = { supplierName: headerMatch[1]!, subtotalLabel: headerMatch[2]!, items: [] };
      suppliers.push(current);
      continue;
    }
    const itemMatch = line.match(/^\s{2,}(\S+?)×\s*(.+?)\s*@\s*(.+)$/);
    if (itemMatch && current) {
      current.items.push({ qty: itemMatch[1]!, name: itemMatch[2]!, price: itemMatch[3]! });
      continue;
    }
    if (!current && line.trim().length > 0 && !header) {
      header = line.trim();
    }
  }

  return { header, suppliers };
}

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

  const hasMarketplaceSplits = (splits ?? []).length > 0;
  const catalogDetail = !hasMarketplaceSplits && order.notes
    ? parseCatalogOrderNotes(order.notes)
    : null;

  return (
    <div>
      <div className="mb-4">
        <Link href="/ordini" className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal">
          <ArrowLeft className="h-4 w-4" /> Torna agli ordini
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Ordine #{id.slice(0, 8)}</h1>
          <p className="text-sm text-sage">{formatDate(order.created_at)}</p>
        </div>
        <Badge variant={order.status === "delivered" ? "success" : "info"} className="text-sm px-3 py-1">
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      {catalogDetail?.header && (
        <p className="text-sm text-sage mb-4">{catalogDetail.header}</p>
      )}

      {/* Marketplace splits (existing flow) */}
      {hasMarketplaceSplits && (splits ?? []).map((split) => {
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

      {/* Catalog-based detail parsed from notes */}
      {!hasMarketplaceSplits && catalogDetail && catalogDetail.suppliers.length > 0 && (
        catalogDetail.suppliers.map((s, idx) => (
          <Card key={idx} className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-charcoal">{s.supplierName}</h3>
              <span className="font-mono font-bold text-forest">{s.subtotalLabel}</span>
            </div>
            <div className="space-y-2">
              {s.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-t border-sage-muted/20 first:border-0">
                  <span className="text-charcoal">
                    <span className="font-mono text-sage mr-2">{item.qty}×</span>
                    {item.name}
                  </span>
                  <span className="font-mono text-sage">{item.price}</span>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {/* Raw notes fallback when nothing parsed */}
      {!hasMarketplaceSplits && (!catalogDetail || catalogDetail.suppliers.length === 0) && order.notes && (
        <Card className="mb-4">
          <h3 className="font-bold text-charcoal mb-2">Dettagli</h3>
          <pre className="text-xs text-sage whitespace-pre-wrap font-mono">{order.notes}</pre>
        </Card>
      )}

      <Card>
        <div className="flex justify-between text-lg font-bold">
          <span>Totale Ordine</span>
          <span className="font-mono text-forest">{formatCurrency(order.total)}</span>
        </div>
      </Card>
    </div>
  );
}
