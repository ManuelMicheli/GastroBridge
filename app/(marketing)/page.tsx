import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Categories } from "@/components/marketing/categories";
import { Testimonials } from "@/components/marketing/testimonials";
import { CTASection } from "@/components/marketing/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Categories />
      <Testimonials />
      <CTASection />
    </>
  );
}
