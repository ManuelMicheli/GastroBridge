import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChefHat, FileText, Store, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/fernly/kpi-card";
import { CardEmpty, FCard, StatusPill, type FTone } from "@/components/fernly/primitives";
import { getFiscalOverview, getRestaurantsForCurrentUser } from "@/lib/fiscal/queries";
import { formatCents, formatDateTime, paymentLabel } from "@/lib/fiscal/format";
import { getConnectionsState } from "@/lib/finance/server";
import type { Health } from "@/lib/finance/connections";
import { getFoodCostOverview } from "@/lib/food-cost/server/queries";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import {
  getAttentionInvoices,
  getInvoiceKpis,
  getPriceIncreases,
  getUpcomingPayments,
} from "@/lib/invoices/server/queries";
import { FoodCostChart } from "./_components/food-cost-chart";
import { FinanzeKpis } from "./_components/finanze-kpis";
import { ConnectionsPanel } from "./_components/connections-panel";
import { InvoiceStatusPill, NoFinanceAccess, dateShort, eurCents, pctIt } from "./_components/finance-bits";
import { PaymentsList } from "./_components/payments-list";
import { SedeSwitcher } from "./_components/sede-switcher";

export const metadata: Metadata = { title: "Finanze" };

const OVERALL: Record<Health, { tone: FTone; label: string }> = {
  ok: { tone: "success", label: "Collegamenti ok" },
  waiting: { tone: "warning", label: "In attesa di dati" },
  warning: { tone: "warning", label: "Collegamenti da controllare" },
  error: { tone: "danger", label: "Collegamento da sistemare" },
  off: { tone: "neutral", label: "Niente collegato" },
};

function sum(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0);
}

