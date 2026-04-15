"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  createZone,
  updateZone,
} from "@/lib/supplier/delivery-zones/actions";
import type {
  DeliveryZoneInput,
  DeliverySlotInput,
} from "@/lib/supplier/delivery-zones/schemas";
import type { Database } from "@/types/database";
import { SlotEditor } from "./slot-editor";

type ZoneRow = Database["public"]["Tables"]["delivery_zones"]["Row"];
type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

type Props = {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  zone?: ZoneRow | null;
  warehouses: WarehouseRow[];
  onSaved?: () => void;
};

const DAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: "Lun", label: "Lunedì" },
  { value: 2, short: "Mar", label: "Martedì" },
  { value: 3, short: "Mer", label: "Mercoledì" },
  { value: 4, short: "Gio", label: "Giovedì" },
  { value: 5, short: "Ven", label: "Venerdì" },
  { value: 6, short: "Sab", label: "Sabato" },
  { value: 0, short: "Dom", label: "Domenica" },
];

// Lightweight IT provinces list (sigle ISO 3166-2).
const IT_PROVINCES = [
  "AG","AL","AN","AO","AP","AQ","AR","AT","AV",
  "BA","BG","BI","BL","BN","BO","BR","BS","BT","BZ",
  "CA","CB","CE","CH","CL","CN","CO","CR","CS","CT","CZ",
  "EN",
  "FC","FE","FG","FI","FM","FR",
  "GE","GO","GR",
  "IM","IS",
  "KR",
  "LC","LE","LI","LO","LT","LU",
  "MB","MC","ME","MI","MN","MO","MS","MT",
  "NA","NO","NU",
  "OR",
  "PA","PC","PD","PE","PG","PI","PN","PO","PR","PT","PU","PV","PZ",
  "RA","RC","RE","RG","RI","RM","RN","RO",
  "SA","SI","SO","SP","SR","SS","SU","SV",
  "TA","TE","TN","TO","TP","TR","TS","TV",
  "UD",
  "VA","VB","VC","VE","VI","VR","VT","VV",
];

function zipsToCsv(zips: string[] | null | undefined) {
  if (!zips || zips.length === 0) return "";
  return zips.join(", ");
}

function csvToZips(csv: string): string[] {
  return csv
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slotsFromRow(
  raw: Record<string, unknown> | null | undefined,
): DeliverySlotInput[] {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { slots?: unknown }).slots)
      ? ((raw as { slots: unknown[] }).slots)
      : [];
  return (arr as Array<Record<string, unknown>>).map((s) => ({
    from: typeof s.from === "string" ? s.from : "08:00",
    to: typeof s.to === "string" ? s.to : "12:00",
    label: typeof s.label === "string" ? s.label : "",
    capacity:
      typeof s.capacity === "number"
        ? s.capacity
        : Number.parseInt(String(s.capacity ?? 10), 10) || 10,
  }));
}

