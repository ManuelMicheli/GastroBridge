// app/(app)/cataloghi/_components/supplier-card.tsx
"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { motion } from "motion/react";
import { formatCurrency } from "@/lib/utils/formatters";
import { Avatar } from "@/components/fernly/primitives";
import type { EnrichedCatalog } from "../catalogs-client";

export function isRecentlyUpdated(iso: string, days = 7): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t < days * 86_400_000;
}

export function dominantCategory(c: EnrichedCatalog): { key: string; label: string } | null {
  const first = c.aggregates.macroCategories?.[0];
  return first ? { key: first.category, label: first.label } : null;
}

export function catalogHref(c: EnrichedCatalog): string {
  return c.source === "connected" ? `/fornitori/${c.id}` : `/cataloghi/${c.id}`;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Fernly "team member" card mapped to a supplier catalog: pastel initials
 * avatar (green dot = listino aggiornato negli ultimi 7 giorni), name, role
 * line, dominant category chip, two stats, list-size bar and two pills.
 * Participates in the FLIP reflow of the grid via motion `layout`.
 */
export const SupplierCard = forwardRef<
  HTMLElement,
  { catalog: EnrichedCatalog; maxItems: number; onProfile: () => void }
>(function SupplierCard({ catalog, maxItems, onProfile }, ref) {
  const { aggregates: a } = catalog;
  const cat = dominantCategory(catalog);
  const share = maxItems > 0 ? Math.round((a.itemCount / maxItems) * 100) : 0;
  const recent = isRecentlyUpdated(catalog.updated_at);
  const role =
    catalog.delivery_days !== null
      ? `Consegna in ${catalog.delivery_days} ${catalog.delivery_days === 1 ? "giorno" : "giorni"}`
      : catalog.source === "connected"
        ? "Fornitore collegato"
        : "Listino manuale";

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: EASE } }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ layout: { duration: 0.5, ease: EASE } }}
      className="f-card flex flex-col items-center px-5 pb-5 pt-6 text-center"
      aria-labelledby={`sup-${catalog.id}`}
    >
      <Avatar name={catalog.supplier_name} size={64} presence={recent ? "online" : null} />
      <h3 id={`sup-${catalog.id}`} className="mt-3 w-full truncate text-[15px] font-semibold text-[var(--f-ink)]" title={catalog.supplier_name}>
        {catalog.supplier_name}
      </h3>
      <p className="mt-0.5 text-[12.5px] text-[var(--f-muted)]">{role}</p>
      <span className="f-tag mt-2 bg-[var(--acc-50)] text-[var(--acc-700)]">
        {cat ? cat.label : catalog.source === "connected" ? "Piattaforma" : "Manuale"}
      </span>

      <div className="mt-4 grid w-full grid-cols-2 gap-2">
        <div>
          <div className="text-[18px] font-semibold text-[var(--f-ink)] tabular-nums">{a.itemCount}</div>
          <div className="text-[11.5px] text-[var(--f-muted)]">Prodotti</div>
        </div>
        <div>
          <div className="text-[18px] font-semibold text-[var(--f-ink)] tabular-nums">
            {a.priceAvg !== null ? formatCurrency(a.priceAvg) : "—"}
          </div>
          <div className="text-[11.5px] text-[var(--f-muted)]">Prezzo medio</div>
        </div>
      </div>

      <div className="mt-4 w-full">
        <div className="flex items-center justify-between text-[11.5px] text-[var(--f-muted)]">
          <span>Ampiezza listino</span>
          <span className="tabular-nums">{share}%</span>
        </div>
        <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-[var(--f-fill-2)]">
          <div
            className="f-grow-x h-full rounded-full bg-[var(--acc-600)]"
            style={{ width: `${share}%`, ["--d" as string]: "200ms" }}
          />
        </div>
      </div>

      <div className="mt-5 grid w-full grid-cols-2 gap-2">
        <Link href={catalogHref(catalog)} className="f-btn f-btn-sm f-btn-outline">
          Apri listino
        </Link>
        <button type="button" onClick={onProfile} className="f-btn f-btn-sm f-btn-primary">
          Profilo
        </button>
      </div>
    </motion.article>
  );
});
