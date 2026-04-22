import { Hero } from "@/components/marketing/hero";
import { Manifesto } from "@/components/marketing/manifesto";
import { GrowthGrid } from "@/components/marketing/growth-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Capabilities } from "@/components/marketing/capabilities";
import { DualSection } from "@/components/marketing/dual-section";
import { Principles } from "@/components/marketing/principles";
import { Testimonials } from "@/components/marketing/testimonials";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/cta-section";
import { SectionRule } from "@/components/marketing/_primitives/section-rule";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionRule />
      <Manifesto />
      <SectionRule />
      <GrowthGrid />
      <SectionRule />
      <HowItWorks />
      <SectionRule />
      <Capabilities />
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