export function ZoneEditorDialog({
  open,
  onClose,
  supplierId,
  zone,
  warehouses,
  onSaved,
}: Props) {
  const primaryWh = warehouses.find((w) => w.is_primary) ?? warehouses[0];
  const [zoneName, setZoneName] = useState(zone?.zone_name ?? "");
  const [provinces, setProvinces] = useState<string[]>(
    zone?.provinces ?? [],
  );
  const [zipCsv, setZipCsv] = useState(zipsToCsv(zone?.zip_codes));
  const [deliveryFee, setDeliveryFee] = useState<string>(
    String(zone?.delivery_fee ?? 0),
  );
  const [freeAbove, setFreeAbove] = useState<string>(
    zone?.free_delivery_above != null ? String(zone.free_delivery_above) : "",
  );
  const [days, setDays] = useState<number[]>(zone?.delivery_days ?? []);
  const [cutoff, setCutoff] = useState(zone?.cutoff_time ?? "10:00");
  const [slots, setSlots] = useState<DeliverySlotInput[]>(
    zone ? slotsFromRow(zone.delivery_slots) : [],
  );
  const [warehouseId, setWarehouseId] = useState(
    zone?.warehouse_id ?? primaryWh?.id ?? "",
  );
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const toggleProvince = (p: string) => {
    setProvinces((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const submit = () => {
    if (warehouses.length === 0) {
      toast.error(
        "Configura almeno una sede in Impostazioni prima di creare zone.",
      );
      return;
    }
    const payload: DeliveryZoneInput = {
      zone_name: zoneName.trim(),
      provinces,
      zip_codes: csvToZips(zipCsv),
      delivery_fee: Number.parseFloat(deliveryFee) || 0,
      free_delivery_above:
        freeAbove.trim().length > 0
          ? Number.parseFloat(freeAbove) || 0
          : null,
      delivery_days: days,
      cutoff_time: cutoff,
      delivery_slots: slots,
      warehouse_id: warehouseId,
    };

    startTransition(async () => {
      const res = zone
        ? await updateZone(supplierId, zone.id, payload)
        : await createZone(supplierId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(zone ? "Zona aggiornata" : "Zona creata");
      onSaved?.();
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl bg-surface-card border border-border-subtle p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {zone ? "Modifica zona" : "Nuova zona"}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Definisci copertura geografica, giorni e slot di consegna.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-text-secondary">Nome zona *</span>
            <input
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Es. Milano Nord"
            />
          </label>

          <label className="block">
            <span className="text-sm text-text-secondary">
              Sede di partenza *
            </span>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
            >
              <option value="">— Seleziona —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.is_primary ? " (principale)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className="text-sm text-text-secondary">Province *</span>
          <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 rounded-lg bg-surface-base border border-border-subtle">
            {IT_PROVINCES.map((p) => {
              const active = provinces.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProvince(p)}
                  className={`px-2 py-0.5 text-[11px] rounded-md font-mono border transition ${
                    active
                      ? "bg-accent-green text-white border-accent-green"
                      : "bg-surface-card text-text-secondary border-border-subtle hover:border-accent-green/50"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          {provinces.length > 0 && (
            <p className="text-[11px] text-text-secondary mt-1">
              Selezionate: {provinces.join(", ")}
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-sm text-text-secondary">
            CAP (separati da virgola, opzionale)
          </span>
          <input
            type="text"
            value={zipCsv}
            onChange={(e) => setZipCsv(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary font-mono text-sm"
            placeholder="20100, 20121, 20122"
          />
          <span className="text-[11px] text-text-secondary mt-1 block">
            Lascia vuoto per coprire tutte le province selezionate.
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-text-secondary">
              Costo consegna (€)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">
              Consegna gratis sopra (€)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={freeAbove}
              onChange={(e) => setFreeAbove(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Nessuna soglia"
            />
          </label>
        </div>

        <div>
          <span className="text-sm text-text-secondary">
            Giorni consegna *
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {DAYS.map((d) => {
              const active = days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition ${
                    active
                      ? "bg-accent-green text-white border-accent-green"
                      : "bg-surface-base text-text-secondary border-border-subtle hover:border-accent-green/50"
                  }`}
                  aria-label={d.label}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-sm text-text-secondary">
            Orario cutoff ordini *
          </span>
          <input
            type="time"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
            className="mt-1 w-40 rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          />
          <span className="text-[11px] text-text-secondary mt-1 block">
            Gli ordini ricevuti dopo questo orario saranno consegnati il
            giorno disponibile successivo.
          </span>
        </label>

        <div>
          <span className="text-sm text-text-secondary">
            Slot orari *
          </span>
          <div className="mt-1 rounded-lg bg-surface-base border border-border-subtle p-3">
            <SlotEditor
              slots={slots}
              onChange={setSlots}
              disabled={pending}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover"
            disabled={pending}
          >
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={pending || zoneName.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
          >
            {pending ? "Salvo..." : "Salva zona"}
          </button>
        </div>
      </div>
    </div>
  );
}
