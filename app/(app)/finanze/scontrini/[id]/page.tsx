import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getReceiptById,
  getRestaurantsForCurrentUser,
  listIntegrations,
} from "@/lib/fiscal/queries";
import {
  formatCents,
  formatDateTime,
  paymentLabel,
  providerLabel,
} from "@/lib/fiscal/format";

export const metadata: Metadata = { title: "Scontrino" };

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const restaurants = await getRestaurantsForCurrentUser();
  const { id } = await params;
  const qs = await searchParams;
  const selectedId =
    qs.r && restaurants.find((r) => r.id === qs.r)
      ? qs.r
      : restaurants[0]?.id;
  if (!selectedId) notFound();

  const receipt = await getReceiptById(selectedId, id);
  if (!receipt) notFound();

  const integrations = await listIntegrations(selectedId);
  const integration = integrations.find((i) => i.id === receipt.integration_id);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/finanze/scontrini?r=${selectedId}`}
          className="text-text-tertiary hover:text-text-secondary"
          aria-label="Torna alla lista"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-bold">
            Scontrino · {integration?.display_name ?? providerLabel(integration?.provider ?? "")}
          </p>
          <h1 className="text-2xl font-semibold text-text-primary font-mono">
            #{receipt.external_id}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cell label="Data emissione" value={formatDateTime(receipt.issued_at)} />
        <Cell label="Giornata fiscale" value={receipt.business_day} />
        <Cell label="Pagamento" value={paymentLabel(receipt.payment_method)} />
        <Cell label="Stato" value={statusLabel(receipt.status)} />
        <Cell label="Tavolo" value={receipt.table_ref ?? "—"} />
        <Cell label="Coperti" value={receipt.covers?.toString() ?? "—"} />
        <Cell label="Operatore" value={receipt.operator_name ?? "—"} />
        <Cell label="Totale" value={formatCents(receipt.total_cents)} mono />
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden">
        <div className="px-5 lg:px-6 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-secondary">Righe</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-base/40 text-xs uppercase tracking-wider text-text-tertiary">
            <tr>
              <th className="text-left px-6 py-3 font-medium">#</th>
              <th className="text-left px-6 py-3 font-medium">Articolo</th>
              <th className="text-left px-6 py-3 font-medium">Qt.</th>
              <th className="text-left px-6 py-3 font-medium">Prezzo</th>
              <th className="text-left px-6 py-3 font-medium">Sconto</th>
              <th className="text-left px-6 py-3 font-medium">IVA</th>
              <th className="text-left px-6 py-3 font-medium">Subtotale</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-8 text-center text-text-tertiary"
                >
                  Nessuna riga.
                </td>
              </tr>
            ) : (
              receipt.items.map((it) => (
                <tr
                  key={it.line_number}
                  className={`border-t border-border-subtle ${
                    it.is_voided ? "opacity-60 line-through" : ""
                  }`}
                >
                  <td className="px-6 py-3 font-mono text-xs text-text-tertiary">
                    {it.line_number}
                  </td>
                  <td className="px-6 py-3 text-text-primary">
                    {it.name}
                    {it.category && (
                      <span className="ml-2 text-xs text-text-tertiary">
                        {it.category}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-mono text-text-secondary">
                    {it.quantity}
                  </td>
                  <td className="px-6 py-3 font-mono text-text-secondary">
                    {formatCents(it.unit_price_cents)}
                  </td>
                  <td className="px-6 py-3 font-mono text-text-secondary">
                    {it.discount_cents > 0
                      ? `- ${formatCents(it.discount_cents)}`
                      : "—"}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {it.vat_rate !== null ? `${it.vat_rate}%` : "—"}
                  </td>
                  <td className="px-6 py-3 font-mono text-text-primary">
                    {formatCents(it.subtotal_cents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-subtle bg-surface-base/20">
              <td colSpan={6} className="px-6 py-3 text-right text-text-tertiary text-xs uppercase">
                Subtotale
              </td>
              <td className="px-6 py-3 font-mono text-text-primary">
                {formatCents(receipt.subtotal_cents)}
              </td>
            </tr>
            <tr>
              <td colSpan={6} className="px-6 py-2 text-right text-text-tertiary text-xs uppercase">
                IVA
              </td>
              <td className="px-6 py-2 font-mono text-text-secondary">
                {formatCents(receipt.vat_cents)}
              </td>
            </tr>
            <tr className="border-t border-border-subtle">
              <td colSpan={6} className="px-6 py-3 text-right text-text-primary text-xs uppercase font-semibold">
                Totale
              </td>
              <td className="px-6 py-3 font-mono text-text-primary font-semibold">
                {formatCents(receipt.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
        {label}
      </p>
      <p
        className={`text-sm text-text-primary ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function statusLabel(
  s: "issued" | "voided" | "refunded" | "partial_refund",
): string {
  return s === "issued"
    ? "Emesso"
    : s === "voided"
      ? "Annullato"
      : s === "refunded"
        ? "Rimborsato"
        : "Rimborso parziale";
}
