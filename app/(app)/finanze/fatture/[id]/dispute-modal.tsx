"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { createDispute } from "@/lib/invoices/actions";
import { buildDisputeMessage, disputeSubject, requestedCreditCents } from "@/lib/invoices/dispute";
import type { InvoiceDetail } from "@/lib/invoices/server/queries";

const eur = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR" });

/**
 * One-click "Contesta": a polite Italian message asking for a nota di
 * credito, pre-written from the anomalies. Sent in the partnership chat when
 * the supplier is on GastroBridge, otherwise copied or opened as an email.
 * When the credit note (TD04) arrives, the dispute closes by itself.
 */
export function DisputeModal({
  open,
  onClose,
  detail,
  restaurantName,
}: {
  open: boolean;
  onClose: () => void;
  detail: InvoiceDetail;
  restaurantName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const candidates = useMemo(
    () => detail.findings.filter((f) => f.status === "open" && (f.recoverable || f.kind === "duplicate_invoice") && Number(f.impact_cents) > 0),
    [detail.findings],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.map((f) => f.id)));
  const picked = candidates.filter((f) => selected.has(f.id));
  const msgInput = {
      restaurantName,
      supplierName: detail.invoice.supplier_name ?? "fornitore",
      invoiceNumber: detail.invoice.document_number,
      invoiceDate: detail.invoice.document_date,
      findings: picked.map((f) => ({
        kind: f.kind,
        title: f.title,
        message: f.message,
        impactCents: Number(f.impact_cents),
        lineNumber: f.line_number,
      })),
  };
  const generated = buildDisputeMessage(msgInput);
  const [edited, setEdited] = useState<string | null>(null);
  const message = edited ?? generated;
  const total = requestedCreditCents(msgInput.findings);
  const chat = detail.supplier.chatAvailable;
  const email = detail.supplier.email;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setEdited(null);
  }

  function submit(channel: "chat" | "email" | "copy") {
    if (picked.length === 0) {
      toast.error("Seleziona almeno una differenza");
      return;
    }
    start(async () => {
      if (channel === "copy") {
        try {
          await navigator.clipboard.writeText(message);
        } catch {
          toast.error("Copia non riuscita: seleziona il testo e copialo a mano");
          return;
        }
      }
      const res = await createDispute({ invoiceId: detail.invoice.id, findingIds: picked.map((f) => f.id), message, channel });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (channel === "email") {
        const href = `mailto:${email ?? ""}?subject=${encodeURIComponent(disputeSubject(msgInput))}&body=${encodeURIComponent(message)}`;
        window.location.href = href;
      }
      toast.success(
        channel === "chat"
          ? "Contestazione inviata in chat al fornitore"
          : channel === "copy"
            ? "Testo copiato: incollalo dove scrivi al fornitore"
            : "Contestazione registrata: invia l'email che si è aperta",
      );
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Contesta la fattura"
      description={`Chiediamo a ${detail.invoice.supplier_name ?? "il fornitore"} una nota di credito di ${eur.format(total / 100)}. Quando arriva, la contestazione si chiude da sola.`}
      size="lg"
    >
      {candidates.length > 1 && (
        <fieldset className="mb-4">
          <legend className="f-label mb-2">Cosa contesti</legend>
          <ul className="space-y-1.5">
            {candidates.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-[var(--f-fill)] px-3 py-2 text-[13px]">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--acc-600)]" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                  <span className="min-w-0 flex-1 text-[var(--f-ink)]">{f.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--f-danger)]">{eur.format(Number(f.impact_cents) / 100)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <label className="f-label mb-1.5 block" htmlFor="dispute-msg">
        Messaggio (puoi modificarlo)
      </label>
      <textarea
        id="dispute-msg"
        className="f-input !h-64 resize-y !py-3 leading-relaxed"
        value={message}
        maxLength={4000}
        onChange={(e) => setEdited(e.target.value)}
      />

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" className="f-btn f-btn-ghost" onClick={onClose} disabled={pending}>
          Annulla
        </button>
        <button type="button" className="f-btn f-btn-soft" onClick={() => submit("copy")} disabled={pending}>
          <Copy className="h-4 w-4" aria-hidden /> Copia testo
        </button>
        {(email || !chat) && (
          <button type="button" className={chat ? "f-btn f-btn-soft" : "f-btn f-btn-primary"} onClick={() => submit("email")} disabled={pending}>
            <Mail className="h-4 w-4" aria-hidden /> {email ? "Invia per email" : "Apri email"}
          </button>
        )}
        {chat && (
          <button type="button" className="f-btn f-btn-primary" onClick={() => submit("chat")} disabled={pending}>
            <MessageCircle className="h-4 w-4" aria-hidden /> Invia in chat
          </button>
        )}
      </div>
      {!chat && (
        <p className="mt-3 text-[12.5px] text-[var(--f-muted)]">
          Il fornitore non è collegato su GastroBridge: copia il testo (WhatsApp, PEC…) o invialo per email. Registriamo comunque la
          contestazione.
        </p>
      )}
    </Modal>
  );
}
