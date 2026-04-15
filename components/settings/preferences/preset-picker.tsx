"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Award, UtensilsCrossed, Pizza, Coffee, Building2, Settings2 } from "lucide-react";
import { applyPresetProfile } from "@/lib/restaurants/preferences";
import {
  PRESET_PROFILES,
  PRESET_PROFILE_LABELS,
} from "@/lib/restaurants/preset-profiles";
import type { PresetProfile } from "@/types/database";
import { cn } from "@/lib/utils/formatters";

type IconType = typeof Award;

const PRESET_ICONS: Record<PresetProfile, IconType> = {
  custom: Settings2,
  stellato: Award,
  trattoria: UtensilsCrossed,
  pizzeria: Pizza,
  bar: Coffee,
  mensa: Building2,
};

const PRESET_DESCRIPTIONS: Record<PresetProfile, string> = {
  custom: "Configurazione manuale, nessun preset applicato",
  stellato: PRESET_PROFILES.stellato.description,
  trattoria: PRESET_PROFILES.trattoria.description,
  pizzeria: PRESET_PROFILES.pizzeria.description,
  bar: PRESET_PROFILES.bar.description,
  mensa: PRESET_PROFILES.mensa.description,
};

const ALL_PRESETS: PresetProfile[] = [
  "stellato",
  "trattoria",
  "pizzeria",
  "bar",
  "mensa",
];

export function PresetPicker({
  restaurantId,
  current,
}: {
  restaurantId: string;
  current: PresetProfile;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onPick = (preset: PresetProfile) => {
    if (
      !confirm(
        `Applicare il profilo "${PRESET_PROFILE_LABELS[preset]}"? Le preferenze attuali verranno sovrascritte.`
      )
    )
      return;
    startTransition(async () => {
      const res = await applyPresetProfile(restaurantId, preset);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Profilo "${PRESET_PROFILE_LABELS[preset]}" applicato`);
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {ALL_PRESETS.map((preset) => {
        const Icon = PRESET_ICONS[preset];
        const isActive = current === preset;
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onPick(preset)}
            disabled={pending}
            className={cn(
              "flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors",
              isActive
                ? "border-forest bg-forest/5"
                : "border-sage-muted hover:border-forest/40 hover:bg-sage-muted/10",
              pending && "opacity-60 cursor-wait"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-xl",
                isActive ? "bg-forest text-white" : "bg-sage-muted/30 text-forest"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-charcoal text-sm">
                {PRESET_PROFILE_LABELS[preset]}
              </div>
              <div className="text-xs text-sage mt-0.5 leading-snug">
                {PRESET_DESCRIPTIONS[preset]}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
