"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CertificationMultiSelect } from "./certification-multi-select";
import {
  updateCategoryPreference,
  deleteCategoryPreference,
  type PreferencesCategoryOverride,
} from "@/lib/restaurants/preferences";
import {
  CATEGORY_MACRO_VALUES,
  QUALITY_TIER_VALUES,
} from "@/lib/restaurants/schemas";
import type {
  CategoryMacro,
  CertificationType,
  QualityTier,
} from "@/types/database";
import { cn } from "@/lib/utils/formatters";

const MACRO_LABELS: Record<CategoryMacro, string> = {
  carne: "Carne",
  pesce: "Pesce",
  verdura: "Verdura",
  frutta: "Frutta",
  latticini: "Latticini",
  secco: "Prodotti secchi",
  bevande: "Bevande",
  surgelati: "Surgelati",
  panetteria: "Panetteria",
  altro: "Altro",
};

const QUALITY_LABELS: Record<QualityTier, string> = {
  economy: "Economy",
  standard: "Standard",
  premium: "Premium",
  luxury: "Luxury",
};

type DraftState = {
  min_quality_tier: QualityTier | "";
  lead_time_max_days: string;
  required_certifications: CertificationType[];
};

function toDraft(ov: PreferencesCategoryOverride | undefined): DraftState {
  return {
    min_quality_tier: ov?.min_quality_tier ?? "",
    lead_time_max_days:
      ov?.lead_time_max_days != null ? String(ov.lead_time_max_days) : "",
    required_certifications: ov?.required_certifications ?? [],
  };
}

function CategoryRow({
  restaurantId,
  macro,
  override,
}: {
  restaurantId: string;
  macro: CategoryMacro;
  override: PreferencesCategoryOverride | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftState>(() => toDraft(override));

  const hasOverride = !!override;

  const onSave = () => {
    startTransition(async () => {
      const leadTime =
        draft.lead_time_max_days.trim() === ""
          ? null
          : Number(draft.lead_time_max_days);
      if (leadTime !== null && (Number.isNaN(leadTime) || leadTime < 0)) {
        toast.error("Lead time non valido");
        return;
      }
      const res = await updateCategoryPreference(restaurantId, macro, {
        min_quality_tier:
          draft.min_quality_tier === "" ? null : draft.min_quality_tier,
        lead_time_max_days: leadTime,
        required_certifications: draft.required_certifications,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Override aggiornato");
      router.refresh();
    });
  };

  const onClear = () => {
    if (!confirm(`Rimuovere l'override per "${MACRO_LABELS[macro]}"?`)) return;
    startTransition(async () => {
      const res = await deleteCategoryPreference(restaurantId, macro);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDraft(toDraft(undefined));
      toast.success("Override rimosso");
      router.refresh();
    });
  };

  return (
    <div className="border border-sage-muted/40 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-sage-muted/10"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-charcoal">
            {MACRO_LABELS[macro]}
          </span>
          {hasOverride ? (
            <span className="text-xs text-forest font-semibold">
              Override attivo
            </span>
          ) : (
            <span className="text-xs text-sage">Usa vincoli globali</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-sage transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-4 py-4 border-t border-sage-muted/40 bg-sage-muted/5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tier minimo"
              value={draft.min_quality_tier}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  min_quality_tier: e.target.value as QualityTier | "",
                }))
              }
              placeholder="Nessun vincolo"
              options={[
                { value: "", label: "Nessun vincolo" },
                ...QUALITY_TIER_VALUES.map((t) => ({
                  value: t,
                  label: QUALITY_LABELS[t],
                })),
              ]}
              disabled={pending}
            />
            <Input
              label="Lead time max (giorni)"
              type="number"
              min={0}
              value={draft.lead_time_max_days}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  lead_time_max_days: e.target.value,
                }))
              }
              placeholder="Globale"
              disabled={pending}
            />
          </div>
          <div>
            <div className="text-sm font-semibold text-charcoal mb-2">
              Certificazioni richieste
            </div>
            <CertificationMultiSelect
              value={draft.required_certifications}
              onChange={(next) =>
                setDraft((d) => ({ ...d, required_certifications: next }))
              }
              disabled={pending}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={onSave} isLoading={pending}>
              Salva override
            </Button>
            {hasOverride && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" /> Rimuovi
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryOverrideAccordion({
  restaurantId,
  byCategory,
}: {
  restaurantId: string;
  byCategory: Partial<Record<CategoryMacro, PreferencesCategoryOverride>>;
}) {
  return (
    <div className="space-y-2">
      {CATEGORY_MACRO_VALUES.map((macro) => (
        <CategoryRow
          key={macro}
          restaurantId={restaurantId}
          macro={macro}
          override={byCategory[macro]}
        />
      ))}
    </div>
  );
}
