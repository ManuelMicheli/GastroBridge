import type { ReactNode } from "react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { Footer } from "@/components/layout/footer";
import { PersonaProvider } from "@/lib/marketing-persona-context";
import { LenisProvider } from "@/components/marketing/_primitives/lenis-provider";
import { Grain } from "@/components/marketing/_primitives/grain";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <PersonaProvider>
      <LenisProvider>
        <div
          data-area="marketing"
          className="min-h-screen bg-[var(--color-marketing-bg)] text-[var(--color-marketing-ink)]"
        >
          <a
            href="#come-funziona"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:bg-[var(--color-marketing-bg)] focus:text-[var(--color-marketing-primary)] focus:px-4 focus:py-2 focus:rounded-lg"
          >
            Vai al contenuto
          </a>
          <MarketingNav />
          <main className="relative z-[2]">{children}</main>
          <Footer />
          <Grain opacity={0.045} blendMode="multiply" zIndex={1} />
        </div>
      </LenisProvider>
    </PersonaProvider>
  );
}
