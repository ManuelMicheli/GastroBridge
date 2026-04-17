import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Truck, Phone, ExternalLink } from "lucide-react";
import type { DeliveryRow } from "@/lib/supplier/delivery/queries";
import type { DeliveryStatus } from "@/types/database";
import { CelebrationCheck, PulseDot } from "@/components/supplier/signature";

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

function formatSlot(slot: DeliveryRow["scheduled_slot"]): string {
  if (!slot) return "Slot non definito";
  if (slot.label) return slot.label;
  if (slot.start && slot.end) return `${slot.start} – ${slot.end}`;
  if (slot.start) return slot.start;
  return "Slot non definito";
}

function buildMapsUrl(
  restaurant: DeliveryRow["order_split"] extends infer T
    ? T extends { orders: { restaurants: infer R } | null }
      ? R
      : never
    : never,
): string | null {
  if (!restaurant) return null;
  const parts = [
    restaurant.name,
    restaurant.address,
    restaurant.zip_code,
    restaurant.city,
    restaurant.province,
  ]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(", ");
  if (!parts) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

export function DeliveryCard({ delivery }: { delivery: DeliveryRow }) {
  const restaurant = delivery.order_split?.orders?.restaurants ?? null;
  const mapsUrl = buildMapsUrl(restaurant);
  const slotText = formatSlot(delivery.scheduled_slot);
  const addressLine = restaurant
    ? [restaurant.address, restaurant.zip_code, restaurant.city, restaurant.province]
        .filter((p): p is string => Boolean(p && p.trim()))
        .join(", ")
    : "";

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-charcoal">
            {restaurant?.name ?? "Ristorante"}
          </h3>
          {delivery.zone_name && (
            <p className="mt-0.5 text-xs text-sage">Zona: {delivery.zone_name}</p>
          )}
        </div>
        <Badge
          variant={STATUS_VARIANT[delivery.status]}
          className="inline-flex items-center gap-1.5"
        >
          {delivery.status === "delivered" && (
            <CelebrationCheck size={18} />
          )}
          {delivery.status === "in_transit" && (
            <PulseDot variant="live" size={6} />
          )}
          {STATUS_LABEL[delivery.status]}
        </Badge>
      </div>

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
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-forest hover:text-forest-dark"
              >
                Apri in Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          <span>{slotText}</span>
        </div>

        {restaurant?.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            <a
              href={`tel:${restaurant.phone}`}
              className="text-charcoal/90 hover:text-forest"
            >
              {restaurant.phone}
            </a>
          </div>
        )}

        {delivery.notes && (
          <p className="rounded-md bg-sage-muted/50 p-2 text-xs text-charcoal/80">
            <span className="font-semibold">Note: </span>
            {delivery.notes}
          </p>
        )}

        {delivery.status === "failed" && delivery.failure_reason && (
          <p className="rounded-md bg-terracotta-light p-2 text-xs text-terracotta">
            <span className="font-semibold">Fallita: </span>
            {delivery.failure_reason}
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-sage">
          <Truck className="h-3.5 w-3.5" aria-hidden />
          {delivery.driver_member_id ? "Assegnata" : "Nessun driver"}
        </div>
        <Link href={`/supplier/consegne/${delivery.id}`}>
          <Button size="sm" variant="primary">
            Apri
          </Button>
        </Link>
      </div>
    </Card>
  );
}