export default async function FinanzePage() {
  // The restaurant the user works on (sidebar / switcher below). Owners also
  // see their cash-register data; team members with analytics.financial see
  // invoices, payments and food cost.
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const owned = await getRestaurantsForCurrentUser();
  const { db, ctx, canWrite } = access;
  const rid = ctx.restaurantId;
  const isOwner = owned.some((r) => r.id === rid);

  const [kpis, attention, payments, increases, food, connections, pos] = await Promise.all([
    getInvoiceKpis(db, rid),
    getAttentionInvoices(db, rid, 6),
    getUpcomingPayments(db, rid, 30),
    getPriceIncreases(db, rid, 5).catch(() => []),
    getFoodCostOverview(db, rid).catch(() => null),
    getConnectionsState(db, rid),
    isOwner ? getFiscalOverview(rid) : Promise.resolve(null),
  ]);

  const posActive = !!pos && pos.enabled && pos.integrations.length > 0;
  const dishesOver = food ? food.items.filter((i) => i.kind === "dish" && i.overTarget) : [];
  const latestPosFoodCost = posActive && pos!.foodCost.length > 0 ? (pos!.foodCost[pos!.foodCost.length - 1]?.food_cost_pct ?? null) : null;
  const foodCostValue = food?.avgPct ?? latestPosFoodCost;
  const nothingYet = kpis.invoicesCount === 0 && !posActive && (food?.items.length ?? 0) === 0;
  const overall = OVERALL[connections.overall];
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(new Date());

  return (
    <div className="px-1 lg:px-0">
      <PageHeader
        title="Finanze"
        subtitle="Soldi recuperati dalle fatture, scadenze, food cost e incassi: tutto in un posto, aggiornato da solo."
        meta={
          <Link href="/finanze/collegamenti" aria-label="Stato collegamenti">
            <StatusPill tone={overall.tone} dot>
              {overall.label}
            </StatusPill>
          </Link>
        }
        actions={
          ctx.restaurants.length > 1 ? (
            <SedeSwitcher activeId={rid} restaurants={ctx.restaurants.map((r) => ({ id: r.restaurantId, name: r.name }))} />
          ) : null
        }
      />

      {nothingYet && (
        <FCard index={0} className="mb-3 lg:mb-4" title="Inizia da qui">
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FirstStep
              n={1}
              icon={<FileText className="h-5 w-5" aria-hidden />}
              title="Collega le fatture elettroniche"
              body="2 minuti: ogni fattura viene confrontata con ordini e consegne e ti diciamo quanto recuperare."
              href="/finanze/fatture/collega"
              cta="Collega"
            />
            <FirstStep
              n={2}
              icon={<Store className="h-5 w-5" aria-hidden />}
              title="Collega la cassa"
              body="Incassi, food cost reale e i piatti che rendono di più, dagli scontrini."
              href="/finanze/integrazioni"
              cta="Collega la cassa"
            />
            <FirstStep
              n={3}
              icon={<ChefHat className="h-5 w-5" aria-hidden />}
              title="Crea le schede tecniche"
              body="Il costo dei piatti si aggiorna con l'ultimo prezzo pagato."
              href="/finanze/ricette/nuova"
              cta="Nuova ricetta"
            />
          </ol>
        </FCard>
      )}

      <section aria-label="Indicatori" className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mb-4 lg:gap-4 xl:grid-cols-4">
        <KpiCard
          index={1}
          hero
          title="Soldi recuperati"
          value={kpis.recoveredCents / 100}
          format="currency"
          href="/finanze/fatture?stato=risolta"
          caption={kpis.disputedCents > 0 ? `${eurCents(kpis.disputedCents)} in contestazione` : "Con note di credito dei fornitori"}
        />
        <KpiCard
          index={2}
          title="Da recuperare"
          value={kpis.toRecoverCents / 100}
          format="currency"
          href="/finanze/fatture?stato=anomalie"
          caption={kpis.toRecoverCents > 0 ? "Differenze trovate in fattura: contestale" : "Nessuna differenza aperta"}
        />
        <KpiCard
          index={3}
          title={`Spesa fornitori · ${monthLabel}`}
          value={kpis.monthSpendCents / 100}
          format="currency0"
          href="/finanze/fatture"
          caption={`${kpis.invoicesCount} fatture negli ultimi 12 mesi`}
        />
        <KpiCard
          index={4}
          title="Food cost"
          value={foodCostValue ?? 0}
          format="decimal1"
          href="/finanze/ricette"
          valueOverride={foodCostValue === null ? "—" : `${pctIt(foodCostValue)}`}
          caption={
            food?.avgPct !== null && food?.avgPct !== undefined
              ? dishesOver.length > 0
                ? `${dishesOver.length} piatti sopra obiettivo`
                : "Teorico, dalle schede tecniche"
              : latestPosFoodCost !== null
                ? "Acquisti ÷ incasso cassa"
                : "Crea le schede tecniche"
          }
        />
      </section>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:mb-4 lg:gap-4 xl:grid-cols-2">
        <FCard
          index={5}
          title="Fatture da guardare"
          action={
            <Link href="/finanze/fatture" className="text-[12.5px] font-medium text-[var(--acc-ink)] hover:underline">
              Tutte
            </Link>
          }
        >
          {attention.length === 0 ? (
            <CardEmpty
              action={
                kpis.invoicesCount === 0 ? (
                  <Link href="/finanze/fatture" className="f-btn f-btn-sm f-btn-soft">
                    Carica fatture
                  </Link>
                ) : undefined
              }
            >
              {kpis.invoicesCount === 0 ? "Ancora nessuna fattura." : "Niente da controllare: le fatture corrispondono a ordini e consegne."}
            </CardEmpty>
          ) : (
            <ul className="divide-y divide-[var(--f-line)]">
              {attention.map((i) => (
                <li key={i.id}>
                  <Link href={`/finanze/fatture/${i.id}`} className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-[var(--f-fill)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{i.supplier_name ?? "Fornitore"}</p>
                      <p className="truncate text-[12px] text-[var(--f-muted)]">
                        n. {i.document_number} · {dateShort(i.document_date)}
                      </p>
                    </div>
                    {i.open_cents > 0 && (
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--f-danger)]">{eurCents(i.open_cents)}</span>
                    )}
                    <InvoiceStatusPill status={i.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FCard>
        <FCard index={6} title="Prossime scadenze">
          <PaymentsList items={payments} canWrite={canWrite} limit={6} />
        </FCard>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:mb-4 lg:gap-4 xl:grid-cols-3">
        <FCard
          index={7}
          title="Stato collegamenti"
          action={
            <Link href="/finanze/collegamenti" className="text-[12.5px] font-medium text-[var(--acc-ink)] hover:underline">
              Dettagli
            </Link>
          }
        >
          <ConnectionsPanel cards={connections.cards} canWrite={canWrite} compact />
        </FCard>
        <FCard
          index={8}
          title="Food cost"
          action={
            <Link href="/finanze/ricette" className="text-[12.5px] font-medium text-[var(--acc-ink)] hover:underline">
              Ricette
            </Link>
          }
        >
          {!food || food.items.length === 0 ? (
            <CardEmpty
              action={
                canWrite ? (
                  <Link href="/finanze/ricette/nuova" className="f-btn f-btn-sm f-btn-soft">
                    Nuova ricetta
                  </Link>
                ) : undefined
              }
            >
              Nessuna scheda tecnica ancora.
            </CardEmpty>
          ) : dishesOver.length === 0 && food.alerts.length === 0 ? (
            <CardEmpty>Tutti i piatti sono nell&apos;obiettivo di food cost.</CardEmpty>
          ) : (
            <ul className="space-y-2">
              {food.alerts.slice(0, 3).map((a) => (
                <li key={a.id} className="rounded-[12px] bg-[var(--f-danger-bg)] px-3 py-2 text-[13px]">
                  <Link href={`/finanze/ricette/${a.recipe_id}`} className="text-[var(--f-ink)] hover:underline">
                    {a.message}
                  </Link>
                </li>
              ))}
              {dishesOver
                .filter((d) => !food.alerts.some((a) => a.recipe_id === d.id))
                .slice(0, 4)
                .map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                    <Link href={`/finanze/ricette/${d.id}`} className="truncate text-[var(--f-ink)] hover:underline">
                      {d.name}
                    </Link>
                    <StatusPill tone="danger">
                      {pctIt(d.foodCostPct)} / {pctIt(d.targetPct, 0)}
                    </StatusPill>
                  </li>
                ))}
            </ul>
          )}
        </FCard>
        <FCard
          index={9}
          title="Prezzi in aumento"
          action={
            <Link href="/finanze/fatture/prezzi" className="text-[12.5px] font-medium text-[var(--acc-ink)] hover:underline">
              Storico
            </Link>
          }
        >
          {increases.length === 0 ? (
            <CardEmpty>Nessun aumento sugli ultimi acquisti in fattura.</CardEmpty>
          ) : (
            <ul className="divide-y divide-[var(--f-line)]">
              {increases.slice(0, 5).map((p) => (
                <li key={p.priceKey}>
                  <Link
                    href={`/finanze/fatture/prezzi?p=${encodeURIComponent(p.priceKey)}`}
                    className="flex items-center gap-2 py-2 text-[13.5px] hover:underline"
                  >
                    <TrendingUp className="h-4 w-4 shrink-0 text-[var(--f-danger)]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[var(--f-ink)]">{p.description}</span>
                    <span className="shrink-0 tabular-nums text-[var(--f-danger)]">+{p.pct.toFixed(1).replace(".", ",")}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FCard>
      </div>

      {posActive && pos && (
        <section aria-label="Cassa" className="space-y-3 lg:space-y-4">
          <FinanzeKpis
            revenueCents={sum(pos.daily.map((d) => d.revenue_cents))}
            foodCostPct={latestPosFoodCost}
            receipts={sum(pos.daily.map((d) => d.receipts_count))}
            covers={sum(pos.daily.map((d) => d.covers))}
          />
          <FCard title="Food cost dalla cassa · ultimi 30 giorni" action={<span className="text-[12.5px] text-[var(--f-muted)]">Spesa {formatCents(sum(pos.foodCost.map((d) => d.spend_cents)))}</span>}>
            <p className="mb-3 text-[12.5px] text-[var(--f-muted)]">Acquisti di materia prima ÷ incasso della cassa, giorno per giorno.</p>
            <FoodCostChart data={pos.foodCost} />
          </FCard>
          <FCard
            title="Ultimi scontrini"
            action={
              <Link href={`/finanze/scontrini?r=${rid}`} className="text-[12.5px] font-medium text-[var(--acc-ink)] hover:underline">
                Tutti
              </Link>
            }
          >
            {pos.latestReceipts.length === 0 ? (
              <CardEmpty>Nessuno scontrino nelle ultime 24 ore.</CardEmpty>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[11.5px] text-[var(--f-muted)]">
                      <th className="px-2 py-2 font-medium">Data</th>
                      <th className="px-2 py-2 font-medium">Totale</th>
                      <th className="px-2 py-2 font-medium">Pagamento</th>
                      <th className="px-2 py-2 font-medium">Coperti</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--f-line)]">
                    {pos.latestReceipts.map((r) => (
                      <tr key={r.id}>
                        <td className="px-2 py-2 text-[var(--f-muted)]">{formatDateTime(r.issued_at)}</td>
                        <td className="px-2 py-2 font-medium tabular-nums">{formatCents(r.total_cents)}</td>
                        <td className="px-2 py-2">{paymentLabel(r.payment_method)}</td>
                        <td className="px-2 py-2 tabular-nums">{r.covers ?? "—"}</td>
                        <td className="px-2 py-2 text-right">
                          <Link href={`/finanze/scontrini/${r.id}?r=${rid}`} className="inline-flex items-center gap-1 text-[var(--acc-ink)] hover:underline">
                            Dettagli <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FCard>
        </section>
      )}
    </div>
  );
}

function FirstStep({
  n,
  icon,
  title,
  body,
  href,
  cta,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-[16px] bg-[var(--f-fill)] p-4">
      <div className="flex items-center gap-2 text-[var(--acc-700)]">
        {icon}
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">Passo {n}</span>
      </div>
      <p className="text-[15px] font-semibold text-[var(--f-ink)]">{title}</p>
      <p className="flex-1 text-[13px] text-[var(--f-muted)]">{body}</p>
      <Link href={href} className="f-btn f-btn-sm f-btn-primary self-start">
        {cta}
      </Link>
    </li>
  );
}
