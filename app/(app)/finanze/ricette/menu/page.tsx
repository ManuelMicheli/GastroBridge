import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { getMenuAnalysis } from "@/lib/food-cost/server/queries";
import { MENU_CLASS_LABELS, suggestPosLinks, type MenuClass } from "@/lib/food-cost/analysis";
import { NoFinanceAccess, StatCard, dateIt, eur, eurCents, pctIt, qtyIt } from "../../_components/finance-bits";
import { Help } from "../../_components/help";
import { PosLinker } from "./pos-linker";

export const metadata: Metadata = { title: "Menu e vendite" };

const PERIODS = [7, 30, 90] as const;
const CLASS_TONE: Record<MenuClass, "success" | "warning" | "info" | "danger"> = {
  star: "success",
  plowhorse: "warning",
  puzzle: "info",
  dog: "danger",
};

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ giorni?: string }> }) {
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const { db, ctx, canWrite } = access;
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.giorni) as (typeof PERIODS)[number]) ? Number(sp.giorni) : 30;
  const a = await getMenuAnalysis(db, ctx.restaurantId, days);
  const unlinked = a.sales.filter((s) => !s.linkedRecipeId);
  const suggestions = suggestPosLinks(
    unlinked.map((s) => s.name),
    a.recipes,
  );
  const coverage = a.revenueNetCents > 0 ? (a.linkedRevenueNetCents / a.revenueNetCents) * 100 : null;
  const noSales = !a.posAvailable || a.sales.length === 0;

  return (
    <div className="px-1 lg:px-0">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/finanze/ricette" className="f-icon-btn !h-9 !w-9" aria-label="Torna al food cost">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-[13px] text-[var(--f-muted)]">Food cost</span>
      </div>
      <PageHeader
        title="Menu e vendite"
        subtitle="Collega i piatti della cassa alle ricette: vedi quanto rende davvero ogni piatto e quanto dovresti consumare."
        actions={
          <div className="f-chips">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/finanze/ricette/menu?giorni=${p}`}
                data-active={p === days}
                className={
                  p === days
                    ? "f-chip bg-[linear-gradient(180deg,color-mix(in_oklab,var(--acc-700)_65%,var(--acc-800)),var(--acc-800))]"
                    : "f-chip"
                }
              >
                {p} giorni
              </Link>
            ))}
          </div>
        }
      />
      <p className="-mt-3 mb-4 text-[12.5px] text-[var(--f-muted)]">
        Periodo: {dateIt(a.period.from)} – {dateIt(a.period.to)}
      </p>

      {noSales ? (
        <FCard className="mb-4">
          <CardEmpty action={<Link href="/finanze/collegamenti" className="f-btn f-btn-sm f-btn-primary">Collega la cassa</Link>}>
            {a.posAvailable
              ? "Nessuna vendita dalla cassa in questo periodo. Collega il POS (o importa un CSV degli scontrini) per vedere popolarità e margini dei piatti."
              : "Le vendite della cassa non sono disponibili: collega il POS per attivare il menu engineering."}
          </CardEmpty>
        </FCard>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-3 lg:mb-4 lg:grid-cols-4 lg:gap-4">
          <StatCard index={0} label="Incasso netto cassa" value={eurCents(a.revenueNetCents, true)} caption="IVA esclusa" />
          <StatCard
            index={1}
            label="Food cost teorico"
            value={pctIt(a.theoreticalPct)}
            caption={coverage !== null ? `Sul ${Math.round(coverage)}% dell'incasso collegato a ricette` : "Collega i piatti alle ricette"}
            tone="accent"
          />
          <StatCard
            index={2}
            label="Food cost reale"
            value={pctIt(a.actualPct)}
            caption="Solo acquisti in fattura ÷ incasso (senza inventario)"
            tone={a.actualPct !== null && a.theoreticalPct !== null && a.actualPct - a.theoreticalPct > 3 ? "danger" : "ink"}
          />
          <StatCard index={3} label="Acquisti in fattura" value={eurCents(a.purchasesCents, true)} caption="Imponibile del periodo" />
        </div>
      )}

      {!noSales && a.actualPct !== null && a.theoreticalPct !== null && (
        <Help title="Perché teorico e reale sono diversi?" className="mb-4">
          <p>
            Il <strong>teorico</strong> è quanto avresti dovuto spendere per i piatti venduti secondo le schede tecniche. Il{" "}
            <strong>reale</strong> qui è calcolato solo sugli acquisti fatturati nel periodo, senza inventario: se hai fatto scorta o
            consumato magazzino i due numeri si allontanano. Una differenza che resta alta per settimane indica sprechi, porzioni
            abbondanti, cali non registrati o ricette da aggiornare.
          </p>
        </Help>
      )}

      {!noSales && (
        <FCard index={4} title="Piatti venduti ↔ ricette" className="mb-3 lg:mb-4">
          <PosLinker sales={a.sales} recipes={a.recipes} suggestions={suggestions} canWrite={canWrite} />
        </FCard>
      )}

      {a.menu.length > 0 && (
        <FCard index={5} title="Menu engineering" className="mb-3 lg:mb-4">
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["puzzle", "star", "dog", "plowhorse"] as MenuClass[]).map((k) => {
              const list = a.menu.filter((m) => m.klass === k);
              return (
                <div key={k} className="rounded-[14px] bg-[var(--f-fill)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill tone={CLASS_TONE[k]}>{MENU_CLASS_LABELS[k].label}</StatusPill>
                    <span className="text-[12px] text-[var(--f-muted)]">{list.length}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-[var(--f-muted)]">{MENU_CLASS_LABELS[k].hint}</p>
                  <p className="mt-1.5 text-[13px] text-[var(--f-ink)]">{list.map((m) => m.name).join(", ") || "—"}</p>
                </div>
              );
            })}
          </div>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-[var(--f-muted)]">
                  <th className="px-2 py-2 font-medium">Piatto</th>
                  <th className="px-2 py-2 text-right font-medium">Venduti</th>
                  <th className="px-2 py-2 text-right font-medium">Prezzo medio netto</th>
                  <th className="px-2 py-2 text-right font-medium">Costo</th>
                  <th className="px-2 py-2 text-right font-medium">Food cost</th>
                  <th className="px-2 py-2 text-right font-medium">Margine tot.</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--f-line)]">
                {a.menu.map((m) => (
                  <tr key={m.recipeId}>
                    <td className="px-2 py-2">
                      <Link href={`/finanze/ricette/${m.recipeId}`} className="font-medium text-[var(--f-ink)] hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{qtyIt(m.qtySold)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{eur(m.avgNetPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{eur(m.costPerPortion)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{pctIt(m.foodCostPct)}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{eur(m.totalMargin, true)}</td>
                    <td className="px-2 py-2 text-right">
                      <StatusPill tone={CLASS_TONE[m.klass]}>{MENU_CLASS_LABELS[m.klass].label}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-[var(--f-muted)]">
            Popolare = almeno il 70% della quota media di vendite; redditizio = margine unitario sopra la media pesata ({eur(a.marginThreshold)}).
          </p>
        </FCard>
      )}

      {a.consumption.length > 0 && (
        <FCard index={6} title="Consumo teorico vs acquistato">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-[var(--f-muted)]">
                  <th className="px-2 py-2 font-medium">Ingrediente</th>
                  <th className="px-2 py-2 text-right font-medium">Teorico</th>
                  <th className="px-2 py-2 text-right font-medium">Acquistato</th>
                  <th className="px-2 py-2 text-right font-medium">Costo teorico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--f-line)]">
                {a.consumption.map((c) => {
                  const diff = c.purchased !== null && c.theoretical > 0 ? ((c.purchased - c.theoretical) / c.theoretical) * 100 : null;
                  return (
                    <tr key={`${c.priceKey}-${c.base}`}>
                      <td className="px-2 py-2 text-[var(--f-ink)]">{c.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {qtyIt(c.theoretical)} {c.base}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {c.purchased !== null ? `${qtyIt(c.purchased)} ${c.base}` : "—"}
                        {diff !== null && Math.abs(diff) >= 15 && (
                          <span className={`ml-1.5 text-[11.5px] ${diff > 0 ? "text-[var(--f-warning)]" : "text-[var(--f-muted)]"}`}>
                            ({diff > 0 ? "+" : ""}
                            {Math.round(diff)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{eur(c.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-[var(--f-muted)]">
            Teorico = porzioni vendute × dosi delle schede (scarto compreso). Acquistato = quantità nelle fatture del periodo per lo stesso prodotto.
          </p>
        </FCard>
      )}
    </div>
  );
}
