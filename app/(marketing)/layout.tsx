import type { ReactNode } from "react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { Footer } from "@/components/layout/footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
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
      <main>{children}</main>
      <Footer />
    </div>
  );
}
