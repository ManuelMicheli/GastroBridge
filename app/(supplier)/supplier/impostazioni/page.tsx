import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { MapPin, CreditCard, Settings, ChevronRight, Warehouse } from "lucide-react";

export const metadata: Metadata = { title: "Impostazioni Fornitore" };

export default function SupplierSettingsPage() {
  const sections = [
    { href: "/supplier/impostazioni/sedi", label: "Sedi / Magazzini", description: "Gestisci i magazzini e la sede principale", icon: Warehouse },
    { href: "/supplier/impostazioni/zone", label: "Zone di Consegna", description: "Gestisci province e CAP di consegna", icon: MapPin },
    { href: "/supplier/impostazioni/abbonamento", label: "Abbonamento", description: "Piano e fatturazione", icon: CreditCard },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Impostazioni</h1>
      <div className="space-y-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="hover:shadow-elevated transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sage-muted/20 rounded-xl">
                  <s.icon className="h-5 w-5 text-forest" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-charcoal">{s.label}</h3>
                  <p className="text-sm text-sage">{s.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-sage" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
