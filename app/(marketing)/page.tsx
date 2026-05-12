import { SplitHero } from "@/components/marketing/split-hero";
import { TickerBar } from "@/components/marketing/_primitives/ticker-bar";
import { PromiseSection } from "@/components/marketing/promise";
import { Mechanism } from "@/components/marketing/mechanism";
import { Proof } from "@/components/marketing/proof";
import { PricingReveal } from "@/components/marketing/pricing-reveal";
import { DualSection } from "@/components/marketing/dual-section";
import { Principles } from "@/components/marketing/principles";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/cta-section";
import { SectionRule } from "@/components/marketing/_primitives/section-rule";

export default function HomePage() {
  return (
    <>
      <SplitHero />
      <TickerBar />
      <PromiseSection />
      <SectionRule />
      <Mechanism />
      <SectionRule />
      <Proof />
      <SectionRule />
      <PricingReveal />
      <SectionRule />
      <DualSection />
      <SectionRule />
      <Principles />
      <SectionRule />
      <FAQ />
      <SectionRule />
      <CTASection />
    </>
  );
}
