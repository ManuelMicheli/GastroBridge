import type { ReactNode } from "react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { Footer } from "@/components/layout/footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  );
}
