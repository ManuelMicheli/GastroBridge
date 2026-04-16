"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createLocation, updateLocation } from "@/lib/restaurants/actions";
import { CUISINE_VALUES } from "@/lib/restaurants/schemas";
import type { RestaurantRow } from "@/lib/restaurants/types";

type Props = {
  open: boolean;
  onClose: () => void;
  location?: RestaurantRow | null;
  onSaved?: () => void;
};

const CUISINE_LABELS: Record<(typeof CUISINE_VALUES)[number], string> = {
  italiana: "Italiana",
  pizzeria: "Pizzeria",
  pesce: "Pesce",
  carne: "Carne",
  giapponese: "Giapponese",
  fusion: "Fusion",
  bistrot: "Bistrot",
  trattoria: "Trattoria",
  gourmet: "Gourmet",
  altro: "Altro",
};

export function LocationFormDialog({ open, onClose, location, onSaved }: Props) {
  const [name, setName] = useState(location?.name ?? "");
  const [cuisine, setCuisine] = useState<string>(location?.cuisine ?? "");
  const [covers, setCovers] = useState<string>(
    location?.covers != null ? String(location.covers) : ""
  );
  const [address, setAddress] = useState(location?.address ?? "");
  const [city, setCity] = useState(location?.city ?? "");
  const [province, setProvince] = useState(location?.province ?? "");
  const [zipCode, setZipCode] = useState(location?.zip_code ?? "");
  const [phone, setPhone] = useState(location?.phone ?? "");
  const [email, setEmail] = useState(location?.email ?? "");
  const [isPrimary, setIsPrimary] = useState<boolean>(location?.is_primary ?? false);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const submit = () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    const parsedCovers = covers.trim().length > 0 ? Number(covers) : null;
    if (parsedCovers !== null && !Number.isFinite(parsedCovers)) {
      toast.error("Numero di coperti non valido");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: trimmedName,
        cuisine: cuisine
          ? (cuisine as (typeof CUISINE_VALUES)[number])
          : null,
        covers: parsedCovers,
        address: address.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        zip_code: zipCode.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        is_primary: isPrimary,
      };
      const res = location
        ? await updateLocation(location.id, payload)
        : await createLocation(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(location ? "Sede aggiornata" : "Sede creata");
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
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-card border border-border-subtle p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {location ? "Modifica sede" : "Nuova sede"}
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-text-secondary">Nome *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Es. Ristorante Centro"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-text-secondary">Cucina</span>
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              >
                <option value="">—</option>
                {CUISINE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {CUISINE_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Coperti</span>
              <input
                type="number"
                min={0}
                value={covers}
                onChange={(e) => setCovers(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="Es. 60"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-text-secondary">Indirizzo</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Via Roma 10"
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block col-span-2">
              <span className="text-sm text-text-secondary">Città</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Prov.</span>
              <input
                type="text"
                value={province}
                maxLength={4}
                onChange={(e) => setProvince(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="MI"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm text-text-secondary">CAP</span>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              />
            </label>

            <label className="block col-span-2">
              <span className="text-sm text-text-secondary">Telefono</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-text-secondary">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="info@ristorante.it"
            />
          </label>

          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-text-secondary">Sede principale</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover"
            disabled={pending}
          >
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={pending || name.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
          >
            {pending ? "Salvo..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
