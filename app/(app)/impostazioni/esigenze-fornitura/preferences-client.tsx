"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresetPicker } from "@/components/settings/preferences/preset-picker";
import {
  WeightsSlider,
  type WeightTriple,
} from "@/components/settings/preferences/weights-slider";
import { CertificationMultiSelect } from "@/components/settings/preferences/certification-multi-select";
import { CategoryOverrideAccordion } from "@/components/settings/preferences/category-override-accordion";
import { updatePreferences } from "@/lib/restaurants/preferences";
import type {
  PreferencesGlobal,
  PreferencesCategoryOverride,
} from "@/lib/restaurants/preferences";
import type { CategoryMacro, CertificationType } from "@/types/database";

type FormState = {
  min_order_max_eur: string;
  lead_time_max_days: string;
  max_distance_km: string;
  required_certifications: CertificationType[];
  blocked_supplier_ids: string;
  prefer_bio: boolean;
  prefer_km0: boolean;
  weights: WeightTriple;
};

function fromGlobal(g: PreferencesGlobal): FormState {
  return {
    min_order_max_eur: g.min_order_max_eur != null ? String(g.min_order_max_eur) : "",
    lead_time_max_days:
      g.lead_time_max_days != null ? String(g.lead_time_max_days) : "",
    max_distance_km: g.max_distance_km != null ? String(g.max_distance_km) : "",
    required_certifications: g.required_certifications,
    blocked_supplier_ids: g.blocked_supplier_ids.join("\n"),
    prefer_bio: g.prefer_bio,
    prefer_km0: g.prefer_km0,
    weights: {
      price: g.price_weight,
      quality: g.quality_weight,
      delivery: g.delivery_weight,
    },
  };
}

function parseOptionalNumber(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  const n = Number(trimmed);
  if (Number.isNaN(n) || n < 0) return { ok: false, error: "Valore non valido" };
  return { ok: true, value: n };
}

function parseOptionalInt(raw: string, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return { ok: false, error: `${label} non valido` };
  return { ok: true, value: n };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PreferencesClient({
  restaurantId,
  initialGlobal,
  initialByCategory,
}: {
  restaurantId: string;
  initialGlobal: PreferencesGlobal;
  initialByCategory: Partial<Record<CategoryMacro, PreferencesCategoryOverride>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => fromGlobal(initialGlobal));

  const onSave = () => {
    const minOrder = parseOptionalNumber(form.min_order_max_eur);
    if (!minOrder.ok) {
      toast.error(`Min. ordine: ${minOrder.error}`);
      return;
    }
    const leadTime = parseOptionalInt(form.lead_time_max_days, "Lead time");
    if (!leadTime.ok) {
      toast.error(leadTime.error);
      return;
    }
    const distance = parseOptionalInt(form.max_distance_km, "Distanza");
    if (!distance.ok) {
      toast.error(distance.error);
      return;
    }

    const blockedIds = form.blocked_supplier_ids
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const invalidId = blockedIds.find((id) => !UUID_RE.test(id));
    if (invalidId) {
      toast.error(`ID fornitore non valido: ${invalidId}`);
      return;
    }

    startTransition(async () => {
      const res = await updatePreferences(restaurantId, {
        min_order_max_eur: minOrder.value,
        lead_time_max_days: leadTime.value,
        max_distance_km: distance.value,
        required_certifications: form.required_certifications,
        blocked_supplier_ids: blockedIds,
        prefer_bio: form.prefer_bio,
        prefer_km0: form.prefer_km0,
        price_weight: form.weights.price,
        quality_weight: form.weights.quality,
        delivery_weight: form.weights.delivery,
        // any manual save downgrades preset to custom
        preset_profile: "custom",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Preferenze salvate");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profili preset</CardTitle>
          <p className="text-sm text-sage">
            Parti da un profilo tipico e poi personalizza. Profilo attuale:{" "}
            <span className="font-semibold text-charcoal">
              {initialGlobal.preset_profile}
            </span>
          </p>
        </CardHeader>
        <CardContent>
          <PresetPicker
            restaurantId={restaurantId}
            current={initialGlobal.preset_profile}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vincoli globali (hard constraints)</CardTitle>
          <p className="text-sm text-sage">
            Regole che filtrano i fornitori: chi non le rispetta viene escluso.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Min. ordine max (€)"
              type="number"
              min={0}
              step="0.01"
              value={form.min_order_max_eur}
              onChange={(e) =>
                setForm((f) => ({ ...f, min_order_max_eur: e.target.value }))
              }
              placeholder="Illimitato"
              helperText="Escludi fornitori con ordine minimo superiore"
            />
            <Input
              label="Lead time max (giorni)"
              type="number"
              min={0}
              value={form.lead_time_max_days}
              onChange={(e) =>
                setForm((f) => ({ ...f, lead_time_max_days: e.target.value }))
              }
              placeholder="Illimitato"
            />
            <Input
              label="Distanza max (km)"
              type="number"
              min={0}
              value={form.max_distance_km}
              onChange={(e) =>
                setForm((f) => ({ ...f, max_distance_km: e.target.value }))
              }
              placeholder="Illimitato"
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-charcoal mb-2">
              Certificazioni richieste
            </div>
            <CertificationMultiSelect
              value={form.required_certifications}
              onChange={(next) =>
                setForm((f) => ({ ...f, required_certifications: next }))
              }
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-xl border-2 border-sage-muted px-4 py-3 cursor-pointer hover:border-forest/40">
              <input
                type="checkbox"
                className="accent-forest h-4 w-4"
                checked={form.prefer_bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prefer_bio: e.target.checked }))
                }
              />
              <span className="text-sm text-charcoal font-semibold">
                Preferisci BIO
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border-2 border-sage-muted px-4 py-3 cursor-pointer hover:border-forest/40">
              <input
                type="checkbox"
                className="accent-forest h-4 w-4"
                checked={form.prefer_km0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prefer_km0: e.target.checked }))
                }
              />
              <span className="text-sm text-charcoal font-semibold">
                Preferisci Km0 / locale
              </span>
            </label>
          </div>

          <div>
            <label
              htmlFor="blocked-suppliers"
              className="text-sm font-semibold text-charcoal block mb-1.5"
            >
              Fornitori bloccati (un UUID per riga)
            </label>
            <textarea
              id="blocked-suppliers"
              value={form.blocked_supplier_ids}
              onChange={(e) =>
                setForm((f) => ({ ...f, blocked_supplier_ids: e.target.value }))
              }
              rows={3}
              className="w-full border-2 border-sage-muted rounded-xl py-3 px-4 font-mono text-xs text-charcoal placeholder:text-sage focus:border-forest focus:outline-none"
              placeholder="es. 11111111-2222-3333-4444-555555555555"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pesi decisionali</CardTitle>
          <p className="text-sm text-sage">
            Quanto conta ogni fattore nel ranking dei fornitori? La somma deve
            essere sempre 100.
          </p>
        </CardHeader>
        <CardContent>
          <WeightsSlider
            value={form.weights}
            onChange={(next) => setForm((f) => ({ ...f, weights: next }))}
            disabled={pending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferenze per categoria</CardTitle>
          <p className="text-sm text-sage">
            Sovrascrivi i vincoli globali per una specifica macro-categoria
            (es. pesce sempre premium).
          </p>
        </CardHeader>
        <CardContent>
          <CategoryOverrideAccordion
            restaurantId={restaurantId}
            byCategory={initialByCategory}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end sticky bottom-4">
        <Button size="md" onClick={onSave} isLoading={pending}>
          Salva preferenze
        </Button>
      </div>
    </div>
  );
}
