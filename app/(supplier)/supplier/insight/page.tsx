import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar, CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { KpiCard } from "@/components/fernly/kpi-card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { getCustomerInsights, type CustomerInsightRow } from "@/lib/supplier/intel/customers";
import { CADENCE_LABEL, CADENCE_TONE, type CadenceStatus } from "@/lib/supplier/intel/cadence";
import { CREDIT_FLAG_LABEL } from "@/lib/supplier/intel/credit";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Insight clienti — GastroBridge Fornitore" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ stato?: string }>;

const FILTERS: Array<{ key: "tutti" | CadenceStatus; label: string }> = [
  { key: "tutti", label: "Tutti" },
  { key: "a_rischio", label: "A rischio" },
  { key: "in_ritardo", label: "In ritardo" },
  { key: "dormiente", label: "Dormienti" },
  { key: "regolare", label: "Regolari" },
  { key: "nuovo", label: "Nuovi" },
];

function trendLabel(r: CustomerInsightRow): { text: string; tone: "success" | "danger" | "neutral" } {
  if (r.revenueTrend === null) return { text: "—", tone: "neutral" };
  const pct = Math.round(r.revenueTrend * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct >= 0 ? "success" : pct <= -20 ? "danger" : "neutral" };
}

export default async function InsightPage({ searchParams }: { searchParams: SearchParams }) {
  const { stato } = await searchParams;
  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "analytics.financial")) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader title="Insight clienti" />
        <FCard>
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Lock className="h-5 w-5 text-[var(--f-muted)]" aria-hidden />
            <p className="text-[13px] text-[var(--f-muted)]">Visibile ad amministratori e commerciali.</p>
          </div>
        </FCard>
      </div>
    );
  }

  const supabase = await createClient();
  const { rows, creditAvailable } = await getCustomerInsights(supabase, member.supplier_id);
  const filter = FILTERS.some((f) => f.key === stato) ? (stato as (typeof FILTERS)[number]["key"]) : "tutti";
  const shown = filter === "tutti" ? rows : rows.filter((r) => r.status === filter);

  const count = (s: CadenceStatus) => rows.filter((r) => r.status === s).length;
  const atRiskValue = rows
    .filter((r) => r.status === "a_rischio" || r.status === "in_ritardo")
    .reduce((sum, r) => sum + Math.max(r.revenuePrev90, r.revenueLast90), 0);
  const overCredit = rows.filter((r) => r.credit && (r.credit.flag === "over" || r.credit.flag === "hold")).length;

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Insight clienti"
        subtitle="Chi ordina con regolarità, chi sta rallentando e chi va richiamato oggi — calcolato sugli ordini reali degli ultimi 180 giorni."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <KpiCard index={0} hero title="Da richiamare" value={count("a_rischio") + count("in_ritardo")} href="/supplier/insight?stato=a_rischio" caption={<span>a rischio o in ritardo sulla loro cadenza</span>} />
        <KpiCard index={1} title="Fatturato in gioco" value={atRiskValue} format="currency0" caption={<span>valore a 90 gg dei clienti da richiamare</span>} />
        <KpiCard index={2} title="Dormienti" value={count("dormiente")} href="/supplier/insight?stato=dormiente" caption={<span>nessun ordine da oltre 60 giorni</span>} />
        <KpiCard
          index={3}
          title="Fido superato o bloccati"
          value={overCredit}
          valueOverride={creditAvailable ? undefined : "—"}
          caption={<span>{creditAvailable ? "esposizione stimata oltre il fido" : "fido non ancora attivo"}</span>}
        />
      </div>

      <nav aria-label="Filtra per stato" className="f-chips mb-4">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "tutti" ? "/supplier/insight" : `/supplier/insight?stato=${f.key}`}
            className="f-chip"
            data-active={filter === f.key}
          >
            {f.label}
            <span className="f-chip-count">{f.key === "tutti" ? rows.length : count(f.key)}</span>
          </Link>
        ))}
      </nav>

      <FCard index={4} bodyClassName="-mx-1">
        {shown.length === 0 ? (
          <CardEmpty>Nessun cliente in questa vista.</CardEmpty>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.06em] text-[var(--f-muted)]">
                  <tr className="border-b border-[var(--f-line)]">
                    <th className="px-2 py-2 font-medium">Cliente</th>
                    <th className="px-2 py-2 font-medium">Stato</th>
                    <th className="px-2 py-2 font-medium">Ultimo ordine</th>
                    <th className="px-2 py-2 font-medium">Cadenza</th>
                    <th className="px-2 py-2 font-medium">Atteso</th>
                    <th className="px-2 py-2 text-right font-medium">Fatt. 90 gg</th>
                    <th className="px-2 py-2 text-right font-medium">Trend</th>
                    <th className="px-2 py-2 font-medium">Fido</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const t = trendLabel(r);
                    return (
                      <tr key={r.restaurantId} className="border-b border-[var(--f-line)] last:border-0 hover:bg-[var(--f-fill)]">
                        <td className="px-2 py-2.5">
                          <Link href={`/supplier/clienti/${r.relationshipId}`} className="flex items-center gap-2.5">
                            <Avatar name={r.name} size={30} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-[var(--f-ink)]">{r.name}</span>
                              <span className="block text-[11.5px] text-[var(--f-muted)]">{r.city ?? "—"}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 py-2.5">
                          <StatusPill tone={CADENCE_TONE[r.status]}>{CADENCE_LABEL[r.status]}</StatusPill>
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {r.lastOrderAt ? `${formatDate(r.lastOrderAt)} (${r.daysSinceLast} gg)` : "Mai"}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">{r.cadenceDays ? `ogni ${r.cadenceDays} gg` : "—"}</td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {r.expectedNextAt ? (
                            <span className={r.daysLate > 0 ? "text-[var(--f-danger)]" : ""}>
                              {formatDate(r.expectedNextAt)}
                              {r.daysLate > 0 ? ` (+${r.daysLate} gg)` : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(r.revenueLast90)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <StatusPill tone={t.tone}>{t.text}</StatusPill>
                        </td>
                        <td className="px-2 py-2.5">
                          {r.credit && r.credit.flag !== "none" ? (
                            <span className="text-[12px] tabular-nums">
                              <StatusPill tone={r.credit.flag === "ok" ? "success" : r.credit.flag === "near" ? "warning" : "danger"}>
                                {CREDIT_FLAG_LABEL[r.credit.flag]}
                              </StatusPill>
                              <span className="ml-1.5 text-[var(--f-muted)]">{formatCurrency(r.credit.exposure)}</span>
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--f-muted)]">
                              {r.credit && r.credit.exposure > 0 ? formatCurrency(r.credit.exposure) : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col divide-y divide-[var(--f-line)] lg:hidden">
              {shown.map((r) => (
                <li key={r.restaurantId} className="flex items-center gap-3 px-1 py-3">
                  <Avatar name={r.name} size={36} />
                  <Link href={`/supplier/clienti/${r.relationshipId}`} className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{r.name}</p>
                    <p className="text-[12px] text-[var(--f-muted)]">
                      {r.lastOrderAt ? `Ultimo ordine ${r.daysSinceLast} gg fa` : "Nessun ordine"}
                      {r.cadenceDays ? ` · di solito ogni ${r.cadenceDays} gg` : ""}
                    </p>
                  </Link>
                  <StatusPill tone={CADENCE_TONE[r.status]}>{CADENCE_LABEL[r.status]}</StatusPill>
                  {r.phone && (
                    <a href={`tel:${r.phone.replace(/\s+/g, "")}`} className="f-icon-btn" aria-label={`Chiama ${r.name}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </FCard>
      <p className="mt-3 text-[12px] text-[var(--f-muted)]">
        Cadenza = mediana dei giorni tra due ordini (servono almeno 3 ordini). In ritardo oltre 1,5× la cadenza, a
        rischio oltre 2,5× o con fatturato −40%. L&apos;esposizione è stimata da ordini aperti + consegnati entro i
        termini di pagamento (la fatturazione non è ancora gestita in GastroBridge).
      </p>
    </div>
  );
}
