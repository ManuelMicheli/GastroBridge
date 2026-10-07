// Customer intelligence block on the client detail (server component):
// cadence, products that fell off the basket, "similar clients also buy",
// credit (fido). Shown only to roles with `analytics.financial`.

import Link from "next/link";
import { Phone } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FCard, StatusPill } from "@/components/fernly/primitives";
import { getClientProductIntel } from "@/lib/supplier/intel/customers";
import { getCreditSnapshots } from "@/lib/supplier/intel/credit";
import { CADENCE_LABEL, CADENCE_TONE } from "@/lib/supplier/intel/cadence";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { CreditTermsEditor } from "./credit-terms-editor";

export async function ClientIntel({
  supabase,
  supplierId,
  restaurantId,
  relationshipId,
  canEditTerms,
  canOrder,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  supplierId: string;
  restaurantId: string;
  relationshipId: string;
  canEditTerms: boolean;
  canOrder: boolean;
}) {
  const [intel, credit] = await Promise.all([
    getClientProductIntel(supabase, supplierId, restaurantId),
    getCreditSnapshots(supabase, supplierId, [restaurantId]),
  ]);
  const c = intel.cadence;
  const snap = credit.snapshots.get(restaurantId) ?? null;
  const orderHref = `/supplier/ordini/nuovo?cliente=${relationshipId}`;

  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-3 lg:gap-4">
      <FCard title="Ritmo d'ordine" index={0}>
        {c && c.ordersCount > 0 ? (
          <>
            <StatusPill tone={CADENCE_TONE[c.status]}>{CADENCE_LABEL[c.status]}</StatusPill>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
              <div>
                <dt className="text-[var(--f-muted)]">Ultimo ordine</dt>
                <dd className="font-medium tabular-nums text-[var(--f-ink)]">
                  {c.lastOrderAt ? `${formatDate(c.lastOrderAt)} (${c.daysSinceLast} gg)` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--f-muted)]">Ordina ogni</dt>
                <dd className="font-medium tabular-nums text-[var(--f-ink)]">{c.cadenceDays ? `${c.cadenceDays} gg` : "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--f-muted)]">Prossimo atteso</dt>
                <dd className={`font-medium tabular-nums ${c.daysLate > 0 ? "text-[var(--f-danger)]" : "text-[var(--f-ink)]"}`}>
                  {c.expectedNextAt ? formatDate(c.expectedNextAt) : "—"}
                  {c.daysLate > 0 ? ` (+${c.daysLate} gg)` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--f-muted)]">Fatturato 90 gg</dt>
                <dd className="font-medium tabular-nums text-[var(--f-ink)]">
                  {formatCurrency(c.revenueLast90)}
                  {c.revenueTrend !== null && (
                    <span className={c.revenueTrend < 0 ? "text-[var(--f-danger)]" : "text-[var(--f-success)]"}>
                      {" "}
                      {c.revenueTrend > 0 ? "+" : ""}
                      {Math.round(c.revenueTrend * 100)}%
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[11.5px] text-[var(--f-muted)]">{c.ordersCount} giorni d&apos;ordine negli ultimi 180 gg</p>
          </>
        ) : (
          <p className="text-[13px] text-[var(--f-muted)]">Nessun ordine negli ultimi 180 giorni.</p>
        )}
        {canOrder && (
          <Link href={orderHref} className="f-btn f-btn-primary f-btn-sm mt-4">
            <Phone className="h-4 w-4" aria-hidden /> Prendi un ordine
          </Link>
        )}
      </FCard>

      <FCard title="Da riproporre" index={1}>
        <p className="f-eyebrow mb-2">Non li ordina più (da 45+ gg)</p>
        {intel.fallOff.length === 0 ? (
          <p className="mb-3 text-[12.5px] text-[var(--f-muted)]">Nessun prodotto abituale abbandonato.</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {intel.fallOff.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate text-[var(--f-ink)]">{p.name}</span>
                <span className="shrink-0 text-[11.5px] text-[var(--f-muted)]">ultimo {formatDate(p.lastOrderedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="f-eyebrow mb-2">Lo comprano clienti simili</p>
        {intel.suggestions.length === 0 ? (
          <p className="text-[12.5px] text-[var(--f-muted)]">
            {intel.similarClientsConsidered === 0
              ? "Servono ordini di altri clienti per i suggerimenti."
              : "Nessun cliente con un carrello abbastanza simile."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {intel.suggestions.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate text-[var(--f-ink)]">{p.name}</span>
                <span className="shrink-0 text-[11.5px] text-[var(--f-muted)] tabular-nums">
                  {formatCurrency(p.price)}/{p.unit} · {p.similarClients} clienti
                </span>
              </li>
            ))}
          </ul>
        )}
      </FCard>

      <FCard title="Fido e pagamenti" index={2}>
        <CreditTermsEditor
          restaurantId={restaurantId}
          snapshot={snap}
          canEdit={canEditTerms}
          available={credit.available}
        />
      </FCard>
    </div>
  );
}
