// app/(app)/cataloghi/_components/supplier-drawer.tsx
"use client";

import Link from "next/link";
import { Clock, GitCompareArrows, ShoppingCart, Truck, Wallet } from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/formatters";
import { Drawer, DrawerItem } from "@/components/fernly/drawer";
import { Avatar } from "@/components/fernly/primitives";
import { PriceRangeBar } from "./price-range-bar";
import { catalogHref, dominantCategory, isRecentlyUpdated } from "./supplier-card";
import type { EnrichedCatalog } from "../catalogs-client";

/**
 * Supplier "profile" side drawer (Fernly team drawer): avatar, meta row,
 * three stat tiles, price range, category breakdown, notes and actions.
 */
export function SupplierDrawer({
  catalog,
  onClose,
  canCompare,
}: {
  catalog: EnrichedCatalog | null;
  onClose: () => void;
  canCompare: boolean;
}) {
  const c = catalog;
  return (
    <Drawer open={c !== null} onClose={onClose} label={c ? `Profilo ${c.supplier_name}` : "Profilo fornitore"}>
      {c ? <DrawerBody c={c} canCompare={canCompare} /> : null}
    </Drawer>
  );
}

function DrawerBody({ c, canCompare }: { c: EnrichedCatalog; canCompare: boolean }) {
  const a = c.aggregates;
  const cat = dominantCategory(c);
  const recent = isRecentlyUpdated(c.updated_at);
  const hasPrices = a.priceMin !== null && a.priceMax !== null;
  const orderHref =
    c.source === "connected" ? `/fornitori/${c.id}` : `/cerca?suppliers=${encodeURIComponent(c.id)}`;

  return (
    <>
      <DrawerItem className="flex flex-col items-center text-center">
        <Avatar name={c.supplier_name} size={84} presence={recent ? "online" : null} />
        <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-[var(--f-ink)]">{c.supplier_name}</h2>
        <p className="mt-0.5 text-[13px] text-[var(--f-muted)]">
          {c.source === "connected" ? "Fornitore collegato" : "Listino manuale"}
          {cat ? ` · ${cat.label}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--f-muted)]">
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" />
            {c.delivery_days !== null ? `${c.delivery_days}g` : "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5" />
            {c.min_order_amount !== null ? `Min ${formatCurrency(c.min_order_amount)}` : "Nessun minimo"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatRelativeTime(c.updated_at)}
          </span>
        </div>
      </DrawerItem>

      <DrawerItem className="mt-6 grid grid-cols-3 gap-2">
        {[
          { v: String(a.itemCount), l: "Prodotti" },
          { v: a.priceAvg !== null ? formatCurrency(a.priceAvg) : "—", l: "Prezzo medio" },
          { v: a.priceMedian !== null ? formatCurrency(a.priceMedian) : "—", l: "Mediana" },
        ].map((s) => (
          <div key={s.l} className="rounded-[14px] bg-[var(--f-fill)] px-2 py-3 text-center">
            <div className="truncate text-[17px] font-semibold text-[var(--f-ink)] tabular-nums">{s.v}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--f-muted)]">{s.l}</div>
          </div>
        ))}
      </DrawerItem>

      {hasPrices ? (
        <DrawerItem className="mt-6">
          <h3 className="mb-2.5 text-[14px] font-semibold text-[var(--f-ink)]">Fascia di prezzo</h3>
          <PriceRangeBar min={a.priceMin!} max={a.priceMax!} marker={a.priceMedian} />
        </DrawerItem>
      ) : null}

      <DrawerItem className="mt-6">
        <h3 className="mb-2.5 text-[14px] font-semibold text-[var(--f-ink)]">Categorie del listino</h3>
        {a.macroCategories.length === 0 ? (
          <p className="text-[13px] text-[var(--f-muted)]">Nessun prodotto ancora importato.</p>
        ) : (
          <ul className="space-y-1.5">
            {a.macroCategories.slice(0, 5).map((m, i) => (
              <li key={m.category} className="flex items-center gap-2.5 rounded-[12px] bg-[var(--f-fill)] px-3 py-2.5 text-[13.5px]">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: i === 0 ? "var(--acc-600)" : i === 1 ? "var(--acc-900)" : "var(--acc-400)" }}
                />
                <span className="flex-1 truncate text-[var(--f-ink)]">{m.label}</span>
                <span className="text-[12px] text-[var(--f-muted)] tabular-nums">
                  {m.count} prodott{m.count === 1 ? "o" : "i"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DrawerItem>

      {c.notes ? (
        <DrawerItem className="mt-6">
          <h3 className="mb-1.5 text-[14px] font-semibold text-[var(--f-ink)]">Note</h3>
          <p className="whitespace-pre-line text-[13px] text-[var(--f-ink-2)]">{c.notes}</p>
        </DrawerItem>
      ) : null}

      <DrawerItem className="mt-7 grid grid-cols-2 gap-2">
        {canCompare ? (
          <Link href="/cataloghi/confronta" className="f-btn f-btn-outline">
            <GitCompareArrows className="h-4 w-4" /> Confronta
          </Link>
        ) : (
          <Link href={catalogHref(c)} className="f-btn f-btn-outline">
            Apri listino
          </Link>
        )}
        <Link href={orderHref} className="f-btn f-btn-primary">
          <ShoppingCart className="h-4 w-4" /> Nuovo ordine
        </Link>
      </DrawerItem>
      {canCompare ? (
        <DrawerItem className="mt-2">
          <Link href={catalogHref(c)} className="f-btn f-btn-sm f-btn-ghost w-full">
            Apri listino completo
          </Link>
        </DrawerItem>
      ) : null}
    </>
  );
}
