"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, Gavel, Link2, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { Chips } from "@/components/fernly/chips";
import { CardEmpty, FCard, StatusPill, type FTone } from "@/components/fernly/primitives";
import { Modal, ModalActions } from "@/components/ui/modal";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  deleteInvoice,
  linkInvoiceSupplier,
  reopenInvoice,
  reprocessInvoiceAction,
  resolveInvoice,
  setFindingStatus,
  setPaymentPaid,
} from "@/lib/invoices/actions";
import { CREDIT_NOTE_TYPES, documentTypeLabel, paymentMethodLabel } from "@/lib/invoices/fatturapa";
import { FINDING_KIND_LABELS, STATUS_LABELS, STATUS_TONES } from "@/lib/invoices/status";
import type { InvoiceDetail } from "@/lib/invoices/server/queries";
import { DisputeModal } from "./dispute-modal";
import { LinesCompare } from "./lines-compare";

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });
const dt = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)) : "—");
const SEVERITY_TONE: Record<string, FTone> = { high: "danger", medium: "warning", low: "neutral" };
const CHANNEL_LABEL: Record<string, string> = { chat: "in chat", email: "per email", copy: "con testo copiato" };
const METHOD_LABEL: Record<string, string> = {
  ddt: "numero DDT",
  date_window: "date e prodotti",
  price_list: "listino / catalogo",
  manual: "collegamento manuale",
  none: "nessun ordine",
};

type LinkOptions = { suppliers: Array<{ id: string; name: string }>; catalogs: Array<{ id: string; name: string }> } | null;

