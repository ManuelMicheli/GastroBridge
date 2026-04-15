import Link from "next/link";
import { Settings2 } from "lucide-react";
import type { Preferences } from "@/lib/scoring";

/**
 * Top-of-page chips bar summarising the user's active ranking preferences.
 * Always renders the weight chip; hard-constraint chips only appear when
 * set. "Modifica" links to the preferences settings page.
 */
export function ActiveFiltersBar({ prefs }: { prefs: Preferences }) {
  const g = prefs.global;
  const chips: string[] = [];

  const totalW = g.priceWeight + g.qualityWeight + g.deliveryWeight;
  if (totalW > 0) {
    const wp = Math.round((g.priceWeight / totalW) * 100);
    const wq = Math.round((g.qualityWeight / totalW) * 100);
    const wd = Math.round((g.deliveryWeight / totalW) * 100);
    chips.push(`Pesi ${wp}/${wq}/${wd}`);
  }
  if (g.minOrderMaxEur !== undefined) {
    chips.push(`Ordine min ≤ €${g.minOrderMaxEur}`);
  }
  if (g.leadTimeMaxDays !== undefined) {
    chips.push(`Consegna ≤ ${g.leadTimeMaxDays} gg`);
  }
  for (const cert of g.requiredCertifications) chips.push(`Certificato ${cert}`);
  if (g.preferBio) chips.push("Preferisci BIO");
  if (g.preferKm0) chips.push("Preferisci km0");

  const catCount = Object.keys(prefs.byCategory).length;
  if (catCount > 0) {
    chips.push(
      `${catCount} ${catCount === 1 ? "regola" : "regole"} per categoria`,
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sage/20 bg-white px-3 py-2 text-xs">
      <span className="font-medium text-charcoal">Tue preferenze:</span>
      {chips.length === 0 ? (
        <span className="text-sage">nessun vincolo attivo</span>
      ) : (
        chips.map((c) => (
          <span
            key={c}
            className="inline-flex items-center rounded-full border border-sage/20 bg-accent-green/10 px-2 py-0.5 text-charcoal"
          >
            {c}
          </span>
        ))
      )}
      <Link
        href="/impostazioni/esigenze-fornitura"
        className="ml-auto inline-flex items-center gap-1 text-accent-green hover:underline"
      >
        <Settings2 className="h-3.5 w-3.5" /> Modifica
      </Link>
    </div>
  );
}
