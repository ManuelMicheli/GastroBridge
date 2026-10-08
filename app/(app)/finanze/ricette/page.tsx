import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CardEmpty, FCard } from "@/components/fernly/primitives";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { getFoodCostOverview } from "@/lib/food-cost/server/queries";
import { NoFinanceAccess, StatCard, eur, pctIt } from "../_components/finance-bits";
import { Help } from "../_components/help";
import { RecipesClient } from "./recipes-client";

export const metadata: Metadata = { title: "Food cost" };

export default async function RecipesPage() {
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const { db, ctx, canWrite } = access;
  const overview = await getFoodCostOverview(db, ctx.restaurantId);
  const dishes = overview.items.filter((i) => i.kind === "dish");
  const withMargin = dishes.filter((d) => d.margin !== null);
  const avgMargin = withMargin.length > 0 ? withMargin.reduce((s, d) => s + (d.margin ?? 0), 0) / withMargin.length : null;
  const missing = overview.items.filter((i) => i.missingCount > 0).length;

  return (
    <div className="px-1 lg:px-0">
      <PageHeader
        title="Food cost"
        subtitle="Schede tecniche sempre aggiornate: il costo di ogni piatto si ricalcola da solo con l'ultimo prezzo pagato in fattura."
        actions={
          <>
            <Link href="/finanze/ricette/menu" className="f-btn f-btn-sm f-btn-soft">
              <BarChart3 className="h-4 w-4" aria-hidden /> Menu e vendite
            </Link>
            {canWrite && (
              <Link href="/finanze/ricette/nuova" className="f-btn f-btn-sm f-btn-primary">
                <Plus className="h-4 w-4" aria-hidden /> Nuova ricetta
              </Link>
            )}
          </>
        }
      />

      {overview.items.length === 0 ? (
        <FCard>
          <CardEmpty
            action={
              canWrite ? (
                <Link href="/finanze/ricette/nuova" className="f-btn f-btn-sm f-btn-primary">
                  Crea la prima ricetta
                </Link>
              ) : undefined
            }
          >
            Inserisci gli ingredienti di un piatto: il costo per porzione, il food cost % e il margine si calcolano da soli e si aggiornano
            a ogni nuova fattura.
          </CardEmpty>
        </FCard>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:mb-4 lg:grid-cols-4 lg:gap-4">
            <StatCard index={0} label="Food cost medio" value={pctIt(overview.avgPct)} caption="Teorico, sui piatti con prezzo" tone="accent" />
            <StatCard
              index={1}
              label="Sopra l'obiettivo"
              value={String(overview.overTarget)}
              caption={overview.overTarget > 0 ? "Piatti da rivedere" : "Tutti i piatti nel target"}
              tone={overview.overTarget > 0 ? "danger" : "success"}
            />
            <StatCard index={2} label="Margine medio" value={eur(avgMargin)} caption="Per porzione, IVA esclusa" />
            <StatCard
              index={3}
              label="Prezzi mancanti"
              value={String(missing)}
              caption={missing > 0 ? "Ricette con ingredienti senza prezzo" : "Tutti gli ingredienti hanno un prezzo"}
              tone={missing > 0 ? "warning" : "ink"}
            />
          </div>
          <RecipesClient items={overview.items} alerts={overview.alerts} canWrite={canWrite} />
        </>
      )}

      <Help title="Da dove prendiamo i prezzi degli ingredienti?" className="mt-4">
        <p>
          1) l&apos;ultimo prezzo pagato nelle <strong>fatture dei fornitori</strong> (sconti in riga compresi, IVA esclusa); 2) se non
          l&apos;hai ancora comprato, il prezzo del tuo <strong>catalogo</strong> o del <strong>listino</strong> del fornitore; 3) un prezzo
          scritto a mano.
        </p>
        <p>
          Lo scarto % aumenta la quantità da comprare (es. 1 kg di carciofi con 40% di scarto costa come 1,67 kg). Quando un aumento fa
          superare l&apos;obiettivo a un piatto ti avvisiamo.
        </p>
      </Help>
    </div>
  );
}
