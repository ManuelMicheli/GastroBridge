import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { formatCurrency } from "@/lib/utils/formatters";
import { PRICE_WINDOW_DAYS, loadPriceIntel, type PriceChange } from "@/lib/restaurants/ordering/prices";
import { AlternativesList } from "./alternatives-list";

export const metadata: Metadata = { title: "Osservatorio prezzi" };

const dateFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });

function pct(a: number, b: number): string {
  if (a === 0) return "";
  const v = ((b - a) / a) * 100;
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}%`;
}

export default async function PricesPage() {
  const ctx = await getRestaurantContext();
  if (!ctx) redirect("/dashboard");
  const intel = await loadPriceIntel(ctx);
  const upImpact = intel.increases.reduce((s, c) => s + c.monthlyImpact, 0);
  const downImpact = intel.decreases.reduce((s, c) => s + c.monthlyImpact, 0);

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Osservatorio prezzi"
        subtitle={`Variazioni degli ultimi ${PRICE_WINDOW_DAYS} giorni sui prodotti che compri e alternative più convenienti dai tuoi fornitori, pesate sui tuoi volumi reali.`}
      />

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:mb-4 lg:gap-4">
        <Stat
          index={0}
          label="Aumenti"
          value={intel.increases.length}
          caption={upImpact > 0 ? `+${formatCurrency(upImpact)} al mese sui tuoi volumi` : "Nessun aumento rilevato"}
          tone="danger"
        />
        <Stat
          index={1}
          label="Ribassi"
          value={intel.decreases.length}
          caption={downImpact < 0 ? `${formatCurrency(downImpact)} al mese sui tuoi volumi` : "Nessun ribasso rilevato"}
          tone="success"
        />
        <Stat
          index={2}
          label="Risparmio potenziale"
          value={intel.potentialMonthlySaving > 0 ? formatCurrency(intel.potentialMonthlySaving) : "—"}
          caption={
            intel.alternatives.length > 0
              ? `al mese passando a ${intel.alternatives.length} alternativ${intel.alternatives.length === 1 ? "a" : "e"}`
              : "Nessuna alternativa più economica confrontabile"
          }
          tone="accent"
        />
      </div>

      {intel.trackedItems === 0 ? (
        <FCard>
          <CardEmpty action={<Link href="/cerca" className="f-btn f-btn-sm f-btn-primary">Cerca prodotti</Link>}>
            Servono i primi ordini: confrontiamo i prezzi dei prodotti che compri davvero.
          </CardEmpty>
        </FCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-2">
          <ChangesCard index={3} title="Aumenti" rows={intel.increases} up />
          <ChangesCard index={4} title="Ribassi" rows={intel.decreases} up={false} />
          <FCard index={5} className="xl:col-span-2" title="Alternative più convenienti">
            {intel.alternatives.length === 0 ? (
              <CardEmpty>
                Nessun prodotto equivalente costa meno presso gli altri tuoi fornitori (confronto per €/kg, €/l o €/pz).
              </CardEmpty>
            ) : (
              <AlternativesList alternatives={intel.alternatives} canOrder={contextCan(ctx, "order.submit")} />
            )}
          </FCard>
        </div>
      )}
      <p className="mt-4 text-[12px] text-[var(--f-muted)]">
        Prezzi IVA esclusa. Le variazioni dei listini importati vengono registrate da ora in poi, a ogni aggiornamento del
        listino; i prezzi dei fornitori collegati hanno lo storico completo.
      </p>
    </div>
  );
}

function Stat({
  index,
  label,
  value,
  caption,
  tone,
}: {
  index: number;
  label: string;
  value: string | number;
  caption: string;
  tone: "danger" | "success" | "accent";
}) {
  const color =
    tone === "danger" ? "text-[var(--f-danger)]" : tone === "success" ? "text-[var(--f-success)]" : "text-[var(--acc-ink)]";
  return (
    <FCard index={index}>
      <p className="text-[14px] text-[var(--f-muted)]">{label}</p>
      <p className={`mt-1 text-[32px] font-semibold tabular-nums tracking-[-0.02em] ${color}`}>{value}</p>
      <p className="mt-1 text-[12.5px] text-[var(--f-muted)]">{caption}</p>
    </FCard>
  );
}

function ChangesCard({ index, title, rows, up }: { index: number; title: string; rows: PriceChange[]; up: boolean }) {
  return (
    <FCard index={index} title={title}>
      {rows.length === 0 ? (
        <CardEmpty>{up ? "Nessun aumento sui prodotti che compri." : "Nessun ribasso sui prodotti che compri."}</CardEmpty>
      ) : (
        <ul className="divide-y divide-[var(--f-line)]">
          {rows.slice(0, 25).map((c) => (
            <li key={c.key} className="flex items-center gap-3 py-2.5">
              {up ? (
                <TrendingUp className="h-4 w-4 shrink-0 text-[var(--f-danger)]" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0 text-[var(--f-success)]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{c.name}</p>
                <p className="truncate text-[12px] text-[var(--f-muted)]">
                  {c.supplierName} · {formatCurrency(c.oldPrice)} → {formatCurrency(c.newPrice)}/{c.unit} ·{" "}
                  {dateFmt.format(new Date(c.changedAt))}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <StatusPill tone={up ? "danger" : "success"}>{pct(c.oldPrice, c.newPrice)}</StatusPill>
                {Math.abs(c.monthlyImpact) >= 0.5 && (
                  <p className="mt-0.5 text-[11.5px] tabular-nums text-[var(--f-muted)]">
                    {c.monthlyImpact > 0 ? "+" : ""}
                    {formatCurrency(c.monthlyImpact)}/mese
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </FCard>
  );
}
