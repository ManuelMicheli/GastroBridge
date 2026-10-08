"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Modal, ModalActions } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/formatters";
import { saveHaccpSettings } from "@/lib/restaurants/receiving/actions";
import {
  HACCP_CATEGORIES,
  MACRO_CATEGORY_LABELS,
  type HaccpSettings,
  type MacroCategory,
} from "@/lib/restaurants/receiving/haccp";

const TEMP_CATEGORIES: MacroCategory[] = ["carne", "pesce", "latticini", "surgelati", "verdura", "frutta", "panetteria"];

function toNum(s: string): number | null {
  const v = Number(s.replace(",", "."));
  return s.trim() !== "" && Number.isFinite(v) ? v : null;
}

export function HaccpSettingsButton({ settings }: { settings: HaccpSettings }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="f-btn f-btn-outline" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4" /> Impostazioni HACCP
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Impostazioni HACCP"
        description="Cosa tracciare al ricevimento e gli intervalli di temperatura accettati."
        size="md"
      >
        {open && <SettingsForm settings={settings} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function SettingsForm({ settings, onDone }: { settings: HaccpSettings; onDone: () => void }) {
  const router = useRouter();
  const [cats, setCats] = useState<MacroCategory[]>(settings.tracedCategories);
  const [keywords, setKeywords] = useState(settings.tracedKeywords.join(", "));
  const [ddt, setDdt] = useState(settings.requireDdtPhoto);
  const [rules, setRules] = useState<Record<string, { min: string; max: string }>>(() => {
    const out: Record<string, { min: string; max: string }> = {};
    for (const c of TEMP_CATEGORIES) {
      const r = settings.temperatureRules[c];
      out[c] = {
        min: typeof r?.min === "number" ? String(r.min) : "",
        max: typeof r?.max === "number" ? String(r.max) : "",
      };
    }
    return out;
  });
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const temperatureRules: Record<string, { min: number | null; max: number | null }> = {};
      for (const [c, r] of Object.entries(rules)) temperatureRules[c] = { min: toNum(r.min), max: toNum(r.max) };
      const res = await saveHaccpSettings({
        tracedCategories: cats,
        tracedKeywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length >= 2),
        temperatureRules,
        requireDdtPhoto: ddt,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Impostazioni HACCP salvate");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="f-label mb-2">Categorie con lotto e scadenza obbligatori</legend>
        <div className="flex flex-wrap gap-1.5">
          {HACCP_CATEGORIES.map((c) => {
            const on = cats.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCats((p) => (on ? p.filter((x) => x !== c) : [...p, c]))}
                className={cn(
                  "h-9 rounded-full px-3 text-[13px] font-medium transition-colors",
                  on ? "bg-[var(--acc-800)] text-white" : "bg-[var(--f-fill)] text-[var(--f-ink-2)] hover:bg-[var(--f-fill-2)]",
                )}
              >
                {MACRO_CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="block">
        <span className="f-label mb-1.5 block">Traccia sempre anche (parole nel nome, separate da virgola)</span>
        <input
          className="f-input h-11 w-full px-3"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="uova, molluschi, tartufo"
        />
      </label>
      <fieldset>
        <legend className="f-label mb-2">Temperatura al ricevimento (°C) — lascia vuoto per non controllarla</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TEMP_CATEGORIES.map((c) => (
            <div key={c} className="flex items-center gap-2 rounded-[12px] bg-[var(--f-fill)] px-3 py-2">
              <span className="w-24 shrink-0 text-[13px] font-medium text-[var(--f-ink)]">{MACRO_CATEGORY_LABELS[c]}</span>
              <input
                inputMode="decimal"
                className="f-input h-9 w-full px-2 text-[13px]"
                placeholder="min"
                aria-label={`${MACRO_CATEGORY_LABELS[c]} minima`}
                value={rules[c]?.min ?? ""}
                onChange={(e) => setRules((p) => ({ ...p, [c]: { ...p[c]!, min: e.target.value } }))}
              />
              <input
                inputMode="decimal"
                className="f-input h-9 w-full px-2 text-[13px]"
                placeholder="max"
                aria-label={`${MACRO_CATEGORY_LABELS[c]} massima`}
                value={rules[c]?.max ?? ""}
                onChange={(e) => setRules((p) => ({ ...p, [c]: { ...p[c]!, max: e.target.value } }))}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[var(--f-muted)]">
          Riferimenti comuni: carne 0…4, pesce fresco 0…2, latticini 0…4, surgelati ≤ −18. Verifica il tuo piano di
          autocontrollo.
        </p>
      </fieldset>
      <label className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--f-fill)] px-3 py-2.5">
        <span className="text-[13.5px] text-[var(--f-ink)]">Foto del DDT obbligatoria al ricevimento</span>
        <input type="checkbox" className="h-5 w-5" checked={ddt} onChange={(e) => setDdt(e.target.checked)} />
      </label>
      <ModalActions>
        <button type="button" className="f-btn f-btn-outline" onClick={onDone}>
          Annulla
        </button>
        <button type="button" className="f-btn f-btn-primary" onClick={save} disabled={pending}>
          Salva
        </button>
      </ModalActions>
    </div>
  );
}
