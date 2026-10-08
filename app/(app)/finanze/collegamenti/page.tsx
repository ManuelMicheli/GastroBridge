import type { Metadata } from "next";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FCard, StatusPill, type FTone } from "@/components/fernly/primitives";
import { getConnectionsState } from "@/lib/finance/server";
import type { Health } from "@/lib/finance/connections";
import { POS_HELP } from "@/lib/fiscal/pos-help";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { NoFinanceAccess } from "../_components/finance-bits";
import { ConnectionsPanel } from "../_components/connections-panel";
import { Help, Steps } from "../_components/help";

export const metadata: Metadata = { title: "Stato collegamenti" };

const OVERALL: Record<Health, { tone: FTone; label: string }> = {
  ok: { tone: "success", label: "Tutto funziona" },
  waiting: { tone: "warning", label: "In attesa di dati" },
  warning: { tone: "warning", label: "Qualcosa da controllare" },
  error: { tone: "danger", label: "Da sistemare" },
  off: { tone: "neutral", label: "Niente di collegato" },
};

export default async function ConnectionsPage() {
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const { db, ctx, canWrite } = access;
  const state = await getConnectionsState(db, ctx.restaurantId);
  const overall = OVERALL[state.overall];

  return (
    <div className="px-1 lg:px-0">
      <PageHeader
        title="Stato collegamenti"
        subtitle="Casse e fatture elettroniche in un colpo d'occhio. Se qualcosa non va trovi accanto il pulsante per sistemarlo."
        meta={
          <StatusPill tone={overall.tone} dot>
            {overall.label}
          </StatusPill>
        }
        actions={
          ctx.isOwner ? (
            <Link href="/finanze/integrazioni" className="f-btn f-btn-sm f-btn-soft">
              <Settings2 className="h-4 w-4" aria-hidden /> Gestisci casse
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <FCard index={0} title="Collegamenti">
          <ConnectionsPanel cards={state.cards} canWrite={canWrite} />
        </FCard>
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          <FCard index={1} title="Aiuto">
            <div className="space-y-2">
              <Help title="Come arrivano le fatture in automatico?">
                <p>
                  Registri una volta il nostro codice destinatario sul portale Fatture e Corrispettivi: da quel momento il Sistema di
                  Interscambio consegna ogni fattura dei fornitori a GastroBridge, che la controlla subito contro ordini e consegne.
                </p>
                <p>
                  <Link href="/finanze/fatture/collega" className="text-[var(--acc-ink)] underline-offset-2 hover:underline">
                    Apri il collegamento guidato
                  </Link>
                </p>
              </Help>
              {Object.entries(POS_HELP).map(([key, h]) => (
                <Help key={key} title={`Come collego ${h.title}?`}>
                  <Steps items={h.steps.map((s) => ({ title: s }))} />
                  {h.note && <p className="text-[12.5px] text-[var(--f-muted)]">{h.note}</p>}
                </Help>
              ))}
              <Help title="La spia resta gialla o rossa: cosa controllo?">
                <p>
                  Cassa: verifica che sia accesa e online, che la chiave API non sia stata rigenerata e che il locale fosse aperto. Fatture:
                  controlla sul portale che il codice destinatario sia ancora registrato. Se il problema resta scrivi a
                  supporto@gastrobridge.com indicando cosa vedi in questa pagina.
                </p>
              </Help>
            </div>
          </FCard>
        </div>
      </div>
    </div>
  );
}
