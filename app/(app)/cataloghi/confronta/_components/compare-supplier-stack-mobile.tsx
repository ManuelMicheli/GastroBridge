"use client";

import type { SupplierCol, Pivot } from "@/lib/catalogs/compare";
import { formatCurrency } from "@/lib/utils/formatters";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";

type Props = {
  suppliers: SupplierCol[];
  pivot: Pivot;
  saving: number;
  savingPct: number;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * CompareSupplierStackMobile — vertical stack per supplier with ranking.
 * Displays total price, product coverage, delta vs market average; best = ribbon.
 * Renders only on mobile (< md). Complements the existing per-product
 * CompareMobileList shown below it.
 */
export function CompareSupplierStackMobile({
  suppliers,
  pivot,
  saving,
  savingPct,
}: Props) {
  const totalProducts = pivot.rows.length;
  if (suppliers.length === 0 || totalProducts === 0) return null;

  // Build ranked rows by total price ascending
  const ranked = suppliers
    .map((s) => {
      const total = pivot.totals[s.id] ?? 0;
      const covered = pivot.rows.filter(
        (r) => r.prices[s.id] != null,
      ).length;
      return {
        supplier: s,
        total,
        covered,
        missing: totalProducts - covered,
      };
    })
    .filter((r) => r.covered > 0)
    .sort((a, b) => a.total - b.total);

  if (ranked.length === 0) return null;

  const bestTotal = ranked[0]!.total;
  const avgTotal =
    ranked.reduce((acc, r) => acc + r.total, 0) / ranked.length;

  const [best, ...rest] = ranked;

  return (
    <div className="-mx-6 -mt-5 mb-4 md:hidden">
      {saving > 0 && (
        <div className="mx-[10px] mb-2 rounded-xl bg-gradient-to-br from-[color:var(--color-brand-primary-subtle)] to-transparent px-4 py-3 ring-[0.5px] ring-[color:var(--color-brand-primary-border)]">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
            Risparmio potenziale
          </div>
          <div
            className="mt-1 font-serif text-[22px] font-medium text-[color:var(--color-brand-primary)]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {formatCurrency(saving)}{" "}
            <span className="text-[12px] font-normal text-[color:var(--text-muted-light)]">
              ({savingPct.toFixed(0)}%)
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[color:var(--text-muted-light)]">
            Acquistando ogni prodotto dal fornitore più conveniente.
          </p>
        </div>
      )}

      {best && (
        <GroupedList label="Consigliato" tinted>
          <GroupedListRow
            leading={
              <div
                className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] font-serif text-[12px] font-medium text-[color:var(--color-brand-on-primary)]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {initials(best.supplier.supplier_name)}
              </div>
            }
            title={
              <span className="flex items-center gap-1.5">
                {best.supplier.supplier_name}
                <span className="rounded bg-[color:var(--color-brand-primary)] px-1.5 py-[2px] text-[8px] font-bold uppercase tracking-[0.1em] text-[color:var(--color-brand-on-primary)]">
                  Best
                </span>
              </span>
            }
            subtitle={
              <span>
                {best.covered}/{totalProducts} prodotti ·{" "}
                {best.supplier.delivery_days ?? "—"}g
              </span>
            }
            trailing={
              <div className="text-right">
                <div
                  className="font-serif text-[16px] font-medium text-[color:var(--color-brand-primary)]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {formatCurrency(best.total)}
                </div>
                {best.total < avgTotal && (
                  <div className="text-[10px] text-[#1A8F50]">
                    −{Math.round(((avgTotal - best.total) / avgTotal) * 100)}%
                    media
                  </div>
                )}
              </div>
            }
          />
        </GroupedList>
      )}

      {rest.length > 0 && (
        <GroupedList className="mt-2" label="Altri fornitori">
          {rest.map((r) => {
            const delta = r.total - avgTotal;
            const deltaPct = avgTotal > 0 ? (delta / avgTotal) * 100 : 0;
            return (
              <GroupedListRow
                key={r.supplier.id}
                leading={
                  <div
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#2B6F42] font-serif text-[11px] font-medium text-white"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {initials(r.supplier.supplier_name)}
                  </div>
                }
                title={r.supplier.supplier_name}
                subtitle={
                  <span>
                    {r.covered}/{totalProducts} prodotti ·{" "}
                    {r.supplier.delivery_days ?? "—"}g
                  </span>
                }
                trailing={
                  <div className="text-right">
                    <div
                      className="font-serif text-[15px] font-medium text-[color:var(--color-text-primary)]"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {formatCurrency(r.total)}
                    </div>
                    <div
                      className={
                        "text-[10px] " +
                        (delta > 0
                          ? "text-[#B8621E]"
                          : delta < 0
                            ? "text-[#1A8F50]"
                            : "text-[color:var(--text-muted-light)]")
                      }
                    >
                      {delta > 0 ? "+" : ""}
                      {deltaPct.toFixed(0)}%{" "}
                      {Math.abs(deltaPct) < 0.5 ? "media" : ""}
                    </div>
                  </div>
                }
              />
            );
          })}
        </GroupedList>
      )}
    </div>
  );
}
