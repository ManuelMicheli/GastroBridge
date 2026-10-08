import type { Metadata } from "next";
import Link from "next/link";
import { LineChart, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FCard, StatusPill } from "@/components/fernly/primitives";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { getInbox, getInvoiceKpis, getUpcomingPayments } from "@/lib/invoices/server/queries";
import { getConnection } from "@/lib/invoices/server/sdi";
import { activeProvider } from "@/lib/invoices/providers/registry";
import { connectionLabel, connectionPhase } from "@/lib/invoices/onboarding";
import type { InvoiceStatus } from "@/lib/invoices/types";
import { NoFinanceAccess, StatCard, eurCents } from "../_components/finance-bits";
import { Help } from "../_components/help";
import { InvoiceUpload } from "../_components/invoice-upload";
import { PaymentsList } from "../_components/payments-list";
import { InboxClient } from "./inbox-client";

export const metadata: Metadata = { title: "Fatture fornitori" };

const FILTERS = new Set<InvoiceStatus>(["da_verificare", "ok", "anomalie", "contestata", "risolta"]);

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const { db, ctx, canWrite } = access;
  const sp = await searchParams;
  const initial = sp.stato && FILTERS.has(sp.stato as InvoiceStatus) ? (sp.stato as InvoiceStatus) : "tutte";

  const [inbox, kpis, payments, connection] = await Promise.all([
    getInbox(db, ctx.restaurantId),
    getInvoiceKpis(db, ctx.restaurantId),
    getUpcomingPayments(db, ctx.restaurantId, 30),
    getConnection(db, ctx.restaurantId).catch(() => null),
  ]);
  const providerConfigured = activeProvider().status().configured;
  const connInput = {
    providerConfigured,
    status: connection?.status ?? null,
    lastInvoiceAt: connection?.last_invoice_at ?? null,
    lastError: connection?.last_error ?? null,
  };
  const phase = connectionPhase(connInput);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(new Date());

  return (
    <div className="px-1 lg:px-0">
      <PageHeader
        title="Fatture fornitori"
        subtitle="Ogni fattura viene confrontata da sola con l'ordine e con la merce ricevuta: le differenze diventano soldi da recuperare, con un clic."
        actions={
          <Link href="/finanze/fatture/prezzi" className="f-btn f-btn-sm f-btn-soft">
            <LineChart className="h-4 w-4" aria-hidden /> Storico prezzi
          </Link>
        }
      />

      {phase !== "connected" && (
        <FCard index={0} className="mb-3 lg:mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--acc-50)] text-[var(--acc-700)]">
              <Zap className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--f-ink)]">
                {phase === "waiting" ? "Ricezione automatica: in attesa della prima fattura" : "Ricevi le fatture in automatico"}
              </p>
              <p className="text-[13px] text-[var(--f-muted)]">
                {phase === "inactive"
                  ? "La ricezione dal Sistema di Interscambio non è ancora attiva su GastroBridge: nel frattempo carica i file qui sotto."
                  : phase === "waiting"
                    ? "Appena un fornitore ti fattura, la trovi qui già controllata."
                    : "Collega le fatture elettroniche una volta sola: arrivano qui e vengono controllate senza che tu faccia nulla."}
              </p>
            </div>
            {phase !== "inactive" && (
              <Link href="/finanze/fatture/collega" className="f-btn f-btn-sm f-btn-primary shrink-0">
                {phase === "waiting" ? "Vedi lo stato" : phase === "error" ? "Sistema il collegamento" : "Collega ora"}
              </Link>
            )}
          </div>
        </FCard>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:mb-4 lg:grid-cols-4 lg:gap-4">
        <StatCard
          index={1}
          label="Da recuperare"
          value={eurCents(kpis.toRecoverCents)}
          caption={kpis.toRecoverCents > 0 ? "Anomalie ancora da contestare" : "Nessuna differenza aperta"}
          tone={kpis.toRecoverCents > 0 ? "danger" : "ink"}
          href={kpis.toRecoverCents > 0 ? "/finanze/fatture?stato=anomalie" : undefined}
        />
        <StatCard
          index={2}
          label="In contestazione"
          value={eurCents(kpis.disputedCents)}
          caption={kpis.staleDisputes > 0 ? `${kpis.staleDisputes} in attesa da oltre 15 giorni` : "Attesa nota di credito"}
          tone={kpis.disputedCents > 0 ? "warning" : "ink"}
        />
        <StatCard index={3} label="Soldi recuperati" value={eurCents(kpis.recoveredCents)} caption="Note di credito ottenute" tone="success" />
        <StatCard
          index={4}
          label={`Spesa di ${monthLabel}`}
          value={eurCents(kpis.monthSpendCents, true)}
          caption="Imponibile, note di credito sottratte"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FCard index={5} title="Fatture" action={<StatusPill tone="neutral">{inbox.length}</StatusPill>}>
          <InboxClient items={inbox} initialFilter={initial} />
        </FCard>
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          <FCard index={6} title="Carica fatture">
            <InvoiceUpload canWrite={canWrite} compact />
            <Help title="Dove trovo i file delle fatture?" className="mt-3">
              <p>
                Sul portale <strong>Fatture e Corrispettivi</strong> dell&apos;Agenzia delle Entrate: Consultazione → Fatture elettroniche
                → Fatture ricevute → seleziona il periodo → <em>Download massivo</em>. Carica qui lo .zip così com&apos;è.
              </p>
              <p>Vanno bene anche i singoli .xml e .p7m che ti manda il commercialista o il fornitore.</p>
              <p>
                {phase === "connected" ? connectionLabel(connInput) + "." : "Con la ricezione automatica non serve più scaricare nulla."}
              </p>
            </Help>
          </FCard>
          <FCard index={7} title="Prossime scadenze">
            <PaymentsList items={payments} canWrite={canWrite} />
          </FCard>
        </div>
      </div>
    </div>
  );
}
