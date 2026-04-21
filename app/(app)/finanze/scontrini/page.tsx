import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getFiscalEnabled,
  getLatestReceipts,
  getRestaurantsForCurrentUser,
  listIntegrations,
} from "@/lib/fiscal/queries";
import {
  formatCents,
  formatDateTime,
  paymentLabel,
  providerLabel,
} from "@/lib/fiscal/format";
import { FinanzeEmpty } from "../_components/finanze-empty";

export const metadata: Metadata = { title: "Scontrini" };

type Search = {
  r?: string;
  integration?: string;
  since?: string;
  until?: string;
  status?: "issued" | "voided" | "refunded" | "partial_refund";
};

export default async function ScontriniPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const restaurants = await getRestaurantsForCurrentUser();
  if (restaurants.length === 0) {
    return (
      <div className="p-6">
        <FinanzeEmpty
          heading="Nessun ristorante"
          body="Crea una sede dalle impostazioni."
          ctaLabel="Impostazioni sedi"
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

  const enabled = await getFiscalEnabled(selectedId);
  if (!enabled) {
    return (
      <div className="p-6">
        <FinanzeEmpty
          heading="Cassetto Fiscale non attivo"
          body="Attiva la feature nel dashboard Finanze."
          ctaLabel="Vai al dashboard"
          ctaHref={`/finanze?r=${selectedId}`}
        />
      </div>
    );
  }

  const [integrations, receipts] = await Promise.all([
    listIntegrations(selectedId),
    getLatestReceipts(selectedId, 200, {
      integrationId: params.integration,
      since: params.since,
      until: params.until,
      status: params.status,
    }),
  ]);

  const integrationById = new Map(integrations.map((i) => [i.id, i]));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/finanze?r=${selectedId}`}
          className="text-text-tertiary hover:text-text-secondary"
          aria-label="Torna al dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-bold">
            Cassetto Fiscale · Scontrini
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">
            {receipts.length} scontrini
          </h1>
        </div>
      </div>

      <form className="flex flex-wrap gap-3 items-end">
        <input type="hidden" name="r" value={selectedId} />
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
            Dal
          </label>
          <input
            type="date"
            name="since"
            defaultValue={params.since}
            className="bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
            Al
          </label>
          <input
            type="date"
            name="until"
            defaultValue={params.until}
            className="bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
            Integrazione
          </label>
          <select
            name="integration"
            defaultValue={params.integration ?? ""}
            className="bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="">Tutte</option>
            {integrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.display_name ?? providerLabel(i.provider)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
            Stato
          </label>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="">Tutti</option>
            <option value="issued">Emesso</option>
            <option value="voided">Annullato</option>
            <option value="refunded">Rimborsato</option>
            <option value="partial_refund">Rimborso parziale</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-accent-green text-surface-base text-sm font-medium rounded-lg px-4 py-2 hover:bg-accent-green/90 transition-colors"
        >
          Filtra
        </button>
      </form>

      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-base/40 text-xs uppercase tracking-wider text-text-tertiary">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Data</th>
              <th className="text-left px-6 py-3 font-medium">Integrazione</th>
              <th className="text-left px-6 py-3 font-medium">ID</th>
              <th className="text-left px-6 py-3 font-medium">Totale</th>
              <th className="text-left px-6 py-3 font-medium">Pagamento</th>
              <th className="text-left px-6 py-3 font-medium">Cop.</th>
              <th className="text-left px-6 py-3 font-medium">Operatore</th>
              <th className="text-left px-6 py-3 font-medium">Stato</th>
              <th className="px-4 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-12 text-center text-text-tertiary"
                >
                  Nessuno scontrino corrispondente ai filtri.
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border-subtle hover:bg-surface-hover/60 transition-colors"
                >
                  <td className="px-6 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {formatDateTime(r.issued_at)}
                  </td>
                  <td className="px-6 py-3 text-text-secondary whitespace-nowrap">
                    {integrationById.get(r.integration_id)?.display_name ??
                      providerLabel(
                        integrationById.get(r.integration_id)?.provider ?? "",
                      )}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-text-tertiary">
                    {r.external_id}
                  </td>
                  <td className="px-6 py-3 font-mono text-text-primary whitespace-nowrap">
                    {formatCents(r.total_cents)}
                  </td>
                  <td className="px-6 py-3 text-text-secondary whitespace-nowrap">
                    {paymentLabel(r.payment_method)}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {r.covers ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-text-secondary whitespace-nowrap">
                    {r.operator_name ?? "—"}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === "issued"
                          ? "bg-accent-green/10 text-accent-green"
                          : r.status === "voided"
                            ? "bg-accent-orange/10 text-accent-orange"
                            : "bg-text-tertiary/10 text-text-tertiary"
                      }`}
                    >
                      {r.status === "issued"
                        ? "Emesso"
                        : r.status === "voided"
                          ? "Annullato"
                          : r.status === "refunded"
                            ? "Rimborsato"
                            : "Parziale"}
                    </span>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
