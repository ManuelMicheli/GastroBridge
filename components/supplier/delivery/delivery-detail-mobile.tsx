"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ExpiryBadge } from "@/components/supplier/inventory/expiry-badge";
import { SignatureCanvas } from "./signature-canvas";
import { PodPhotoCapture } from "./pod-photo-capture";
import {
  MapPin,
  Clock,
  Phone,
  ExternalLink,
  Truck,
  CheckCircle2,
  XCircle,
  Play,
  PenLine,
} from "lucide-react";
import type { DeliveryStatus } from "@/types/database";

export type DeliveryItemRow = {
  id: string;
  quantity_base: number;
  quantity_sales_unit: number;
  product_name: string;
  product_code: string | null;
  sales_unit_label: string | null;
  base_unit_label: string | null;
  lot_code: string | null;
  expiry_date: string | null;
};

export type DeliveryDetail = {
  id: string;
  status: DeliveryStatus;
  scheduled_date: string;
  scheduled_slot: {
    label?: string | null;
    start?: string | null;
    end?: string | null;
  } | null;
  delivered_at: string | null;
  failure_reason: string | null;
  notes: string | null;
  recipient_signature_url: string | null;
  pod_photo_url: string | null;
  order_split_id: string;
  driver_member_id: string | null;
  zone_name: string | null;
  restaurant: {
    name: string;
    address: string | null;
    city: string | null;
    province: string | null;
    zip_code: string | null;
    phone: string | null;
  } | null;
  items: DeliveryItemRow[];
};

export type DeliveryActions = {
  startTransit: (
    id: string,
  ) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
  markDelivered: (input: {
    delivery_id: string;
    signature_data_url: string;
    pod_photo_url?: string | null;
    notes?: string | null;
  }) => Promise<
    | { ok: true; data: { signature_url: string; pod_photo_url: string | null } }
    | { ok: false; error: string }
  >;
  markFailed: (input: {
    deliveryId: string;
    reason: string;
  }) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
  uploadPod: (input: {
    delivery_id: string;
    bytes_base64: string;
    mime_type: "image/png" | "image/jpeg" | "image/webp";
  }) => Promise<
    | { ok: true; data: { path: string } }
    | { ok: false; error: string }
  >;
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  planned: "Pianificata",
  loaded: "Caricata",
  in_transit: "In transito",
  delivered: "Consegnata",
  failed: "Fallita",
};

const STATUS_VARIANT: Record<DeliveryStatus, BadgeVariant> = {
  planned: "outline",
  loaded: "info",
  in_transit: "warning",
  delivered: "success",
  failed: "warning",
};

const TIMELINE: DeliveryStatus[] = [
  "planned",
  "loaded",
  "in_transit",
  "delivered",
];

function slotLabel(slot: DeliveryDetail["scheduled_slot"]): string {
  if (!slot) return "Slot non definito";
  if (slot.label) return slot.label;
  if (slot.start && slot.end) return `${slot.start} – ${slot.end}`;
  if (slot.start) return slot.start;
  return "Slot non definito";
}

function buildMapsUrl(r: DeliveryDetail["restaurant"]): string | null {
  if (!r) return null;
  const parts = [r.name, r.address, r.zip_code, r.city, r.province]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(", ");
  if (!parts) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

function Timeline({ status }: { status: DeliveryStatus }) {
  const isFailed = status === "failed";
  const reachedIdx = isFailed
    ? TIMELINE.indexOf("in_transit")
    : TIMELINE.indexOf(status);

  return (
    <div className="flex items-center gap-2" aria-label="Stato consegna">
      {TIMELINE.map((s, i) => {
        const done = i <= reachedIdx && !isFailed;
        const active = i === reachedIdx && !isFailed;
        return (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                (done
                  ? "bg-forest text-white"
                  : active
                    ? "bg-forest-light text-forest-dark ring-2 ring-forest"
                    : "bg-sage-muted/40 text-sage")
              }
            >
              {i + 1}
            </div>
            {i < TIMELINE.length - 1 && (
              <div
                className={
                  "h-0.5 flex-1 " +
                  (i < reachedIdx && !isFailed ? "bg-forest" : "bg-sage-muted/40")
                }
              />
            )}
          </div>
        );
      })}
      {isFailed && (
        <Badge variant="warning" className="ml-2">
          Fallita
        </Badge>
      )}
    </div>
  );
}

