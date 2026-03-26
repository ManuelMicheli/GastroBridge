import type { Metadata } from "next";
import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Prezzi",
  description: "Scegli il piano GastroBridge ideale per il tuo ristorante o la tua attivita di fornitura Ho.Re.Ca.",
};

export default function PricingPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-display text-charcoal mb-4">
            Prezzi semplici e trasparenti
          </h1>
          <p className="text-sage text-lg max-w-xl mx-auto">
            Scegli il piano adatto alla tua attivita. Inizia gratis, cresci quando vuoi.
          </p>
        </div>
        <PricingTable />
      </div>
    </div>
  );
}
