import type { ReactNode } from "react";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

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
      className="min-h-screen w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]"
    >
      {/* ─── Left: editorial brand panel (lg+) ─── */}
      <aside
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
        style={{
          background:
            "linear-gradient(152deg, #7B1F2E 0%, #B91C3C 58%, #9A1833 100%)",
        }}
      >
        {/* Decorative glows + hairline grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute -right-28 -top-28 h-96 w-96 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(249,198,208,0.20), transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-32 -left-20 h-[26rem] w-[26rem] rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.09), transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>

        {/* Wordmark */}
        <div className="relative">
          <Link href="/" className="inline-flex items-baseline text-2xl">
            <span className="font-display text-white">Gastro</span>
            <span className="font-body font-bold text-[#F9C6D0]">Bridge</span>
          </Link>
        </div>

        {/* Editorial copy */}
        <div className="relative max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/65">
            Marketplace B2B · Ho.Re.Ca.
          </p>
          <h2 className="mt-5 font-display text-[2.6rem] leading-[1.08] text-white xl:text-5xl">
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
      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div className="auth-anim w-full max-w-[400px] animate-[authIn_520ms_cubic-bezier(0.16,1,0.3,1)_both]">
          {/* Mobile wordmark */}
          <div className="mb-8 text-center lg:hidden">
            <Link href="/" className="inline-flex items-baseline text-2xl">
              <span className="font-display text-charcoal">Gastro</span>
              <span className="font-body font-bold text-brand-primary">
                Bridge
              </span>
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
