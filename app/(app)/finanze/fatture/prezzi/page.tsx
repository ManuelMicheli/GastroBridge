import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CardEmpty, FCard } from "@/components/fernly/primitives";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { getPriceSeries } from "@/lib/invoices/server/queries";
import { NoFinanceAccess } from "../../_components/finance-bits";
import { PriceHistoryClient } from "./price-history-client";

export const metadata: Metadata = { title: "Storico prezzi d'acquisto" };

export default async function PriceHistoryPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const sp = await searchParams;
  const series = await getPriceSeries(access.db, access.ctx.restaurantId, 365);
  return (
    <div className="px-1 lg:px-0">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/finanze/fatture" className="f-icon-btn !h-9 !w-9" aria-label="Torna alle fatture">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-[13px] text-[var(--f-muted)]">Fatture fornitori</span>
      </div>
      <PageHeader
        title="Storico prezzi"
        subtitle="Quanto hai pagato davvero ogni prodotto, fattura dopo fattura (IVA esclusa, sconti in riga compresi). Gli aumenti finiscono anche nel food cost delle ricette."
      />
      {series.length === 0 ? (
        <FCard>
          <CardEmpty action={<Link href="/finanze/fatture#carica" className="f-btn f-btn-sm f-btn-primary">Carica fatture</Link>}>
            Lo storico si crea da solo con le fatture dei fornitori.
          </CardEmpty>
        </FCard>
      ) : (
        <PriceHistoryClient series={series} initialKey={sp.p ?? null} />
      )}
    </div>
  );
}