export function InvoiceDetailClient({
  detail,
  canWrite,
  restaurantName,
  linkOptions,
}: {
  detail: InvoiceDetail;
  canWrite: boolean;
  restaurantName: string;
  linkOptions: LinkOptions;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [onlyDiffs, setOnlyDiffs] = useState<"diff" | "all">(detail.invoice.status === "anomalie" ? "diff" : "all");
  const inv = detail.invoice;
  const credit = CREDIT_NOTE_TYPES.has(inv.document_type);
  const open = detail.findings.filter((f) => f.status === "open");
  const contestable = open.filter((f) => (f.recoverable || f.kind === "duplicate_invoice") && Number(f.impact_cents) > 0);
  const contestableCents = contestable.reduce((s, f) => s + Number(f.impact_cents), 0);
  const openDisputes = detail.disputes.filter((d) => !d.resolved_at);
  const parsed = inv.parsed as {
    ddt?: Array<{ number: string; date: string | null }>;
    causale?: string[];
    warnings?: string[];
    supplier?: { address?: { city?: string | null } | null };
  };

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success?: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else {
        if (success) toast.success(success);
        router.refresh();
      }
    });
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Eliminare la fattura?",
      description: "Rimuoviamo il file importato e i controlli fatti. Puoi ricaricarla quando vuoi.",
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteInvoice(inv.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Fattura eliminata");
        router.push("/finanze/fatture");
      }
    });
  }

  return (
    <div className="px-1 lg:px-0">
      {dialog}
      <div className="mb-4 flex items-center gap-2">
        <Link href="/finanze/fatture" className="f-icon-btn !h-9 !w-9" aria-label="Torna alle fatture">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-[13px] text-[var(--f-muted)]">Fatture fornitori</span>
      </div>

      {/* Header */}
      <FCard index={0} className="mb-3 lg:mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--f-ink)] sm:text-[26px]">
                {inv.supplier_name ?? "Fornitore sconosciuto"}
              </h1>
              <StatusPill tone={STATUS_TONES[inv.status] as FTone} dot>
                {STATUS_LABELS[inv.status]}
              </StatusPill>
            </div>
            <p className="mt-1 text-[13.5px] text-[var(--f-muted)]">
              {credit ? "Nota di credito" : documentTypeLabel(inv.document_type)} n. <strong className="text-[var(--f-ink-2)]">{inv.document_number}</strong> del{" "}
              {dt(inv.document_date)}
              {inv.supplier_vat ? ` · P.IVA ${inv.supplier_vat}` : ""}
              {inv.received_via !== "upload" ? " · ricevuta dallo SDI" : " · caricata a mano"}
            </p>
            {detail.creditNoteOf && (
              <p className="mt-1 text-[13px]">
                Rettifica la{" "}
                <Link className="text-[var(--acc-ink)] underline-offset-2 hover:underline" href={`/finanze/fatture/${detail.creditNoteOf.id}`}>
                  fattura n. {detail.creditNoteOf.document_number}
                </Link>
              </p>
            )}
          </div>
          <dl className="grid shrink-0 grid-cols-3 gap-4 text-right">
            <div>
              <dt className="text-[12px] text-[var(--f-muted)]">Imponibile</dt>
              <dd className="text-[15px] font-medium tabular-nums">{eur.format(Number(inv.taxable_amount))}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--f-muted)]">IVA</dt>
              <dd className="text-[15px] font-medium tabular-nums">{eur.format(Number(inv.vat_amount))}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--f-muted)]">Totale</dt>
              <dd className="text-[18px] font-semibold tabular-nums">{eur.format(Number(inv.total_amount))}</dd>
            </div>
          </dl>
        </div>
      </FCard>

      {/* Outcome banner */}
      {inv.status === "anomalie" && contestableCents > 0 && (
        <section className="f-card f-hero mb-3 flex flex-col gap-3 p-5 text-white sm:flex-row sm:items-center lg:mb-4" aria-label="Differenze trovate">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-white/80">Abbiamo trovato differenze per</p>
            <p className="text-[34px] font-semibold leading-tight tabular-nums">{eur.format(contestableCents / 100)}</p>
            <p className="text-[13px] text-white/75">
              {contestable.length === 1 ? "1 differenza" : `${contestable.length} differenze`} rispetto a ordine e merce ricevuta.
            </p>
          </div>
          {canWrite && (
            <button type="button" className="f-btn f-btn-white f-btn-lg" onClick={() => setDisputeOpen(true)} disabled={pending}>
              <Gavel className="h-4 w-4" aria-hidden /> Contesta
            </button>
          )}
        </section>
      )}
      {inv.status === "contestata" && (
        <FCard index={1} className="mb-3 lg:mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <CircleAlert className="h-6 w-6 shrink-0 text-[var(--f-warning)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--f-ink)]">
                Contestata: in attesa della nota di credito di {eur.format(Number(inv.disputed_cents) / 100)}
              </p>
              <p className="text-[13px] text-[var(--f-muted)]">
                Quando il fornitore emette la nota di credito (TD04) la colleghiamo e chiudiamo la contestazione da soli.
              </p>
            </div>
            {canWrite && (
              <button type="button" className="f-btn f-btn-sm f-btn-soft shrink-0" onClick={() => setResolveOpen(true)} disabled={pending}>
                Risolta in altro modo
              </button>
            )}
          </div>
        </FCard>
      )}
      {inv.status === "risolta" && (
        <FCard index={1} className="mb-3 lg:mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-[var(--f-success)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--f-ink)]">
                {Number(inv.recovered_cents) > 0 ? `Recuperati ${eur.format(Number(inv.recovered_cents) / 100)}` : "Risolta"}
              </p>
              {detail.creditNotes.length > 0 && (
                <p className="text-[13px] text-[var(--f-muted)]">
                  Con{" "}
                  {detail.creditNotes.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 ? ", " : ""}
                      <Link className="text-[var(--acc-ink)] hover:underline" href={`/finanze/fatture/${c.id}`}>
                        nota di credito n. {c.document_number}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
            {canWrite && (
              <button
                type="button"
                className="f-btn f-btn-sm f-btn-ghost shrink-0"
                onClick={() => run(() => reopenInvoice(inv.id), "Fattura riaperta")}
                disabled={pending}
              >
                <Undo2 className="h-4 w-4" aria-hidden /> Riapri
              </button>
            )}
          </div>
        </FCard>
      )}
      {inv.status === "ok" && !credit && (
        <FCard index={1} className="mb-3 lg:mb-4">
          <p className="flex items-center gap-2 text-[14px] text-[var(--f-ink)]">
            <CheckCircle2 className="h-5 w-5 text-[var(--f-success)]" aria-hidden /> Tutto in ordine: prezzi e quantità corrispondono.
          </p>
        </FCard>
      )}

      {/* Unknown supplier */}
      {linkOptions && <LinkSupplier invoiceId={inv.id} options={linkOptions} />}

      <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          {detail.findings.length > 0 && (
            <FCard index={2} title="Cosa abbiamo controllato">
              <ul className="space-y-2">
                {detail.findings.map((f) => (
                  <li
                    key={f.id}
                    className={`rounded-[14px] border px-3.5 py-3 ${f.status === "dismissed" || f.status === "resolved" ? "border-[var(--f-line)] opacity-70" : "border-[var(--f-line-strong)]"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={SEVERITY_TONE[f.severity] ?? "neutral"}>{FINDING_KIND_LABELS[f.kind] ?? f.kind}</StatusPill>
                      {f.status !== "open" && (
                        <span className="text-[12px] text-[var(--f-muted)]">
                          {f.status === "disputed" ? "Contestata" : f.status === "resolved" ? "Risolta" : "Ignorata"}
                        </span>
                      )}
                      {Number(f.impact_cents) > 0 && (
                        <span className={`ml-auto text-[14px] font-semibold tabular-nums ${f.recoverable ? "text-[var(--f-danger)]" : "text-[var(--f-muted)]"}`}>
                          {eur.format(Number(f.impact_cents) / 100)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13.5px] font-medium text-[var(--f-ink)]">{f.title}</p>
                    <p className="text-[13px] text-[var(--f-muted)]">{f.message}</p>
                    {canWrite && (f.status === "open" || f.status === "dismissed") && (
                      <button
                        type="button"
                        className="mt-1.5 text-[12.5px] font-medium text-[var(--acc-ink)] hover:underline"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => setFindingStatus(f.id, f.status === "open" ? "dismissed" : "open"),
                            f.status === "open" ? "Segnalazione ignorata" : "Segnalazione ripristinata",
                          )
                        }
                      >
                        {f.status === "open" ? "Va bene così, ignora" : "Ripristina"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </FCard>
          )}

          <FCard
            index={3}
            title="Ordine ↔ DDT ↔ fattura"
            action={
              detail.findings.some((f) => f.line_number !== null) ? (
                <Chips
                  size="sm"
                  value={onlyDiffs}
                  onChange={setOnlyDiffs}
                  options={[
                    { value: "diff", label: "Differenze" },
                    { value: "all", label: "Tutte le righe" },
                  ]}
                  ariaLabel="Righe da mostrare"
                />
              ) : null
            }
          >
            {detail.lines.length === 0 ? (
              <CardEmpty>La fattura non ha righe di dettaglio.</CardEmpty>
            ) : (
              <LinesCompare detail={detail} onlyDiffs={onlyDiffs === "diff"} />
            )}
          </FCard>

          {detail.disputes.length > 0 && (
            <FCard index={4} title="Contestazioni">
              <ul className="space-y-3">
                {detail.disputes.map((d) => (
                  <li key={d.id} className="rounded-[14px] bg-[var(--f-fill)] p-3.5 text-[13px]">
                    <p className="font-medium text-[var(--f-ink)]">
                      Inviata {CHANNEL_LABEL[d.channel] ?? ""} il {dt(d.created_at)} · {eur.format(Number(d.requested_cents) / 100)} richiesti
                    </p>
                    <p className="text-[var(--f-muted)]">
                      {d.resolved_at
                        ? `${d.resolution === "credit_note" ? "Chiusa con nota di credito" : d.resolution === "waived" ? "Chiusa senza rimborso" : "Chiusa a mano"} il ${dt(d.resolved_at)} · ${eur.format(Number(d.recovered_cents) / 100)} recuperati`
                        : "In attesa della nota di credito"}
                    </p>
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[12.5px] text-[var(--acc-ink)]">Vedi il messaggio</summary>
                      <p className="mt-1.5 whitespace-pre-wrap text-[var(--f-ink-2)]">{d.message}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </FCard>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-3 lg:gap-4">
          {!credit && (
            <FCard index={5} title="Pagamento">
              {detail.payments.length === 0 ? (
                <p className="text-[13px] text-[var(--f-muted)]">Nessuna scadenza indicata in fattura.</p>
              ) : (
                <ul className="divide-y divide-[var(--f-line)]">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--f-ink)]">
                          {p.due_date ? `Entro il ${dt(p.due_date)}` : "Senza data"} · {p.amount !== null ? eur.format(Number(p.amount)) : "—"}
                        </p>
                        <p className="truncate text-[12px] text-[var(--f-muted)]">
                          {paymentMethodLabel(p.method)}
                          {p.iban ? ` · ${p.iban}` : ""}
                        </p>
                      </div>
                      {p.paid_at ? (
                        <button
                          type="button"
                          className="text-[12.5px] text-[var(--f-success)] hover:underline disabled:opacity-60"
                          disabled={!canWrite || pending}
                          onClick={() => run(() => setPaymentPaid(p.id, false))}
                          title={canWrite ? "Segna come da pagare" : undefined}
                        >
                          Pagata ✓
                        </button>
                      ) : canWrite ? (
                        <button type="button" className="f-btn f-btn-xs f-btn-soft" disabled={pending} onClick={() => run(() => setPaymentPaid(p.id, true), "Segnata come pagata")}>
                          Segna pagata
                        </button>
                      ) : (
                        <StatusPill tone="warning">Da pagare</StatusPill>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </FCard>
          )}

          <FCard index={6} title="Collegamenti">
            <dl className="space-y-2.5 text-[13px]">
              <div>
                <dt className="text-[var(--f-muted)]">Abbinata tramite</dt>
                <dd className="text-[var(--f-ink)]">
                  {METHOD_LABEL[inv.match_method ?? "none"] ?? "—"}
                  {inv.match_confidence !== null && inv.match_method !== "none" ? ` · affidabilità ${Math.round(Number(inv.match_confidence) * 100)}%` : ""}
                </dd>
              </div>
              {detail.orders.length > 0 && (
                <div>
                  <dt className="text-[var(--f-muted)]">Ordini</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {detail.orders.map((o) => (
                      <Link key={o.id} href={`/ordini/${o.id}`} className="f-tag bg-[var(--f-fill)] text-[var(--f-ink-2)] hover:bg-[var(--f-fill-2)]">
                        Ordine del {dt(o.created_at)}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
              {parsed.ddt && parsed.ddt.length > 0 && (
                <div>
                  <dt className="text-[var(--f-muted)]">DDT in fattura</dt>
                  <dd className="text-[var(--f-ink)]">{parsed.ddt.map((d) => `n. ${d.number}${d.date ? ` del ${dt(d.date)}` : ""}`).join(", ")}</dd>
                </div>
              )}
              {parsed.causale && parsed.causale.length > 0 && (
                <div>
                  <dt className="text-[var(--f-muted)]">Causale</dt>
                  <dd className="text-[var(--f-ink)]">{parsed.causale.join(" ")}</dd>
                </div>
              )}
            </dl>
            {parsed.warnings && parsed.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-[12px] text-[var(--f-muted)]">
                {parsed.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}
          </FCard>

          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="f-btn f-btn-sm f-btn-soft"
                disabled={pending}
                onClick={() => run(() => reprocessInvoiceAction(inv.id), "Controlli rifatti con i dati aggiornati")}
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Ricontrolla
              </button>
              <button type="button" className="f-btn f-btn-sm f-btn-ghost text-[var(--f-danger)]" disabled={pending} onClick={onDelete}>
                <Trash2 className="h-4 w-4" aria-hidden /> Elimina
              </button>
            </div>
          )}
        </aside>
      </div>

      {disputeOpen && <DisputeModal open={disputeOpen} onClose={() => setDisputeOpen(false)} detail={detail} restaurantName={restaurantName} />}
      {resolveOpen && (
        <ResolveModal
          invoiceId={inv.id}
          requestedCents={openDisputes.reduce((s, d) => s + Number(d.requested_cents), 0)}
          onClose={() => setResolveOpen(false)}
        />
      )}
    </div>
  );
}

function ResolveModal({ invoiceId, requestedCents, onClose }: { invoiceId: string; requestedCents: number; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState((requestedCents / 100).toFixed(2).replace(".", ","));
  function submit(resolution: "manual" | "waived") {
    const value = resolution === "waived" ? 0 : Number(amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Importo non valido");
      return;
    }
    start(async () => {
      const res = await resolveInvoice({ invoiceId, recoveredEuro: value, resolution });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(resolution === "waived" ? "Contestazione chiusa" : "Segnata come risolta");
        onClose();
        router.refresh();
      }
    });
  }
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Chiudi la contestazione"
      description="Usalo se il fornitore ha rimborsato in altro modo (sconto sulla prossima fattura, bonifico, merce in omaggio)."
      size="sm"
    >
      <label className="f-label mb-1.5 block" htmlFor="recovered">
        Quanto hai recuperato (€)
      </label>
      <input id="recovered" className="f-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <ModalActions>
        <button type="button" className="f-btn f-btn-ghost" onClick={() => submit("waived")} disabled={pending}>
          Rinuncio
        </button>
        <button type="button" className="f-btn f-btn-primary" onClick={() => submit("manual")} disabled={pending}>
          Segna risolta
        </button>
      </ModalActions>
    </Modal>
  );
}

function LinkSupplier({ invoiceId, options }: { invoiceId: string; options: NonNullable<LinkOptions> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  if (options.suppliers.length === 0 && options.catalogs.length === 0) return null;
  function save() {
    const [kind, id] = value.split(":");
    if (!id) return;
    start(async () => {
      const res = await linkInvoiceSupplier({
        invoiceId,
        supplierId: kind === "s" ? id : null,
        catalogId: kind === "c" ? id : null,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Fornitore collegato: abbiamo ricontrollato le sue fatture");
        router.refresh();
      }
    });
  }
  return (
    <FCard className="mb-3 lg:mb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--f-ink)]">
            <Link2 className="h-4 w-4 text-[var(--acc-600)]" aria-hidden /> Di quale fornitore è questa fattura?
          </p>
          <p className="mb-2 text-[13px] text-[var(--f-muted)]">
            Collegala una volta: le prossime fatture con questa Partita IVA verranno abbinate da sole.
          </p>
          <select className="f-input" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Fornitore">
            <option value="">Scegli…</option>
            {options.suppliers.length > 0 && (
              <optgroup label="Fornitori su GastroBridge">
                {options.suppliers.map((s) => (
                  <option key={s.id} value={`s:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {options.catalogs.length > 0 && (
              <optgroup label="I tuoi cataloghi">
                {options.catalogs.map((c) => (
                  <option key={c.id} value={`c:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <button type="button" className="f-btn f-btn-primary shrink-0" disabled={!value || pending} onClick={save}>
          Collega
        </button>
      </div>
    </FCard>
  );
}
