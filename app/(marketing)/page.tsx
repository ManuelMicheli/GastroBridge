import { SplitHero } from "@/components/marketing/split-hero";
import { TickerBar } from "@/components/marketing/_primitives/ticker-bar";
import { PromiseSection } from "@/components/marketing/promise";
import { Mechanism } from "@/components/marketing/mechanism";
import { Proof } from "@/components/marketing/proof";
import { PricingReveal } from "@/components/marketing/pricing-reveal";
import { Objections } from "@/components/marketing/objections";
import { Closer } from "@/components/marketing/closer";
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
      <Objections />
      <Closer />
    </>
  );
}
