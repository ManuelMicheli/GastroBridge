"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";
import { ACCENT_PRESETS, AREA_ACCENTS, type AccentId } from "@/lib/appearance";
import { useAppearance } from "./appearance-provider";
import { Chips } from "./chips";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils/formatters";

/**
 * Impostazioni → Aspetto. The accent re-tints the whole workspace (all
 * colours interpolate, see the @property accent steps in globals.css) and,
 * like the week start, is remembered on this device.
 */
export function AppearanceSettings() {
  const { area, accent, setAccent, weekStart, setWeekStart } = useAppearance();
  const ids = AREA_ACCENTS[area];

  function pick(id: AccentId) {
    if (id === accent) return;
    setAccent(id);
    toast(`Accento impostato su ${ACCENT_PRESETS[id].label}`);
  }

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader title="Aspetto" subtitle="Personalizza l'area di lavoro su questo dispositivo." />
      <section className="f-card f-rise p-5 sm:p-6" aria-labelledby="appearance-title">
        <h2 id="appearance-title" className="f-card-title">Aspetto</h2>
        <p className="mt-1 text-[13.5px] text-[var(--f-muted)]">
          Il colore d&apos;accento ritinge tutta l&apos;area di lavoro e viene ricordato su questo dispositivo.
        </p>

        <p className="f-eyebrow mt-6">Accento</p>
        <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Colore d'accento">
          {ids.map((id) => {
            const p = ACCENT_PRESETS[id];
            const active = id === accent;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick(id)}
                className={cn(
                  "inline-flex h-11 items-center gap-2.5 rounded-[14px] border bg-[var(--f-card)] pl-1.5 pr-4 text-[14px] font-medium text-[var(--f-ink)] transition-[border-color,box-shadow] duration-200",
                  active
                    ? "border-[var(--f-ink)] shadow-[0_0_0_1px_var(--f-ink)]"
                    : "border-[var(--f-line-strong)] hover:border-[var(--f-ink-2)]",
                )}
              >
                <span
                  aria-hidden
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-[10px]"
                  style={{ background: `linear-gradient(150deg, ${p.swatch[1]}, ${p.swatch[0]})` }}
                >
                  {active ? <Check className="h-4 w-4 text-white" strokeWidth={2.5} /> : null}
                </span>
                {p.label}
              </button>
            );
          })}
        </div>

        <p className="f-eyebrow mt-7">La settimana inizia di</p>
        <div className="mt-2.5">
          <Chips
            ariaLabel="Primo giorno della settimana"
            value={weekStart}
            onChange={setWeekStart}
            options={[
              { value: "sun", label: "Domenica" },
              { value: "mon", label: "Lunedì" },
            ]}
          />
        </div>
        <p className="mt-2 text-[12.5px] text-[var(--f-muted)]">
          Usato da calendario consegne, grafico settimanale della dashboard e mappa attività.
        </p>
      </section>
    </div>
  );
}
