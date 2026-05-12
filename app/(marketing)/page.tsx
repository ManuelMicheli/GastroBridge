import { SplitHero } from "@/components/marketing/split-hero";
import { TickerBar } from "@/components/marketing/_primitives/ticker-bar";
import { PromiseSection } from "@/components/marketing/promise";
import { Mechanism } from "@/components/marketing/mechanism";
import { GrowthGrid } from "@/components/marketing/growth-grid";
import { DualSection } from "@/components/marketing/dual-section";
import { Principles } from "@/components/marketing/principles";
import { Testimonials } from "@/components/marketing/testimonials";
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
      <GrowthGrid />
      <SectionRule />
      <DualSection />
      <SectionRule />
      <Principles />
      <SectionRule />
      <Testimonials />
      <SectionRule />
      <FAQ />
      <SectionRule />
      <CTASection />
    </>
  );
}
