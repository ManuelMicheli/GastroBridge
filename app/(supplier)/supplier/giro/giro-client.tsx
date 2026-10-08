"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Map as MapIcon,
  Navigation,
  Phone,
  Save,
  Sparkles,
  Truck,
} from "lucide-react";
import { CardEmpty, FCard, StatusPill, type FTone } from "@/components/fernly/primitives";
import { Modal, ModalActions } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils/formatters";
import type { GiroData, GiroStop } from "@/lib/supplier/route/queries";
import { googleMapsNavUrl, googleMapsRouteLegs, routeKm, wazeNavUrl } from "@/lib/supplier/route/plan";
import { notifyArrival, saveRouteOrder } from "@/lib/supplier/route/actions";

const STATUS: Record<string, { label: string; tone: FTone }> = {
  planned: { label: "Da caricare", tone: "neutral" },
  loaded: { label: "Caricata", tone: "info" },
  in_transit: { label: "In viaggio", tone: "accent" },
  delivered: { label: "Consegnata", tone: "success" },
  failed: { label: "Fallita", tone: "danger" },
};

const ETA_CHOICES = [10, 15, 20, 30, 45, 60];

export function GiroClient({
  giro,
  canReorder,
  isDriver,
}: {
  giro: GiroData;
  canReorder: boolean;
  isDriver: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<string[]>(() => giro.stops.map((s) => s.id));
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [etaStop, setEtaStop] = useState<GiroStop | null>(null);
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [sendingEta, startEta] = useTransition();

  const byId = useMemo(() => new Map(giro.stops.map((s) => [s.id, s])), [giro.stops]);
  const stops = order.map((id) => byId.get(id)).filter((s): s is GiroStop => !!s);
  const open = stops.filter((s) => s.status !== "delivered" && s.status !== "failed");
  const km = routeKm(stops, giro.origin);
  const legs = googleMapsRouteLegs(open, giro.originQuery);
  const isSuggested = order.join(",") === giro.suggestedIds.join(",");

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });
    setDirty(true);
  }

  function optimise() {
    setOrder(giro.suggestedIds);
    setDirty(true);
    toast.success("Ordine ottimizzato per distanza");
  }

  function save() {
    startSaving(async () => {
      const res = await saveRouteOrder({ date: giro.date, deliveryIds: order });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDirty(false);
      toast.success("Ordine del giro salvato");
      router.refresh();
    });
  }

  function sendEta() {
    if (!etaStop) return;
    const stop = etaStop;
    startEta(async () => {
      const res = await notifyArrival({ deliveryId: stop.deliveryId, minutes: etaMinutes });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${stop.name} avvisato: arrivo tra ${etaMinutes} min`);
      setEtaStop(null);
    });
  }

  if (giro.stops.length === 0) {
    return (
      <FCard index={0}>
        <CardEmpty>
          Nessuna consegna per questa data.
          {giro.stillPreparing > 0 && (
            <>
              <br />
              {giro.stillPreparing} ordini con consegna prevista sono ancora in preparazione: le fermate compaiono
              quando vengono imballati.
            </>
          )}
        </CardEmpty>
      </FCard>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <FCard index={0}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-medium tabular-nums text-[var(--f-ink)]">{open.length}</span>
            <span className="text-[13px] text-[var(--f-muted)]">fermate da fare su {stops.length}</span>
          </div>
          {km > 0 && (
            <div className="text-[13px] text-[var(--f-muted)] tabular-nums">
              ≈ {km} km in linea d&apos;aria
              {!isSuggested && giro.suggestedKm > 0 && giro.suggestedKm < km
                ? ` · ottimizzato: ${giro.suggestedKm} km`
                : ""}
            </div>
          )}
          {giro.stillPreparing > 0 && (
            <StatusPill tone="warning">{giro.stillPreparing} ordini ancora in preparazione</StatusPill>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {canReorder && !isSuggested && (
              <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={optimise}>
                <Sparkles className="h-4 w-4" aria-hidden /> Ottimizza ordine
              </button>
            )}
            {canReorder && (dirty || !giro.savedOrder) && giro.canSaveOrder && (
              <button type="button" className="f-btn f-btn-primary f-btn-sm" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" aria-hidden /> {saving ? "Salvo…" : "Salva ordine"}
              </button>
            )}
            {legs.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="f-btn f-btn-soft f-btn-sm"
              >
                <MapIcon className="h-4 w-4" aria-hidden />
                {legs.length > 1 ? `Giro in Maps (${i + 1}/${legs.length})` : "Apri giro in Google Maps"}
              </a>
            ))}
          </div>
        </div>
        {!giro.canSaveOrder && canReorder && (
          <p className="mt-3 text-[12px] text-[var(--f-muted)]">
            L&apos;ordine delle fermate non si può ancora salvare (migrazione database in attesa): resta valido
            l&apos;ordine suggerito.
          </p>
        )}
        {!giro.origin && (
          <p className="mt-3 text-[12px] text-[var(--f-muted)]">
            Aggiungi le coordinate della sede di partenza in Impostazioni › Sedi per un ordine ottimizzato dal
            magazzino.
          </p>
        )}
      </FCard>

      <ol className="flex flex-col gap-3">
        {stops.map((s, idx) => {
          const st = STATUS[s.status] ?? { label: s.status, tone: "neutral" as FTone };
          const closed = s.status === "delivered" || s.status === "failed";
          const addr = [s.address, [s.zip, s.city].filter(Boolean).join(" "), s.province ? `(${s.province})` : null]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={s.id} className={`f-card px-4 py-4 sm:px-5 ${closed ? "opacity-70" : ""}`}>
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${
                    closed ? "bg-[var(--f-fill-2)] text-[var(--f-muted)]" : "bg-[var(--acc-800)] text-white"
                  }`}
                  aria-label={`Fermata ${idx + 1}`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[16px] font-medium text-[var(--f-ink)]">{s.name}</p>
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  </div>
                  <p className="mt-0.5 text-[13px] text-[var(--f-ink-2)]">{addr || "Indirizzo non indicato"}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--f-muted)]">
                    {[
                      s.zone ? `Zona ${s.zone}` : null,
                      s.slotStart ? `Fascia ${s.slotStart}${s.slotEnd ? `–${s.slotEnd}` : ""}` : s.slotLabel,
                      isDriver ? null : formatCurrency(s.subtotal),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {s.notes && <p className="mt-1 text-[12px] italic text-[var(--f-muted)]">Note: {s.notes}</p>}
                  {s.failureReason && (
                    <p className="mt-1 text-[12px] text-[var(--f-danger)]">Motivo: {s.failureReason}</p>
                  )}
                </div>
                {canReorder && (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="f-icon-btn h-8 w-8"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Sposta su"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="f-icon-btn h-8 w-8"
                      onClick={() => move(idx, 1)}
                      disabled={idx === stops.length - 1}
                      aria-label="Sposta giù"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <a
                  href={googleMapsNavUrl(s)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="f-btn f-btn-primary f-btn-sm"
                >
                  <Navigation className="h-4 w-4" aria-hidden /> Naviga
                </a>
                <a href={wazeNavUrl(s)} target="_blank" rel="noopener noreferrer" className="f-btn f-btn-outline f-btn-sm">
                  Waze
                </a>
                {s.phone && (
                  <a href={`tel:${s.phone.replace(/\s+/g, "")}`} className="f-btn f-btn-outline f-btn-sm">
                    <Phone className="h-4 w-4" aria-hidden /> Chiama
                  </a>
                )}
                {!closed && (
                  <button
                    type="button"
                    className="f-btn f-btn-soft f-btn-sm"
                    onClick={() => {
                      setEtaMinutes(15);
                      setEtaStop(s);
                    }}
                  >
                    <BellRing className="h-4 w-4" aria-hidden /> Avvisa arrivo
                  </button>
                )}
                <Link href={`/supplier/consegne/${s.deliveryId}`} className="f-btn f-btn-ghost f-btn-sm">
                  <Truck className="h-4 w-4" aria-hidden /> {closed ? "Dettaglio" : "Consegna / firma"}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      <Modal
        isOpen={etaStop !== null}
        onClose={() => setEtaStop(null)}
        title="Avvisa il cliente"
        description={etaStop ? `${etaStop.name} riceverà un messaggio e una notifica.` : undefined}
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Minuti all'arrivo">
          {ETA_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={etaMinutes === m}
              onClick={() => setEtaMinutes(m)}
              className={`f-btn f-btn-sm ${etaMinutes === m ? "f-btn-primary" : "f-btn-outline"}`}
            >
              {m} min
            </button>
          ))}
        </div>
        <ModalActions>
          <button type="button" className="f-btn f-btn-outline" onClick={() => setEtaStop(null)}>
            Annulla
          </button>
          <button type="button" className="f-btn f-btn-primary" onClick={sendEta} disabled={sendingEta}>
            {sendingEta ? "Invio…" : "Invia avviso"}
          </button>
        </ModalActions>
      </Modal>
    </div>
  );
}
