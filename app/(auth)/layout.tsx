import type { ReactNode } from "react";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/fernly/brand-mark";
import { accentBootScript } from "@/lib/appearance";

const FEATURES = [
  "Confronta i prezzi tra tutti i tuoi fornitori",
  "Ordina e gestisci ogni consegna da un'unica dashboard",
  "Cataloghi sempre sincronizzati e aggiornati",
];

// Scoped as the restaurant area so the whole auth surface inherits the
// canonical brand palette — bordeaux #B91C3C on white — instead of the
// :root forest default.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-area="restaurant"
      className="min-h-screen w-full bg-[var(--f-canvas)] lg:grid lg:grid-cols-[1fr_1fr] lg:gap-2.5 lg:p-2.5"
    >
      {/* Applies the saved workspace accent before first paint. */}
      <script dangerouslySetInnerHTML={{ __html: accentBootScript("restaurant") }} />
      {/* ─── Left: brand panel (lg+) — deep accent with arc texture ─── */}
      <aside className="f-deep relative hidden overflow-hidden rounded-[24px] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Wordmark */}
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 text-2xl">
            <BrandMark size={36} />
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-white">
              Gastro<span className="text-[var(--acc-300)]">Bridge</span>
            </span>
          </Link>
        </div>

        {/* Editorial copy */}
        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Marketplace B2B · Ho.Re.Ca.
          </p>
          <h2 className="mt-5 text-[2.6rem] font-semibold leading-[1.06] tracking-[-0.03em] text-white xl:text-5xl">
            Tutti i tuoi fornitori.
            <br />
            Un solo posto.
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/75">
            Ordini, cataloghi e prezzi della tua attività riuniti in un unico
            flusso di lavoro.
          </p>

          <ul className="mt-9 space-y-4">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                <span className="text-[14px] leading-snug text-white/90">
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Trust footer */}
        <div className="relative flex items-center gap-2 text-white/55">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="text-[11px] tracking-wide">
            Accesso cifrato · I tuoi dati restano protetti
          </span>
        </div>
      </aside>

      {/* ─── Right: form column ─── */}
      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-12 sm:px-8 lg:min-h-0 lg:rounded-[24px] lg:bg-[var(--f-panel)]">
        <div className="auth-anim w-full max-w-[400px] animate-[authIn_520ms_cubic-bezier(0.16,1,0.3,1)_both]">
          {/* Mobile wordmark */}
          <div className="mb-8 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandMark size={34} />
              <BrandWordmark className="text-[22px]" />
            </Link>
            <p className="mt-2 text-sm text-sage">
              Tutti i tuoi fornitori. Un solo posto.
            </p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
