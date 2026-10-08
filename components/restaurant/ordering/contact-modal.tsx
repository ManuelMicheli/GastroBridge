"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalActions } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/formatters";
import { saveCatalogContact } from "@/lib/restaurants/channels/actions";
import { CHANNEL_LABELS, type OrderChannel } from "@/lib/restaurants/channels/text";

export type ContactValue = {
  catalogId: string;
  supplierName: string;
  preferredChannel: OrderChannel;
  contactName: string | null;
  whatsappPhone: string | null;
  email: string | null;
  notes: string | null;
};

const CHANNELS: OrderChannel[] = ["whatsapp", "email", "pdf", "phone"];

/** Preferred order channel + contact of an off-platform supplier. */
export function ContactModal({ value, onClose }: { value: ContactValue | null; onClose: () => void }) {
  return (
    <Modal
      isOpen={value !== null}
      onClose={onClose}
      title={value ? `Come ordinare · ${value.supplierName}` : ""}
      description="Canale preferito e contatto del fornitore: l'ordine parte già scritto."
      size="sm"
    >
      {value && <ContactForm key={value.catalogId} value={value} onDone={onClose} />}
    </Modal>
  );
}

function ContactForm({ value, onDone }: { value: ContactValue; onDone: () => void }) {
  const router = useRouter();
  const [channel, setChannel] = useState<OrderChannel>(value.preferredChannel);
  const [name, setName] = useState(value.contactName ?? "");
  const [phone, setPhone] = useState(value.whatsappPhone ? `+${value.whatsappPhone}` : "");
  const [email, setEmail] = useState(value.email ?? "");
  const [notes, setNotes] = useState(value.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveCatalogContact({
        catalogId: value.catalogId,
        preferredChannel: channel,
        contactName: name.trim() || null,
        whatsappPhone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contatto salvato");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="f-label mb-2">Canale preferito</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              aria-pressed={channel === c}
              className={cn(
                "h-11 rounded-[12px] text-[13.5px] font-medium transition-colors",
                channel === c ? "bg-[var(--acc-800)] text-white" : "bg-[var(--f-fill)] text-[var(--f-ink-2)] hover:bg-[var(--f-fill-2)]",
              )}
            >
              {CHANNEL_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="f-label mb-1.5 block">Referente (opzionale)</span>
        <input className="f-input h-11 w-full px-3" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Es. Marco" />
      </label>
      <label className="block">
        <span className="f-label mb-1.5 block">Cellulare WhatsApp</span>
        <input
          className="f-input h-11 w-full px-3"
          inputMode="tel"
          value={phone}
          maxLength={30}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+39 333 1234567"
        />
      </label>
      <label className="block">
        <span className="f-label mb-1.5 block">Email ordini</span>
        <input
          className="f-input h-11 w-full px-3"
          type="email"
          inputMode="email"
          value={email}
          maxLength={200}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ordini@fornitore.it"
        />
      </label>
      <label className="block">
        <span className="f-label mb-1.5 block">Note (opzionale)</span>
        <input
          className="f-input h-11 w-full px-3"
          value={notes}
          maxLength={300}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Es. chiamare dopo le 15"
        />
      </label>
      <ModalActions>
        <button type="button" className="f-btn f-btn-outline" onClick={onDone}>
          Annulla
        </button>
        <button type="button" className="f-btn f-btn-primary" onClick={save} disabled={pending}>
          Salva
        </button>
      </ModalActions>
    </div>
  );
}
