import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Clock, Download, Package, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { deriveOrderStatus } from "@/lib/orders/derive-order-status";

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

  // PDF export descriptors. `kind=supplier` uses supplier UUID route;
  // `kind=catalog` uses parsed-index route for catalog-only orders.
  type PdfEntry =
    | { kind: "supplier"; key: string; name: string; href: string }
    | { kind: "catalog"; key: string; name: string; href: string };
  const pdfSuppliers: PdfEntry[] = (() => {
    if (hasMarketplaceSplits) {
      return (splits ?? []).map((s): PdfEntry => ({
        kind: "supplier",
        key: s.supplier_id,
        name:
          (s.suppliers as unknown as { company_name: string } | null)
            ?.company_name ?? "Fornitore",
        href: `/api/ordini/${id}/suppliers/${s.supplier_id}/pdf`,
      }));
    }
    if ((items ?? []).length > 0) {
      const seen = new Map<string, string>();
      for (const it of items ?? []) {
        if (!seen.has(it.supplier_id)) {
          const name =
            (it.suppliers as unknown as { company_name: string } | null)
              ?.company_name ?? "Fornitore";
          seen.set(it.supplier_id, name);
        }
      }
      return Array.from(seen, ([sid, name]): PdfEntry => ({
        kind: "supplier",
        key: sid,
        name,
        href: `/api/ordini/${id}/suppliers/${sid}/pdf`,
      }));
    }
    if (catalogDetail && catalogDetail.suppliers.length > 0) {
      return catalogDetail.suppliers.map((s, i): PdfEntry => ({
        kind: "catalog",
        key: `cat-${i}`,
        name: s.supplierName,
        href: `/api/ordini/${id}/catalog/${i}/pdf`,
      }));
    }
    return [];
  })();

  // Restaurant-facing status follows what suppliers have done with their
  // splits, not the stale `orders.status` value (supplier actions only touch
  // `order_splits.status`).
  const effectiveStatus = deriveOrderStatus(
    (splits ?? []).map((s) => s.status),
    order.status,
  );
  const currentStep = getTimelinePosition(effectiveStatus);
  const isCancelled = effectiveStatus === "cancelled";
  const isDraft = effectiveStatus === "draft";

  return (
    <>
      <RealtimeRefresh
        subscriptions={[
          { table: "order_splits", filter: `order_id=eq.${id}` },
          { table: "orders", filter: `id=eq.${id}` },
        ]}
      />
      {/* Mobile Apple-app view */}
      <div className="lg:hidden pb-4">
        <LargeTitle
          eyebrow={formatDate(order.created_at)}
          title={
            <span className="font-mono">
              ORD-{id.slice(-4).toUpperCase()}
            </span>
          }
          subtitle={
            <span className="inline-flex items-center gap-2">
              <OrderStatusBadge
                status={effectiveStatus}
                size="xs"
                celebrate={
                  effectiveStatus === "delivered" ||
                  effectiveStatus === "completed"
                }
              />
              <span className="text-[color:var(--text-muted-light)]">·</span>
              <span
                className="font-serif text-[color:var(--color-brand-primary)]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {formatCurrency(order.total)}
              </span>
            </span>
          }
        />

        {!isDraft && !isCancelled && (
          <GroupedList className="mt-2" label="Stato ordine">
            {TIMELINE_STEPS.map((step, i) => {
              const isDone = i <= currentStep;
              const isActive = i === currentStep;
              return (
                <GroupedListRow
                  key={`m-${step.key}`}
                  compact
                  leading={
                    <div
                      className="relative flex h-[14px] w-[14px] items-center justify-center"
                      aria-hidden
                    >
                      <span
                        className="block h-[14px] w-[14px] rounded-full"
                        style={{
                          background: isDone
                            ? "var(--color-brand-primary)"
                            : "rgba(139,42,48,0.15)",
                          boxShadow: isActive
                            ? "0 0 0 4px rgba(139,42,48,0.22)"
                            : undefined,
                        }}
                      />
                    </div>
                  }
                  title={
                    <span
                      className={
                        isActive
                          ? "font-semibold"
                          : isDone
                            ? ""
                            : "text-[color:var(--text-muted-light)]"
                      }
                    >
                      {step.label}
                    </span>
                  }
                />
              );
            })}
          </GroupedList>
        )}

        {(isDraft || isCancelled) && (
          <div className="mx-[10px] mt-3 rounded-xl bg-[color:var(--ios-surface)] px-4 py-3 text-[13px] text-[color:var(--text-muted-light)]">
            {isDraft
              ? "Ordine in bozza — non ancora inviato ai fornitori."
              : "Ordine annullato."}
          </div>
        )}

        {pdfSuppliers.length > 0 && (
          <GroupedList className="mt-2" label="Esporta PDF">
            {pdfSuppliers.map((s) => (
              <GroupedListRow
                key={`m-pdf-${s.key}`}
                as="a"
                href={s.href}
                leading={
                  <Download
                    className="h-4 w-4 text-[color:var(--color-brand-primary)]"
                    aria-hidden
                  />
                }
                title={
                  <span className="text-[color:var(--color-brand-primary)]">
                    PDF per {s.name}
                  </span>
                }
                subtitle="Scarica ordine per inviarlo al fornitore"
                showChevron
              />
            ))}
          </GroupedList>
        )}

        {hasMarketplaceSplits &&
          (splits ?? []).map((split) => {
            const supplier = split.suppliers as unknown as
              | { company_name: string }
              | null;
            const splitItems = (items ?? []).filter(
              (i) => i.supplier_id === split.supplier_id,
            );
            return (
              <GroupedList
                key={`m-split-${split.id}`}
                className="mt-2"
                label={
                  <span>
                    {supplier?.company_name ?? "Fornitore"} ·{" "}
                    {formatCurrency(split.subtotal)}
                  </span>
                }
                labelAction={<OrderStatusBadge status={split.status} size="xs" />}
              >
                {splitItems.map((item) => {
                  const product = item.products as unknown as
                    | { name: string; unit: string }
                    | null;
                  return (
                    <GroupedListRow
                      key={`m-it-${item.id}`}
                      title={product?.name ?? "—"}
                      subtitle={
                        <span className="font-mono">
                          × {item.quantity}
                        </span>
                      }
                      trailing={
                        <span
                          className="font-serif text-[13px] text-[color:var(--color-brand-primary)]"
                          style={{ fontFamily: "Georgia, serif" }}
                        >
                          {formatCurrency(item.subtotal)}
                        </span>
                      }
                    />
                  );
                })}
                <GroupedListRow
                  as="a"
                  href={`/api/ordini/${id}/suppliers/${split.supplier_id}/pdf`}
                  leading={
                    <Download
                      className="h-4 w-4 text-[color:var(--color-brand-primary)]"
                      aria-hidden
                    />
                  }
                  title={
                    <span className="text-[color:var(--color-brand-primary)]">
                      Scarica PDF
                    </span>
                  }
                  showChevron
                />
              </GroupedList>
            );
          })}

        {!hasMarketplaceSplits &&
          catalogDetail &&
          catalogDetail.suppliers.length > 0 &&
          catalogDetail.suppliers.map((s, idx) => (
            <GroupedList
              key={`m-cat-${idx}`}
              className="mt-2"
              label={
                <span>
                  {s.supplierName} · {s.subtotalLabel}
                </span>
              }
            >
              {s.items.map((it, i) => (
                <GroupedListRow
                  key={`m-ci-${i}`}
                  title={it.name}
                  subtitle={
                    <span className="font-mono">× {it.qty}</span>
                  }
                  trailing={
                    <span className="font-mono text-[13px] text-[color:var(--color-brand-primary)]">
                      {it.price}
                    </span>
                  }
                />
              ))}
              <GroupedListRow
                as="a"
                href={`/api/ordini/${id}/catalog/${idx}/pdf`}
                leading={
                  <Download
                    className="h-4 w-4 text-[color:var(--color-brand-primary)]"
                    aria-hidden
                  />
                }
                title={
                  <span className="text-[color:var(--color-brand-primary)]">
                    Scarica PDF
                  </span>
                }
                showChevron
              />
            </GroupedList>
          ))}

        {/* Total footer */}
        <div className="mx-[10px] mt-3 flex items-baseline justify-between rounded-xl bg-[color:var(--ios-surface)] px-4 py-3 shadow-[0_0.5px_0_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
            Totale ordine
          </span>
          <span
            className="font-serif text-[20px] font-medium text-[color:var(--color-brand-primary)]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {formatCurrency(order.total)}
          </span>
        </div>
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block">
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
          <OrderStatusBadge
            status={effectiveStatus}
            size="md"
            celebrate={effectiveStatus === "delivered" || effectiveStatus === "completed"}
          />
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

      {pdfSuppliers.length > 0 && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-charcoal">Esporta PDF</h3>
            <span className="text-xs text-text-tertiary">
              Un PDF per fornitore
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pdfSuppliers.map((s) => (
              <a
                key={`d-pdf-${s.key}`}
                href={s.href}
                className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-brand-primary)] px-3 py-2 text-sm font-medium text-[color:var(--color-brand-primary)] transition-colors hover:bg-[color:var(--color-brand-primary-subtle)]"
              >
                <Download className="h-4 w-4" aria-hidden />
                PDF per {s.name}
              </a>
            ))}
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
              <OrderStatusBadge status={split.status} size="sm" />
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
            <div className="mt-3 flex justify-end">
              <a
                href={`/api/ordini/${id}/suppliers/${split.supplier_id}/pdf`}
                className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-brand-primary)] px-3 py-2 text-sm font-medium text-[color:var(--color-brand-primary)] transition-colors hover:bg-[color:var(--color-brand-primary-subtle)]"
              >
                <Download className="h-4 w-4" aria-hidden />
                Scarica PDF
              </a>
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
            <div className="mt-3 flex justify-end">
              <a
                href={`/api/ordini/${id}/catalog/${idx}/pdf`}
                className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-brand-primary)] px-3 py-2 text-sm font-medium text-[color:var(--color-brand-primary)] transition-colors hover:bg-[color:var(--color-brand-primary-subtle)]"
              >
                <Download className="h-4 w-4" aria-hidden />
                Scarica PDF
              </a>
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
    </>
  );
}
