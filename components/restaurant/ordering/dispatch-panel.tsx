"use client";

// "Invia al fornitore": off-platform suppliers get the order in their preferred
// channel — WhatsApp deep link (pre-filled text), email with the PDF, or PDF.
// Every send is logged, and the user marks the supplier's confirmation.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Download, Mail, MessageCircle, Phone, Settings2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { StatusPill } from "@/components/fernly/primitives";
import { cn } from "@/lib/utils/formatters";
import { CHANNEL_LABELS, whatsappLink } from "@/lib/restaurants/channels/text";
import { confirmOrderDispatch, recordOrderDispatch, sendOrderByEmail } from "@/lib/restaurants/channels/actions";
import type { DispatchBlock } from "@/lib/restaurants/channels/server";
import { ContactModal, type ContactValue } from "./contact-modal";

const dtFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function DispatchPanel({
  orderId,
  blocks,
  canSend,
}: {
  orderId: string;
  blocks: DispatchBlock[];
  canSend: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [contact, setContact] = useState<ContactValue | null>(null);

  function log(blockIndex: number, channel: "whatsapp" | "pdf" | "phone") {
    startTransition(async () => {
      const res = await recordOrderDispatch({ orderId, blockIndex, channel });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function email(b: DispatchBlock) {
    startTransition(async () => {
      const ok = await confirm({
        title: `Inviare l'ordine a ${b.contact?.email}?`,
        description: "Riceverà il testo dell'ordine e il PDF in allegato; le risposte arrivano alla tua email.",
        confirmLabel: "Invia email",
      });
      if (!ok) return;
      const res = await sendOrderByEmail({ orderId, blockIndex: b.index, text: b.text });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Ordine inviato via email a ${b.supplierLabel}`);
      router.refresh();
    });
  }

  function confirmed(b: DispatchBlock) {
    startTransition(async () => {
      const res = await confirmOrderDispatch({ orderId, blockIndex: b.index });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`${b.supplierLabel}: ordine confermato`);
        router.refresh();
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text.replace(/\*/g, ""));
      toast.success("Testo dell'ordine copiato");
    } catch {
      toast.error("Copia non riuscita");
    }
  }

  return (
    <section className="f-card mb-4 p-5" aria-label="Invia l'ordine ai fornitori">
      <header className="mb-3">
        <h2 className="f-card-title">Invia ai fornitori</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--f-muted)]">
          Questi fornitori non sono su GastroBridge: invia l&apos;ordine già scritto nel loro canale e segna quando
          confermano.
        </p>
      </header>
      <ul className="divide-y divide-[var(--f-line)]">
        {blocks.map((b) => {
          const last = b.dispatches[0] ?? null;
          const isConfirmed = b.dispatches.some((d) => d.status === "confirmed");
          const pref = b.contact?.preferredChannel ?? null;
          const btn = (channel: string) => cn("f-btn f-btn-sm", pref === channel ? "f-btn-primary" : "f-btn-outline");
          return (
            <li key={b.index} className="py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--f-ink)]">{b.supplierLabel}</span>
                {isConfirmed ? (
                  <StatusPill tone="success">Confermato</StatusPill>
                ) : last ? (
                  <StatusPill tone="info">
                    Inviato via {CHANNEL_LABELS[last.channel]} · {dtFmt.format(new Date(last.sentAt))}
                  </StatusPill>
                ) : (
                  <StatusPill tone="warning">Da inviare</StatusPill>
                )}
              </div>
              {canSend && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={whatsappLink(b.contact?.whatsappPhone ?? null, b.text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btn("whatsapp")}
                    onClick={() => log(b.index, "whatsapp")}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                  {b.contact?.email ? (
                    <button type="button" className={btn("email")} onClick={() => email(b)} disabled={pending}>
                      <Mail className="h-3.5 w-3.5" /> Email + PDF
                    </button>
                  ) : null}
                  <a
                    href={`/api/ordini/${orderId}/catalog/${b.index}/pdf`}
                    className={btn("pdf")}
                    onClick={() => log(b.index, "pdf")}
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                  {pref === "phone" && (
                    <button type="button" className={btn("phone")} onClick={() => log(b.index, "phone")}>
                      <Phone className="h-3.5 w-3.5" /> Ordinato al telefono
                    </button>
                  )}
                  <button type="button" className="f-btn f-btn-sm f-btn-ghost" onClick={() => copy(b.text)}>
                    <Copy className="h-3.5 w-3.5" /> Copia testo
                  </button>
                  {!isConfirmed && (
                    <button
                      type="button"
                      className="f-btn f-btn-sm f-btn-soft"
                      onClick={() => confirmed(b)}
                      disabled={pending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Segna confermato
                    </button>
                  )}
                  {b.catalogId && (
                    <button
                      type="button"
                      className="f-btn f-btn-sm f-btn-ghost"
                      onClick={() =>
                        setContact({
                          catalogId: b.catalogId!,
                          supplierName: b.supplierLabel,
                          preferredChannel: b.contact?.preferredChannel ?? "whatsapp",
                          contactName: b.contact?.contactName ?? null,
                          whatsappPhone: b.contact?.whatsappPhone ?? null,
                          email: b.contact?.email ?? null,
                          notes: b.contact?.notes ?? null,
                        })
                      }
                    >
                      <Settings2 className="h-3.5 w-3.5" /> {b.contact ? "Contatto" : "Imposta contatto"}
                    </button>
                  )}
                </div>
              )}
              {b.contact?.notes && <p className="mt-1.5 text-[12px] text-[var(--f-muted)]">{b.contact.notes}</p>}
            </li>
          );
        })}
      </ul>
      <ContactModal value={contact} onClose={() => setContact(null)} />
      {dialog}
    </section>
  );
}