export function DeliveryDetailMobile({
  delivery,
  actions,
}: {
  delivery: DeliveryDetail;
  actions: DeliveryActions;
}) {
  const [current, setCurrent] = useState(delivery);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigConfirming, setSigConfirming] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);
  const [failedReason, setFailedReason] = useState("");
  const [podPath, setPodPath] = useState<string | null>(
    delivery.pod_photo_url,
  );
  const [pending, startTransition] = useTransition();

  const mapsUrl = buildMapsUrl(current.restaurant);
  const addressLine = current.restaurant
    ? [
        current.restaurant.address,
        current.restaurant.zip_code,
        current.restaurant.city,
        current.restaurant.province,
      ]
        .filter((p): p is string => Boolean(p && p.trim()))
        .join(", ")
    : "";

  const canStart =
    current.status === "planned" || current.status === "loaded";
  const canDeliver = current.status === "in_transit";
  const canFail = canStart || canDeliver;
  const closed = current.status === "delivered" || current.status === "failed";

  function handleStart() {
    startTransition(async () => {
      const res = await actions.startTransit(current.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCurrent({ ...current, status: "in_transit" });
      toast.success("Consegna in transito");
    });
  }

  async function handleConfirmSignature(dataUrl: string) {
    setSigConfirming(true);
    try {
      const res = await actions.markDelivered({
        delivery_id: current.id,
        signature_data_url: dataUrl,
        pod_photo_url: podPath,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCurrent({
        ...current,
        status: "delivered",
        recipient_signature_url: res.data.signature_url,
        pod_photo_url: res.data.pod_photo_url,
        delivered_at: new Date().toISOString(),
      });
      setSigOpen(false);
      toast.success("Consegna registrata");
    } finally {
      setSigConfirming(false);
    }
  }

  function handleSubmitFailed(e: React.FormEvent) {
    e.preventDefault();
    const reason = failedReason.trim();
    if (reason.length < 3) {
      toast.error("Indica un motivo (min 3 caratteri)");
      return;
    }
    startTransition(async () => {
      const res = await actions.markFailed({
        deliveryId: current.id,
        reason,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCurrent({ ...current, status: "failed", failure_reason: reason });
      setFailedOpen(false);
      setFailedReason("");
      toast.warning("Consegna segnata come fallita");
    });
  }

  return (
    <div className="space-y-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Header compatto */}
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-sage">
              Consegna
            </p>
            <h1 className="truncate text-xl font-bold text-charcoal">
              {current.restaurant?.name ?? "Ristorante"}
            </h1>
            {current.zone_name && (
              <p className="mt-0.5 text-xs text-sage">
                Zona: {current.zone_name}
              </p>
            )}
          </div>
          <Badge variant={STATUS_VARIANT[current.status]}>
            {STATUS_LABEL[current.status]}
          </Badge>
        </div>

        <Timeline status={current.status} />

        <div className="space-y-2 text-sm text-sage">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="break-words text-charcoal/90">
                {addressLine || "Indirizzo non disponibile"}
              </p>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex h-11 items-center gap-1 text-sm font-medium text-forest hover:text-forest-dark"
                >
                  Apri in Google Maps <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            <span>{slotLabel(current.scheduled_slot)}</span>
          </div>

          {current.restaurant?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <a
                href={`tel:${current.restaurant.phone}`}
                className="inline-flex h-11 items-center text-charcoal/90 hover:text-forest"
              >
                {current.restaurant.phone}
              </a>
            </div>
          )}

          {current.status === "failed" && current.failure_reason && (
            <p className="rounded-md bg-terracotta-light p-2 text-xs text-terracotta">
              <span className="font-semibold">Motivo: </span>
              {current.failure_reason}
            </p>
          )}

          {current.notes && (
            <p className="rounded-md bg-sage-muted/50 p-2 text-xs text-charcoal/80">
              <span className="font-semibold">Note: </span>
              {current.notes}
            </p>
          )}
        </div>
      </Card>

      {/* Lista items */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">
            Righe di consegna
          </h2>
          <span className="text-xs text-sage">{current.items.length} righe</span>
        </div>
        {current.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-sage">
            Nessuna riga associata a questa consegna.
          </p>
        ) : (
          <ul className="divide-y divide-sage-muted/30">
            {current.items.map((it) => (
              <li key={it.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal">
                      {it.product_name}
                    </p>
                    <p className="mt-0.5 text-xs text-sage">
                      {it.product_code ? `${it.product_code} · ` : ""}
                      Lotto {it.lot_code ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-charcoal">
                      {Number(it.quantity_sales_unit).toLocaleString("it-IT")}
                      <span className="ml-1 text-xs text-sage">
                        {it.sales_unit_label ?? "pz"}
                      </span>
                    </p>
                    <p className="text-[11px] text-sage">
                      {Number(it.quantity_base).toLocaleString("it-IT")}{" "}
                      {it.base_unit_label ?? ""}
                    </p>
                  </div>
                </div>
                {it.expiry_date && (
                  <div className="mt-2">
                    <ExpiryBadge expiryDate={it.expiry_date} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Azioni */}
      {!closed && (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-charcoal">Operazioni</h2>

          {canStart && (
            <Button
              type="button"
              variant="primary"
              className="h-12 w-full"
              onClick={handleStart}
              disabled={pending}
            >
              <Play className="mr-2 h-5 w-5" />
              Inizia giro
            </Button>
          )}

          {canDeliver && (
            <>
              <PodPhotoCapture
                deliveryId={current.id}
                uploaded={!!podPath}
                uploadAction={actions.uploadPod}
                onUploaded={(d) => {
                  setPodPath(d.path);
                  toast.success("Foto POD caricata");
                }}
              />

              <Button
                type="button"
                variant="primary"
                className="h-12 w-full"
                onClick={() => setSigOpen(true)}
                disabled={pending}
              >
                <PenLine className="mr-2 h-5 w-5" />
                Cattura firma e consegna
              </Button>
            </>
          )}

          {canFail && (
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => setFailedOpen(true)}
              disabled={pending}
            >
              <XCircle className="mr-2 h-5 w-5" />
              Consegna fallita
            </Button>
          )}
        </Card>
      )}

      {closed && current.status === "delivered" && (
        <Card className="flex items-center gap-3 border-forest/30 bg-forest-light/40 p-4">
          <CheckCircle2 className="h-6 w-6 text-forest" />
          <div>
            <p className="text-sm font-semibold text-forest-dark">
              Consegna completata
            </p>
            {current.delivered_at && (
              <p className="text-xs text-forest-dark/80">
                {new Date(current.delivered_at).toLocaleString("it-IT")}
              </p>
            )}
          </div>
        </Card>
      )}

      {closed && current.status === "failed" && (
        <Card className="flex items-center gap-3 border-terracotta/30 bg-terracotta-light p-4">
          <Truck className="h-6 w-6 text-terracotta" />
          <div>
            <p className="text-sm font-semibold text-terracotta">
              Consegna fallita
            </p>
            {current.failure_reason && (
              <p className="text-xs text-terracotta/90">
                {current.failure_reason}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Sheet firma */}
      <SignatureCanvas
        open={sigOpen}
        onClose={() => (sigConfirming ? undefined : setSigOpen(false))}
        onConfirm={handleConfirmSignature}
        confirming={sigConfirming}
      />

      {/* Modal fallita */}
      <Modal
        isOpen={failedOpen}
        onClose={() => setFailedOpen(false)}
        title="Segna come fallita"
        size="sm"
      >
        <form onSubmit={handleSubmitFailed} className="space-y-4">
          <div>
            <label
              htmlFor="failure-reason"
              className="mb-1 block text-sm font-medium text-charcoal"
            >
              Motivo (obbligatorio)
            </label>
            <select
              id="failure-reason-preset"
              className="mb-2 w-full rounded-md border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal"
              onChange={(e) => {
                if (e.target.value) setFailedReason(e.target.value);
              }}
              defaultValue=""
            >
              <option value="">— Motivi frequenti —</option>
              <option value="Ristorante chiuso">Ristorante chiuso</option>
              <option value="Cliente non presente">Cliente non presente</option>
              <option value="Merce rifiutata">Merce rifiutata</option>
              <option value="Indirizzo errato">Indirizzo errato</option>
              <option value="Veicolo guasto">Veicolo guasto</option>
            </select>
            <textarea
              id="failure-reason"
              value={failedReason}
              onChange={(e) => setFailedReason(e.target.value)}
              required
              minLength={3}
              maxLength={500}
              rows={3}
              placeholder="Specifica cosa è successo…"
              className="w-full rounded-md border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-11 flex-1"
              onClick={() => setFailedOpen(false)}
              disabled={pending}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="h-11 flex-1"
              disabled={pending || failedReason.trim().length < 3}
            >
              Conferma
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
