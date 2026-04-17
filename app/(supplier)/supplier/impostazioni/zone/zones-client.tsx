"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  MapPin,
  Pencil,
  Trash2,
  Clock,
  Calendar,
  Truck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoneEditorDialog } from "@/components/supplier/delivery/zone-editor";
import { deleteZone } from "@/lib/supplier/delivery-zones/actions";
import type { Database } from "@/types/database";

type ZoneRow = Database["public"]["Tables"]["delivery_zones"]["Row"];
type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

type Props = {
  supplierId: string;
  initialZones: ZoneRow[];
  warehouses: WarehouseRow[];
};

const DAY_SHORT: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Gio",
  5: "Ven",
  6: "Sab",
};

function countSlots(raw: Record<string, unknown> | null | undefined): number {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  const s = (raw as { slots?: unknown }).slots;
  return Array.isArray(s) ? s.length : 0;
}

export function ZonesClient({ supplierId, initialZones, warehouses }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [pending, startTransition] = useTransition();

  const openNew = () => {
    if (warehouses.length === 0) {
      toast.error(
        "Configura almeno una sede in Impostazioni → Sedi prima di creare zone.",
      );
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (z: ZoneRow) => {
    setEditing(z);
    setDialogOpen(true);
  };

  const onDelete = (z: ZoneRow) => {
    if (
      !confirm(
        `Eliminare definitivamente la zona "${z.zone_name ?? "(senza nome)"}"?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteZone(supplierId, z.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Zona eliminata");
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">
            Zone di Consegna
          </h1>
          <p className="text-sm text-sage mt-1">
            Definisci province, giorni e slot orari per le consegne.
          </p>
        </div>
        <Button size="sm" onClick={openNew} disabled={pending}>
          <Plus className="h-4 w-4" /> Nuova zona
        </Button>
      </div>

      {initialZones.length === 0 ? (
        <Card className="text-center py-16">
          <MapPin className="h-12 w-12 text-sage-muted mx-auto mb-4" />
          <p className="text-sage mb-2">
            Nessuna zona di consegna configurata.
          </p>
          <p className="text-xs text-sage mb-4">
            Aggiungi le province o i CAP dove effettui le consegne.
          </p>
          <Button size="sm" onClick={openNew} disabled={pending}>
            <Plus className="h-4 w-4" /> Crea la prima zona
          </Button>
        </Card>
      ) : (
        <div
          className="cq-section grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          }}
        >
          {initialZones.map((z) => {
            const wh = warehouses.find((w) => w.id === z.warehouse_id);
            const slotCount = countSlots(z.delivery_slots);
            return (
              <Card key={z.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-charcoal truncate">
                      {z.zone_name ?? "(senza nome)"}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(z.provinces ?? []).map((p) => (
                        <Badge
                          key={p}
                          variant="default"
                          className="text-[10px] font-mono ring-1 ring-border-subtle"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(z)}
                      className="p-1.5 rounded-lg hover:bg-surface-hover text-sage hover:text-charcoal"
                      aria-label="Modifica"
                      disabled={pending}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(z)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-sage hover:text-red-600 disabled:opacity-40"
                      aria-label="Elimina"
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-sage flex-1">
                  {wh && (
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      <span>Da: {wh.name}</span>
                    </div>
                  )}
                  {z.delivery_days && z.delivery_days.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {z.delivery_days
                          .slice()
                          .sort((a, b) => a - b)
                          .map((d) => DAY_SHORT[d] ?? d)
                          .join(" · ")}
                      </span>
                    </div>
                  )}
                  {z.cutoff_time && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>
                        Cutoff {z.cutoff_time.slice(0, 5)} · {slotCount}{" "}
                        slot
                      </span>
                    </div>
                  )}
                  {(z.zip_codes?.length ?? 0) > 0 && (
                    <div className="text-[11px] text-sage-muted">
                      CAP: {(z.zip_codes ?? []).slice(0, 6).join(", ")}
                      {(z.zip_codes?.length ?? 0) > 6 ? "…" : ""}
                    </div>
                  )}
                  <div className="text-[11px] text-sage-muted">
                    Costo €{Number(z.delivery_fee ?? 0).toFixed(2)}
                    {z.free_delivery_above != null
                      ? ` · gratis sopra €${Number(
                          z.free_delivery_above,
                        ).toFixed(2)}`
                      : ""}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ZoneEditorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        supplierId={supplierId}
        zone={editing}
        warehouses={warehouses}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
