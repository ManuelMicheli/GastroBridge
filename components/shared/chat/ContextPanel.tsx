import Link from "next/link";
import { Package, ShoppingBag, Clock, TrendingUp, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { PairContext } from "@/lib/messages/context";

const STATE_LABELS: Record<string, string> = {
  submitted:  "Ricevuto",
  confirmed:  "Confermato",
  preparing:  "In prep.",
  shipping:   "In spedizione",
  delivered:  "Consegnato",
  cancelled:  "Annullato",
};

const STATE_CHIP: Record<string, string> = {
  submitted:  "bg-amber-50 text-amber-700 border-amber-200",
  confirmed:  "bg-forest-light/30 text-forest border-forest/30",
  preparing:  "bg-blue-50 text-blue-700 border-blue-200",
  shipping:   "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:  "bg-rose-50 text-rose-700 border-rose-200",
};

function StateChip({ state }: { state: string }) {
  const cls = STATE_CHIP[state] ?? "bg-sage-muted/30 text-sage border-sage-muted/40";
  const label = STATE_LABELS[state] ?? state;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function ContextPanel({
  context,
  viewpoint,
}: {
  context: PairContext;
  viewpoint: "restaurant" | "supplier";
}) {
  const detailBaseHref = viewpoint === "supplier" ? "/supplier/ordini" : "/ordini";

  return (
    <aside className="w-80 max-w-full shrink-0 border-l border-sage-muted/30 bg-white/50 h-full overflow-y-auto">
      <div className="px-5 py-5 border-b border-sage-muted/30">
        <p className="text-[10px] uppercase tracking-wider text-sage">Contesto</p>
        <h3 className="mt-0.5 font-display text-lg text-charcoal">
          {viewpoint === "restaurant" ? context.supplierName : context.restaurantName}
        </h3>
        <p className="mt-1 text-xs text-sage">
          Partnership {context.relationshipStatus ?? "—"}
        </p>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-2 px-5 py-4">
        <KpiTile
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          label="Ordini aperti"
          value={String(context.totals.openOrdersCount)}
          sub={formatCurrency(context.totals.openOrdersValue)}
        />
        <KpiTile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Ultimi 30 gg"
          value={String(context.totals.last30dOrdersCount)}
          sub={formatCurrency(context.totals.last30dSpend)}
        />
      </section>

      {/* Active orders */}
      <section className="px-5 py-4 border-t border-sage-muted/20">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-sage">Ordini attivi</h4>
          <span className="text-[10px] text-sage">{context.activeOrders.length}</span>
        </div>
        {context.activeOrders.length === 0 ? (
          <p className="mt-2 text-xs text-sage">Nessun ordine aperto in questo momento.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {context.activeOrders.map((o) => (
              <li key={o.splitId}>
                <Link
                  href={`${detailBaseHref}/${viewpoint === "supplier" ? o.splitId : o.orderId}`}
                  className="group flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-sage-muted/20 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-charcoal truncate">#{o.splitId.slice(0, 8).toUpperCase()}</p>
                    <p className="mt-0.5 text-[10px] text-sage">
                      {new Date(o.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      {o.expectedDeliveryDate && (
                        <> · Consegna {new Date(o.expectedDeliveryDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</>
                      )}
                    </p>
                    <div className="mt-1">
                      <StateChip state={o.status} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-charcoal">{formatCurrency(o.subtotal)}</p>
                    <ArrowUpRight className="mt-0.5 ml-auto h-3 w-3 text-sage group-hover:text-charcoal" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent orders */}
      <section className="px-5 py-4 border-t border-sage-muted/20">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-sage">Recenti</h4>
        {context.recentOrders.length === 0 ? (
          <p className="mt-2 text-xs text-sage">Ancora nessun ordine tra voi due.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {context.recentOrders.map((o) => (
              <li
                key={o.splitId}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-sage-muted/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-3 w-3 text-sage shrink-0" />
                  <span className="text-[11px] font-mono text-charcoal truncate">
                    #{o.splitId.slice(0, 8).toUpperCase()}
                  </span>
                  <StateChip state={o.status} />
                </div>
                <span className="text-[11px] font-mono text-sage shrink-0">
                  {formatCurrency(o.subtotal)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Top products */}
      <section className="px-5 py-4 border-t border-sage-muted/20">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-sage">Prodotti più ordinati</h4>
        {context.topProducts.length === 0 ? (
          <p className="mt-2 text-xs text-sage">Ancora nessun dato di acquisto.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {context.topProducts.map((p) => (
              <li key={p.productId} className="flex items-start justify-between gap-2 px-2 py-1.5">
                <div className="flex items-start gap-2 min-w-0">
                  <Package className="h-3.5 w-3.5 text-sage mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-charcoal truncate">{p.name}</p>
                    <p className="text-[10px] text-sage">{p.unitsSold.toFixed(0)} {p.unit}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-forest shrink-0">
                  {formatCurrency(p.price)}/{p.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function KpiTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-sage-muted/30 bg-cream p-3">
      <div className="flex items-center gap-1.5 text-sage">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 font-mono text-base font-semibold text-charcoal">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-sage font-mono">{sub}</p>}
    </div>
  );
}
