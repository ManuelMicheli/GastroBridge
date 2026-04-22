import type { Metadata } from "next";
import { PricingTable } from "@/components/marketing/pricing-table";
import { EditorialEyebrow } from "@/components/marketing/_primitives/editorial-eyebrow";
import { SectionRule } from "@/components/marketing/_primitives/section-rule";

export const metadata: Metadata = {
  title: "Prezzi",
  description:
    "Scegli il piano GastroBridge adatto al tuo ristorante o alla tua attività di fornitura Ho.Re.Ca.",
};

export default function PricingPage() {
  return (
    <>
      <section
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
          paddingTop: "clamp(160px, 18vw, 240px)",
          paddingBottom: "var(--rhythm-section)",
        }}
      >
        <div className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10">
          <div className="col-span-12 lg:col-span-4">
            <EditorialEyebrow number="— 01">PIANI</EditorialEyebrow>
          </div>
          <h1
            className="col-span-12 lg:col-span-8 font-display"
            style={{
              fontSize: "var(--type-marketing-display)",
              lineHeight: "var(--type-marketing-display-lh)",
              letterSpacing: "var(--type-marketing-display-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Prezzi chiari.
            <br />
            Nessuna sorpresa.
          </h1>
          <p
            className="col-span-12 lg:col-span-6 lg:col-start-5"
            style={{
              fontSize: "var(--type-marketing-body)",
              lineHeight: "var(--type-marketing-body-lh)",
              color: "var(--color-marketing-ink-muted)",
              maxWidth: "56ch",
              marginTop: "clamp(16px, 2vw, 32px)",
            }}
          >
            Scegli il piano che serve oggi. Puoi cambiarlo quando vuoi, senza
            penali.
          </p>
        </div>
      </section>

      <SectionRule />

      <section
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
          paddingTop: "var(--rhythm-section)",
          paddingBottom: "var(--rhythm-section)",
        }}
      >
        <PricingTable />
      </section>
    </>
  );
}
