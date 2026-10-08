"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Hourglass, Mail, MessageCircle, PlugZap } from "lucide-react";
import { FCard, StatusPill, type FTone } from "@/components/fernly/primitives";
import { toast } from "@/components/ui/toast";
import { confirmPortalRegistration, connectSdi, syncSdiNow } from "@/lib/invoices/actions";
import {
  connectionLabel,
  connectionPhase,
  mailtoUrl,
  portalSteps,
  supplierNoticeEmail,
  supplierNoticeEmailSubject,
  supplierNoticeWhatsApp,
  whatsappShareUrl,
} from "@/lib/invoices/onboarding";
import { cn } from "@/lib/utils/formatters";
import { Help, Steps } from "../../_components/help";
import { InvoiceUpload } from "../../_components/invoice-upload";

const PORTAL_URL = "https://ivaservizi.agenziaentrate.gov.it/portale/";

type Props = {
  canWrite: boolean;
  provider: { configured: boolean; label: string; sandbox: boolean; missing: string[]; recipientCode: string | null };
  defaults: { fiscalId: string; companyName: string; email: string };
  connection: {
    status: "pending" | "active" | "error" | "disabled";
    fiscalId: string;
    companyName: string | null;
    recipientCode: string | null;
    portalConfirmedAt: string | null;
    lastInvoiceAt: string | null;
    lastError: string | null;
  } | null;
  restaurantName: string;
};

