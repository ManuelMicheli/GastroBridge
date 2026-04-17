import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Clock, Package, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";

const TIMELINE_STEPS = [
  { key: "submitted", label: "Inviato", icon: Check },
  { key: "confirmed", label: "Confermato", icon: Check },
  { key: "preparing", label: "In preparazione", icon: Package },
  { key: "shipping", label: "In consegna", icon: Truck },
  { key: "delivered", label: "Consegnato", icon: Check },
] as const;

function getTimelinePosition(status: string): number {
  const idx = TIMELINE_STEPS.findIndex((s) => s.key === status);
  if (idx >= 0) return idx;
  if (status === "draft") return -1;
  if (status === "cancelled") return -2;
  return 0;
}

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

  const currentStep = getTimelinePosition(order.status);
  const isCancelled = order.status === "cancelled";
  const isDraft = order.status === "draft";

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/ordini"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors min-h-[44px] -my-2 py-2"
        >
          <ArrowLeft className="h-4 w-4" /> Torna agli ordini
        </Link>
      </div>

      <PageHeader
        title={`Ordine #${id.slice(0, 8)}`}
        subtitle={formatDate(order.created_at)}
        meta={
          <Badge variant={order.status === "delivered" ? "success" : "info"}>
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </Badge>
        }
      />

      {/* Timeline scrubber — only for non-draft, non-cancelled */}
      {!isDraft && !isCancelled && (
        <Card className="mb-6 cq-card">
          <ol className="flex items-center justify-between gap-1 @[420px]:gap-2 relative">
            {TIMELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isDone = i <= currentStep;
              const isActive = i === currentStep;
              const isFinal = i === TIMELINE_STEPS.length - 1;
              return (
                <li key={step.key} className="flex-1 flex flex-col items-center relative">
                  {!isFinal && (
                    <div
                      className="absolute top-4 left-1/2 right-0 h-px"
                      style={{
                        background:
                          i < currentStep
                            ? "var(--color-brand-primary)"
                            : "var(--color-border-subtle)",
                        zIndex: 0,
                      }}
                      aria-hidden
                    />
                  )}
                  <div
                    className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                    style={{
                      background: isDone
                        ? "var(--color-brand-primary)"
                        : "var(--color-surface-card)",
                      border: `1px solid ${
                        isDone
                          ? "var(--color-brand-primary)"
                          : "var(--color-border-subtle)"
                      }`,
                      color: isDone
                        ? "var(--color-brand-on-primary)"
                        : "var(--color-text-tertiary)",
                      boxShadow: isActive ? "var(--glow-brand)" : undefined,
                    }}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </div>
                  <p
                    className="mt-2 text-center truncate w-full"
                    style={{
                      fontSize: "clamp(9px, 2.4vw, 11px)",
                      letterSpacing: "+0.04em",
                      fontWeight: isActive ? 600 : 500,
                      textTransform: "uppercase",
                      color: isActive
                        ? "var(--color-text-primary)"
                        : "var(--color-text-tertiary)",
                    }}
                  >
                    {step.label}
                  </p>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {(isDraft || isCancelled) && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              {isDraft
                ? "Ordine in bozza — non ancora inviato ai fornitori."
                : "Ordine annullato."}
            </p>
          </div>
        </Card>
      )}

      {catalogDetail?.header && (
        <SectionHeader title={catalogDetail.header} />
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
