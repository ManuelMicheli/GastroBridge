import type { Metadata } from "next";
import Link from "next/link";
import { KPICard } from "@/components/dashboard/cards/kpi-card";
import { Euro, Receipt, Percent, Users } from "lucide-react";
import {
  getFiscalOverview,
  getRestaurantsForCurrentUser,
} from "@/lib/fiscal/queries";
import {
  formatCents,
  formatCentsCompact,
  formatDateTime,
  formatPct,
  paymentLabel,
  providerLabel,
} from "@/lib/fiscal/format";
import { FoodCostChart } from "./_components/food-cost-chart";
import { FinanzeEmpty } from "./_components/finanze-empty";

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
        <Header restaurants={restaurants} selectedId={selectedId} />
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
        <Header restaurants={restaurants} selectedId={selectedId} />
        <FinanzeEmpty
          heading="Nessuna cassa collegata"
          body="Collega un POS supportato (Tilby, Cassa in Cloud, Lightspeed, Scloby) o attiva l'ingresso webhook generico per iniziare a ricevere scontrini."
          ctaLabel="Collega POS"
          ctaHref={`/finanze/integrazioni?r=${selectedId}`}
        />
      </div>
    );
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const prev30From = new Date(cutoff);
  prev30From.setDate(prev30From.getDate() - 30);

  const last30 = overview.daily;
  const prev30Daily: typeof overview.daily = [];

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Incasso 30gg"
          value={formatCentsCompact(revenueLast30)}
          numericValue={Math.round(revenueLast30 / 100)}
          icon={Euro}
        />
        <KPICard
          label="Food cost %"
          value={formatPct(latestFoodCost)}
          numericValue={latestFoodCost ?? undefined}
          icon={Percent}
          accentColor={
            (latestFoodCost ?? 0) > 35
              ? "var(--color-accent-orange)"
              : "var(--color-accent-green)"
          }
        />
        <KPICard
          label="Scontrini 30gg"
          value={receiptsLast30.toLocaleString("it-IT")}
          numericValue={receiptsLast30}
          icon={Receipt}
        />
        <KPICard
          label="Coperti 30gg"
          value={coversLast30.toLocaleString("it-IT")}
          numericValue={coversLast30}
          icon={Users}
        />
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-text-secondary">
              Food cost % — ultimi 30 giorni
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Acquisti materia prima ÷ incasso POS
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
              Spesa 30gg
            </p>
            <p className="text-sm font-mono text-text-primary">
              {formatCents(spendLast30)}
            </p>
          </div>
        </div>
        <FoodCostChart data={overview.foodCost} />
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden">
        <div className="p-5 lg:p-6 flex items-center justify-between border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-secondary">
            Ultimi scontrini
          </h2>
          <Link
            href={`/finanze/scontrini?r=${selectedId}`}
            className="text-xs text-accent-green hover:underline"
          >
            Vedi tutti →
          </Link>
        </div>
        {overview.latestReceipts.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-text-tertiary">
            Nessuno scontrino ricevuto nelle ultime 24h
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-base/40 text-xs uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Data</th>
                <th className="text-left px-6 py-3 font-medium">Tot.</th>
                <th className="text-left px-6 py-3 font-medium">Pagamento</th>
                <th className="text-left px-6 py-3 font-medium">Coperti</th>
                <th className="text-left px-6 py-3 font-medium">Operatore</th>
                <th className="px-4 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {overview.latestReceipts.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border-subtle hover:bg-surface-hover/60 transition-colors"
                >
                  <td className="px-6 py-3 font-mono text-xs text-text-secondary">
                    {formatDateTime(r.issued_at)}
                  </td>
                  <td className="px-6 py-3 font-mono text-text-primary">
                    {formatCents(r.total_cents)}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {paymentLabel(r.payment_method)}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {r.covers ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {r.operator_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/finanze/scontrini/${r.id}?r=${selectedId}`}
                      className="text-xs text-accent-green hover:underline"
                    >
                      Dettagli
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
}: {
  restaurants: Array<{ id: string; name: string; is_primary: boolean }>;
  selectedId: string;
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
  );
}