const PHASE_TONE: Record<string, FTone> = { inactive: "neutral", not_connected: "neutral", error: "danger", waiting: "warning", connected: "success" };

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiato`);
  } catch {
    toast.error("Copia non riuscita: seleziona il testo e copialo a mano");
  }
}

function Section({ n, title, done, disabled, children }: { n: number; title: string; done?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <FCard index={n} className={cn(disabled && "opacity-55")} ariaLabel={title}>
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold",
            done ? "bg-[var(--f-success-bg)] text-[var(--f-success)]" : "bg-[var(--acc-50)] text-[var(--acc-700)]",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <h2 className="f-card-title">{title}</h2>
      </div>
      <fieldset disabled={disabled} aria-disabled={disabled || undefined} className={cn("min-w-0", disabled && "pointer-events-none select-none")}>
        {children}
      </fieldset>
    </FCard>
  );
}

/**
 * "Collega le fatture elettroniche" — one screen: register the company with
 * the SDI intermediary, show the codice destinatario + the 3 steps on the
 * Agenzia delle Entrate portal, tell the suppliers, optionally import the
 * history, and follow the live status.
 */
export function ConnectWizard({ canWrite, provider, defaults, connection, restaurantName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fiscalId, setFiscalId] = useState(connection?.fiscalId ?? defaults.fiscalId);
  const [companyName, setCompanyName] = useState(connection?.companyName ?? defaults.companyName);
  const [email, setEmail] = useState(defaults.email);
  const [error, setError] = useState<string | null>(null);

  const statusInput = {
    providerConfigured: provider.configured,
    status: connection?.status ?? null,
    lastInvoiceAt: connection?.lastInvoiceAt ?? null,
    lastError: connection?.lastError ?? null,
  };
  const phase = connectionPhase(statusInput);
  const registered = !!connection?.recipientCode && connection.status !== "disabled";
  const code = connection?.recipientCode ?? provider.recipientCode ?? "";
  const portalDone = !!connection?.portalConfirmedAt;
  const notice = { companyName: connection?.companyName ?? companyName, fiscalId: connection?.fiscalId ?? fiscalId, recipientCode: code, signature: restaurantName };

  // Live status: while waiting for the first invoice, refresh every 30 s.
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(t);
  }, [phase, router]);

  function register() {
    setError(null);
    const vat = fiscalId.replace(/\s+/g, "").replace(/^IT/i, "");
    if (!/^\d{11}$/.test(vat)) {
      setError("La Partita IVA ha 11 cifre");
      return;
    }
    if (companyName.trim().length < 2) {
      setError("Scrivi la ragione sociale come in visura");
      return;
    }
    start(async () => {
      const res = await connectSdi({ fiscalId: vat, companyName: companyName.trim(), email: email.trim() || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Fatto! Ora registra il codice sul portale");
      router.refresh();
    });
  }

  function confirmPortal() {
    start(async () => {
      const res = await confirmPortalRegistration();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Perfetto: aspettiamo la prima fattura");
        router.refresh();
      }
    });
  }

  function checkNow() {
    start(async () => {
      const res = await syncSdiNow();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.data.imported > 0 ? `${res.data.imported} nuove fatture` : "Nessuna nuova fattura per ora");
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-[860px] space-y-3 lg:space-y-4">
      <header className="mb-2">
        <h1 className="f-title">Collega le fatture elettroniche</h1>
        <p className="f-subtitle mt-1 max-w-[62ch]">
          Una volta sola, 2 minuti: le fatture dei tuoi fornitori arrivano qui da sole e vengono confrontate con ordini e consegne.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
          <StatusPill tone={PHASE_TONE[phase] ?? "neutral"} dot>
            {connectionLabel(statusInput)}
          </StatusPill>
          {phase === "waiting" && <Hourglass className="h-4 w-4 animate-pulse text-[var(--f-warning)]" aria-hidden />}
          {registered && canWrite && provider.configured && (
            <button type="button" className="f-btn f-btn-xs f-btn-ghost" onClick={checkNow} disabled={pending}>
              Controlla ora
            </button>
          )}
        </div>
      </header>

      {!provider.configured && (
        <FCard index={0}>
          <div className="flex gap-3">
            <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-[var(--f-muted)]" aria-hidden />
            <div className="min-w-0 space-y-2 text-[13.5px]">
              <p className="text-[15px] font-semibold text-[var(--f-ink)]">La ricezione automatica non è ancora attiva</p>
              <p className="text-[var(--f-muted)]">
                Stiamo completando l&apos;attivazione con il nostro intermediario SDI. Nel frattempo tutto il resto funziona: carica qui sotto
                lo .zip scaricato dal cassetto fiscale (o i singoli .xml / .p7m) e controlliamo ogni fattura allo stesso modo.
              </p>
              <Help title="Dettagli tecnici (per chi gestisce GastroBridge)">
                <p>
                  Intermediario: {provider.label}. Variabili d&apos;ambiente mancanti:{" "}
                  <code className="text-[12px]">{provider.missing.join(", ") || "—"}</code>.
                </p>
              </Help>
            </div>
          </div>
        </FCard>
      )}

      {provider.configured && (
        <Section n={1} title="I dati della tua azienda" done={registered}>
          {registered ? (
            <p className="text-[13.5px] text-[var(--f-ink-2)]">
              {connection?.companyName} · P.IVA {connection?.fiscalId} — registrata presso {provider.label}
              {provider.sandbox ? " (ambiente di prova)" : ""}.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="f-label mb-1 block">Partita IVA</span>
                  <input className="f-input" inputMode="numeric" value={fiscalId} onChange={(e) => setFiscalId(e.target.value)} placeholder="01234567890" />
                </label>
                <label className="block">
                  <span className="f-label mb-1 block">Ragione sociale</span>
                  <input className="f-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="f-label mb-1 block">Email per gli avvisi (facoltativa)</span>
                  <input className="f-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
              </div>
              {(error || (connection?.status === "error" && connection.lastError)) && (
                <p className="flex items-start gap-2 rounded-[12px] bg-[var(--f-danger-bg)] px-3 py-2 text-[13px] text-[var(--f-danger)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error ?? connection?.lastError}
                </p>
              )}
              {canWrite ? (
                <button type="button" className="f-btn f-btn-primary" onClick={register} disabled={pending}>
                  {pending ? "Attivo…" : "Attiva la ricezione"}
                </button>
              ) : (
                <p className="text-[13px] text-[var(--f-muted)]">Chiedi al titolare o a un manager di attivare la ricezione.</p>
              )}
              <p className="text-[12.5px] text-[var(--f-muted)]">
                Usiamo questi dati solo per ricevere le fatture passive: niente firma, niente invio di fatture per tuo conto.
              </p>
            </div>
          )}
        </Section>
      )}

      {provider.configured && (
        <Section n={2} title="Registra il codice sul portale dell'Agenzia delle Entrate" done={portalDone} disabled={!registered}>
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="shrink-0 rounded-[16px] bg-[var(--acc-50)] px-5 py-4 text-center lg:w-[230px]">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--acc-700)]">Codice destinatario</p>
              <p className="my-1.5 font-mono text-[32px] font-semibold tracking-[0.12em] text-[var(--acc-900)]">{code || "—"}</p>
              <button type="button" className="f-btn f-btn-sm f-btn-primary" onClick={() => copy(code, "Codice")} disabled={!code}>
                <Copy className="h-4 w-4" aria-hidden /> Copia
              </button>
            </div>
            <div className="min-w-0 flex-1 text-[13.5px]">
              <Steps items={portalSteps(code || "il codice")} />
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="f-btn f-btn-sm f-btn-soft" href={PORTAL_URL} target="_blank" rel="noopener noreferrer">
                  Apri Fatture e Corrispettivi <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                {!portalDone && canWrite && (
                  <button type="button" className="f-btn f-btn-sm f-btn-primary" onClick={confirmPortal} disabled={pending || !registered}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Fatto, l&apos;ho registrato
                  </button>
                )}
              </div>
            </div>
          </div>
          <Help title="Il commercialista riceve già le mie fatture: cosa cambia?" className="mt-3">
            <p>
              L&apos;indirizzo registrato sul portale è uno solo. Se oggi le fatture arrivano al gestionale del commercialista con un suo
              codice, chiedigli prima: molti software possono importare le fatture anche dal cassetto fiscale, oppure possiamo inoltrargliele.
            </p>
            <p>
              In alternativa salta questo passo e comunica il codice <strong>{code || "—"}</strong> solo ai fornitori (passo 3): riceverai
              le fatture di chi lo inserisce.
            </p>
          </Help>
        </Section>
      )}

      {provider.configured && (
        <Section n={3} title="Avvisa i tuoi fornitori" disabled={!registered}>
          <p className="mb-2 text-[13.5px] text-[var(--f-muted)]">
            Non è obbligatorio se hai registrato il codice sul portale, ma aiuta: chiedi anche di scrivere sempre il numero del DDT in fattura.
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[14px] bg-[var(--f-fill)] p-3.5 font-sans text-[13px] text-[var(--f-ink-2)]">
            {supplierNoticeWhatsApp(notice)}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="f-btn f-btn-sm f-btn-primary" href={whatsappShareUrl(supplierNoticeWhatsApp(notice))} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" aria-hidden /> Invia su WhatsApp
            </a>
            <a className="f-btn f-btn-sm f-btn-soft" href={mailtoUrl(supplierNoticeEmailSubject(notice), supplierNoticeEmail(notice))}>
              <Mail className="h-4 w-4" aria-hidden /> Scrivi email
            </a>
            <button type="button" className="f-btn f-btn-sm f-btn-ghost" onClick={() => copy(supplierNoticeEmail(notice), "Testo")}>
              <Copy className="h-4 w-4" aria-hidden /> Copia testo
            </button>
          </div>
        </Section>
      )}

      <Section n={provider.configured ? 4 : 1} title={provider.configured ? "Importa lo storico (facoltativo)" : "Carica le fatture"}>
        <p className="mb-3 text-[13.5px] text-[var(--f-muted)]">
          Dal portale Fatture e Corrispettivi: Consultazione → Fatture elettroniche → <strong>Fatture ricevute</strong> → scegli gli ultimi 3
          mesi → <strong>Download massivo</strong>. Carica qui lo .zip così com&apos;è: storico prezzi e food cost partono subito.
        </p>
        <InvoiceUpload canWrite={canWrite} compact title="Trascina qui lo .zip delle fatture ricevute" />
      </Section>
    </div>
  );
}
