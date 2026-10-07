import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Download, FileText, Search, ShieldCheck, Thermometer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import {
  filtersFromParams,
  formatExpiry,
  formatReceivedAt,
  queryRegistry,
  type RegistryRow,
} from "@/lib/restaurants/receiving/registry";
import { loadHaccpSettings } from "@/lib/restaurants/receiving/server";
import { ISSUE_LABELS } from "@/lib/restaurants/receiving/types";
import { HaccpSettingsButton } from "./haccp-settings";

export const metadata: Metadata = { title: "Tracciabilità HACCP" };

const fmt = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n);

type LotGroup = {
  key: string;
  lot: string | null;
  product: string;
  supplier: string;
  first: string;
  last: string;
  qty: number;
  unit: string | null;
  expiries: string[];
  orders: string[];
};

function groupForRecall(rows: RegistryRow[]): LotGroup[] {
  const map = new Map<string, LotGroup>();
  for (const r of rows) {
    const key = `${(r.lotNumber ?? "").toLowerCase()}|${r.productName.toLowerCase()}|${r.supplierLabel.toLowerCase()}`;
    const g = map.get(key);
    if (g) {
      if (r.receivedAt < g.first) g.first = r.receivedAt;
      if (r.receivedAt > g.last) g.last = r.receivedAt;
      g.qty += r.receivedQty ?? 0;
      if (r.expiryDate && !g.expiries.includes(r.expiryDate)) g.expiries.push(r.expiryDate);
      if (!g.orders.includes(r.orderId)) g.orders.push(r.orderId);
    } else {
      map.set(key, {
        key,
        lot: r.lotNumber,
        product: r.productName,
        supplier: r.supplierLabel,
        first: r.receivedAt,
        last: r.receivedAt,
        qty: r.receivedQty ?? 0,
        unit: r.unit,
        expiries: r.expiryDate ? [r.expiryDate] : [],
        orders: [r.orderId],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
}

export default async function TraceabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getRestaurantContext();
  if (!ctx) redirect("/dashboard");
  const sp = await searchParams;
  const filters = filtersFromParams(sp);
  const recall = (Array.isArray(sp.vista) ? sp.vista[0] : sp.vista) === "richiamo";
  const hasRecallQuery = !!(filters.q || filters.lot);

  const [registry, settings] = await Promise.all([
    !recall || hasRecallQuery ? queryRegistry(ctx.scopeIds, filters, 300) : Promise.resolve(null),
    loadHaccpSettings(ctx.restaurantId),
  ]);

  const qs = new URLSearchParams();
  if (filters.q) qs.set("q", filters.q);
  if (filters.lot) qs.set("lot", filters.lot);
  if (filters.supplier) qs.set("fornitore", filters.supplier);
  if (filters.from) qs.set("dal", filters.from);
  if (filters.to) qs.set("al", filters.to);
  if (filters.onlyTraced) qs.set("tracciati", "1");
  if (filters.onlyIssues) qs.set("problemi", "1");
  if (recall) qs.set("richiamo", "1");
  const exportHref = (format: "csv" | "pdf") => `/api/tracciabilita/export?format=${format}&${qs.toString()}`;

  const rows = registry?.rows ?? [];
  const nonConform = rows.filter((r) => r.issue !== "ok" || r.temperatureOk === false).length;

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Tracciabilità HACCP"
        subtitle="Registro dei ricevimenti merce con lotti, scadenze e temperature (Reg. CE 178/2002). Pronto per i controlli."
        actions={
          <>
            <a href={exportHref("pdf")} className="f-btn f-btn-primary">
              <FileText className="h-4 w-4" /> PDF
            </a>
            <a href={exportHref("csv")} className="f-btn f-btn-outline">
              <Download className="h-4 w-4" /> CSV
            </a>
            {contextCan(ctx, "settings.manage") && <HaccpSettingsButton settings={settings} />}
          </>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Vista">
        <Link
          href="/tracciabilita"
          className={`f-btn f-btn-sm ${!recall ? "f-btn-primary" : "f-btn-outline"}`}
          aria-current={!recall ? "page" : undefined}
        >
          Registro
        </Link>
        <Link
          href="/tracciabilita?vista=richiamo"
          className={`f-btn f-btn-sm ${recall ? "f-btn-primary" : "f-btn-outline"}`}
          aria-current={recall ? "page" : undefined}
        >
          Richiamo prodotto
        </Link>
      </nav>

      <FCard index={0} className="mb-4">
        <form method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {recall && <input type="hidden" name="vista" value="richiamo" />}
          <input name="q" defaultValue={filters.q} placeholder="Prodotto (es. salmone)" className="f-input h-11 px-3 lg:col-span-2" />
          <input name="lot" defaultValue={filters.lot} placeholder="Lotto" className="f-input h-11 px-3" />
          {!recall && (
            <input name="fornitore" defaultValue={filters.supplier} placeholder="Fornitore" className="f-input h-11 px-3" />
          )}
          <input type="date" name="dal" defaultValue={filters.from ?? ""} className="f-input h-11 px-3" aria-label="Dal" />
          <input type="date" name="al" defaultValue={filters.to ?? ""} className="f-input h-11 px-3" aria-label="Al" />
          {!recall && (
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--f-ink-2)] lg:col-span-4">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="tracciati" value="1" defaultChecked={filters.onlyTraced} /> Solo con lotto
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="problemi" value="1" defaultChecked={filters.onlyIssues} /> Solo non conformità
              </label>
            </div>
          )}
          <button type="submit" className="f-btn f-btn-primary h-11 lg:col-span-2">
            <Search className="h-4 w-4" /> {recall ? "Cerca ricevimenti" : "Filtra"}
          </button>
        </form>
        {recall && (
          <p className="mt-3 text-[12.5px] text-[var(--f-muted)]">
            Richiamo di un fornitore o dell&apos;ASL: cerca il prodotto o il lotto per sapere quando l&apos;hai ricevuto, da
            chi, in che quantità e in quale ordine. Esporta il PDF da allegare alla risposta.
          </p>
        )}
      </FCard>

      {registry?.unavailable ? (
        <FCard>
          <CardEmpty>Registro non ancora attivo: vanno applicate le migrazioni del database.</CardEmpty>
        </FCard>
      ) : recall ? (
        !hasRecallQuery ? (
          <FCard>
            <CardEmpty>Scrivi un prodotto o un lotto per avviare la ricerca.</CardEmpty>
          </FCard>
        ) : (
          <RecallList groups={groupForRecall(rows)} />
        )
      ) : rows.length === 0 ? (
        <FCard>
          <CardEmpty action={<Link href="/ordini" className="f-btn f-btn-sm f-btn-primary">Vai agli ordini</Link>}>
            Nessun ricevimento registrato{qs.toString() ? " per questi filtri" : ""}. Alla consegna apri l&apos;ordine e tocca
            “Ricevi merce”.
          </CardEmpty>
        </FCard>
      ) : (
        <FCard
          index={1}
          title={`${rows.length}${registry?.truncated ? "+" : ""} righe`}
          action={
            nonConform > 0 ? (
              <StatusPill tone="danger">
                <AlertTriangle className="h-3 w-3" /> {nonConform} non conformità
              </StatusPill>
            ) : (
              <StatusPill tone="success">
                <ShieldCheck className="h-3 w-3" /> Tutto conforme
              </StatusPill>
            )
          }
        >
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--f-muted)]">
                <tr>
                  <th className="px-2 py-2 font-medium">Ricevuto</th>
                  <th className="px-2 py-2 font-medium">Fornitore</th>
                  <th className="px-2 py-2 font-medium">Prodotto</th>
                  <th className="px-2 py-2 font-medium">Lotto</th>
                  <th className="px-2 py-2 font-medium">Scadenza</th>
                  <th className="px-2 py-2 font-medium">T °C</th>
                  <th className="px-2 py-2 font-medium">Ricevuti</th>
                  <th className="px-2 py-2 font-medium">Esito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--f-line)]">
                {rows.map((r) => (
                  <tr key={r.lineId} className="align-top">
                    <td className="px-2 py-2 tabular-nums text-[var(--f-muted)]">
                      <Link href={`/ordini/${r.orderId}`} className="hover:underline">
                        {formatReceivedAt(r.receivedAt)}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{r.supplierLabel}</td>
                    <td className="px-2 py-2 font-medium text-[var(--f-ink)]">{r.productName}</td>
                    <td className="px-2 py-2 font-mono text-[12px]">{r.lotNumber ?? "—"}</td>
                    <td className="px-2 py-2 tabular-nums">{formatExpiry(r.expiryDate) || "—"}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {r.temperatureC === null ? (
                        "—"
                      ) : (
                        <span className={r.temperatureOk === false ? "inline-flex items-center gap-1 font-semibold text-[var(--f-danger)]" : ""}>
                          {r.temperatureOk === false && <Thermometer className="h-3 w-3" />}
                          {fmt(r.temperatureC)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {fmt(r.receivedQty)} {r.unit ?? ""}
                    </td>
                    <td className="px-2 py-2">
                      {r.issue === "ok" ? (
                        <StatusPill tone="success">OK</StatusPill>
                      ) : (
                        <StatusPill tone="danger">{ISSUE_LABELS[r.issue]}</StatusPill>
                      )}
                      {r.note ? <span className="mt-0.5 block text-[11.5px] text-[var(--f-muted)]">{r.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {registry?.truncated && (
            <p className="mt-3 text-[12px] text-[var(--f-muted)]">
              Mostrate le 300 registrazioni più recenti: restringi i filtri o esporta il CSV.
            </p>
          )}
        </FCard>
      )}
    </div>
  );
}

function RecallList({ groups }: { groups: LotGroup[] }) {
  if (groups.length === 0) {
    return (
      <FCard>
        <CardEmpty>Nessun ricevimento trovato: il prodotto o il lotto non risultano arrivati.</CardEmpty>
      </FCard>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {groups.map((g, i) => (
        <FCard key={g.key} index={i}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold text-[var(--f-ink)]">{g.product}</span>
            <StatusPill tone={g.lot ? "info" : "neutral"}>{g.lot ? `Lotto ${g.lot}` : "Lotto non registrato"}</StatusPill>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-[var(--f-muted)]">Fornitore</dt>
            <dd className="text-[var(--f-ink)]">{g.supplier}</dd>
            <dt className="text-[var(--f-muted)]">Ricevuto</dt>
            <dd className="tabular-nums text-[var(--f-ink)]">
              {formatReceivedAt(g.first)}
              {g.last !== g.first ? ` → ${formatReceivedAt(g.last)}` : ""}
            </dd>
            <dt className="text-[var(--f-muted)]">Quantità totale</dt>
            <dd className="tabular-nums text-[var(--f-ink)]">
              {fmt(g.qty)} {g.unit ?? ""}
            </dd>
            <dt className="text-[var(--f-muted)]">Scadenze</dt>
            <dd className="tabular-nums text-[var(--f-ink)]">{g.expiries.map(formatExpiry).join(", ") || "—"}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.orders.slice(0, 6).map((o) => (
              <Link key={o} href={`/ordini/${o}`} className="f-btn f-btn-xs f-btn-outline">
                Ordine #{o.slice(0, 8)}
              </Link>
            ))}
          </div>
        </FCard>
      ))}
    </div>
  );
}
