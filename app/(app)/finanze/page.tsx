import type { Metadata } from "next";
import Link from "next/link";
import { Plug, BookOpen } from "lucide-react";
import {
  getFiscalOverview,
  getRestaurantsForCurrentUser,
} from "@/lib/fiscal/queries";
import {
  formatCents,
  formatDateTime,
  paymentLabel,
  providerLabel,
} from "@/lib/fiscal/format";
import { FoodCostChart } from "./_components/food-cost-chart";
import { FinanzeEmpty } from "./_components/finanze-empty";
import { FinanzeKpis } from "./_components/finanze-kpis";
import { SectionFrame } from "@/components/dashboard/restaurant/_awwwards/section-frame";

export const metadata: Metadata = { title: "Finanze" };

function sum(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0);
}

export default async function FinanzePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const restaurants = await getRestaurantsForCurrentUser();
  if (restaurants.length === 0) {
    return (
      <div className="p-6">
        <FinanzeEmpty
          heading="Nessun ristorante collegato"
          body="Aggiungi una sede dalle impostazioni prima di attivare il Cassetto Fiscale."
          ctaLabel="Vai alle sedi"
          ctaHref="/impostazioni/sedi"
        />
      </div>
    );
  }

  const params = await searchParams;
  const selectedId =
    params.r && restaurants.find((r) => r.id === params.r)
      ? params.r
      : restaurants[0]!.id;

  const overview = await getFiscalOverview(selectedId);

  if (!overview.enabled) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Header
          restaurants={restaurants}
          selectedId={selectedId}
          showActions={false}
        />
        <FinanzeEmpty
          heading="Cassetto Fiscale non attivo"
          body="Attiva la feature per vedere food cost %, incasso vs ordini e alert su scorte in esaurimento basati sui tuoi scontrini."
          ctaLabel="Attiva e collega POS"
          ctaHref={`/finanze/integrazioni?r=${selectedId}`}
        />
      </div>
    );
  }

  if (overview.integrations.length === 0) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Header
          restaurants={restaurants}
          selectedId={selectedId}
          showActions={false}
        />
        <FinanzeEmpty
          heading="Nessuna cassa collegata"
          body="Collega un POS supportato (Tilby, Cassa in Cloud, Lightspeed, Scloby) o attiva l'ingresso webhook generico per iniziare a ricevere scontrini."
          ctaLabel="Collega POS"
          ctaHref={`/finanze/integrazioni?r=${selectedId}`}
          secondaryCtaLabel="Guida collegamento"
          secondaryCtaHref={`/finanze/guida?r=${selectedId}`}
        />
      </div>
    );
  }

  const last30 = overview.daily;

  const revenueLast30 = sum(last30.map((d) => d.revenue_cents));
  const receiptsLast30 = sum(last30.map((d) => d.receipts_count));
  const coversLast30 = sum(last30.map((d) => d.covers));
  const latestFoodCost =
    overview.foodCost.length > 0
      ? (overview.foodCost[overview.foodCost.length - 1]?.food_cost_pct ?? null)
      : null;
  const spendLast30 = sum(overview.foodCost.map((d) => d.spend_cents));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <Header restaurants={restaurants} selectedId={selectedId} />

      <FinanzeKpis
        revenueCents={revenueLast30}
        foodCostPct={latestFoodCost}
        receipts={receiptsLast30}
        covers={coversLast30}
      />


      <SectionFrame
        label="Food cost · Ultimi 30 giorni"
        trailing={`Spesa · ${formatCents(spendLast30)}`}
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          Acquisti materia prima ÷ incasso POS
        </p>
        <FoodCostChart data={overview.foodCost} />
      </SectionFrame>

      <SectionFrame
        label="Ultimi scontrini"
        trailing={
          <Link
            href={`/finanze/scontrini?r=${selectedId}`}
            className="text-accent-green hover:text-text-primary transition-colors"
          >
            vedi tutti →
          </Link>
        }
        padded={false}
      >
        {overview.latestReceipts.length === 0 ? (
          <div className="px-6 py-10 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            Nessuno scontrino ricevuto nelle ultime 24h
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary font-mono">
              <tr>
                <th className="text-left px-4 py-2.5 font-normal">Data</th>
                <th className="text-left px-4 py-2.5 font-normal">Tot.</th>
                <th className="text-left px-4 py-2.5 font-normal">Pagamento</th>
                <th className="text-left px-4 py-2.5 font-normal">Coperti</th>
                <th className="text-left px-4 py-2.5 font-normal">Operatore</th>
                <th className="px-4 py-2.5" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {overview.latestReceipts.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border-subtle hover:bg-surface-hover/60 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">
                    {formatDateTime(r.issued_at)}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-text-primary">
                    {formatCents(r.total_cents)}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {paymentLabel(r.payment_method)}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-text-secondary">
                    {r.covers ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {r.operator_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/finanze/scontrini/${r.id}?r=${selectedId}`}
                      className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green hover:text-text-primary transition-colors"
                    >
                      Dettagli
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionFrame>

      {overview.integrations.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-text-tertiary">
          {overview.integrations.map((i) => (
            <span
              key={i.id}
              className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-card px-3 py-1.5"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  i.status === "active"
                    ? "bg-accent-green"
                    : i.status === "error"
                      ? "bg-accent-orange"
                      : "bg-text-tertiary"
                }`}
                aria-hidden
              />
              {providerLabel(i.provider)}
              {i.last_synced_at && (
                <span className="text-text-tertiary/80">
                  · sync {formatDateTime(i.last_synced_at)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({
  restaurants,
  selectedId,
  showActions = true,
}: {
  restaurants: Array<{ id: string; name: string; is_primary: boolean }>;
  selectedId: string;
  showActions?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-bold mb-1">
          Area ristorante · Finanze
        </p>
        <h1 className="text-2xl font-semibold text-text-primary">
          Cassetto Fiscale
        </h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {showActions && (
          <>
            <Link
              href={`/finanze/integrazioni?r=${selectedId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-green px-3 py-1.5 text-xs font-medium text-surface-base hover:bg-accent-green/90"
            >
              <Plug className="h-3.5 w-3.5" />
              Integrazioni POS
            </Link>
            <Link
              href={`/finanze/guida?r=${selectedId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-accent"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Guida
            </Link>
          </>
        )}
        {restaurants.length > 1 && (
          <form className="flex items-center gap-2">
            <label className="text-xs text-text-tertiary">Sede</label>
            <select
              name="r"
              defaultValue={selectedId}
              className="bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.is_primary ? " (principale)" : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs text-accent-green hover:underline"
            >
              Cambia
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
