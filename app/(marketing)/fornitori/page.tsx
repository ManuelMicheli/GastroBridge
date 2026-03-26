import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Users, TrendingUp, Shield, BarChart3, Zap, Globe,
} from "lucide-react";
import { SUPPLIER_PLANS } from "@/lib/utils/constants";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Per i Fornitori",
  description: "Raggiungi centinaia di ristoratori nel Nord Italia. Gestisci catalogo, ordini e consegne da un'unica piattaforma.",
};

const BENEFITS = [
  {
    icon: Users,
    title: "Accesso a centinaia di ristoratori",
    description: "Raggiungi nuovi clienti nella tua zona di consegna senza costi di acquisizione.",
  },
  {
    icon: TrendingUp,
    title: "Crescita del fatturato",
    description: "I fornitori su GastroBridge vedono in media un +25% di ordini nei primi 3 mesi.",
  },
  {
    icon: Shield,
    title: "Badge Verificato",
    description: "Distinguiti dalla concorrenza con il badge di fornitore verificato e certificazioni.",
  },
  {
    icon: BarChart3,
    title: "Analytics dettagliati",
    description: "Monitora vendite, prodotti piu richiesti e trend del mercato in tempo reale.",
  },
  {
    icon: Zap,
    title: "Gestione ordini semplice",
    description: "Ricevi notifiche in tempo reale, conferma e gestisci gli ordini dal tuo dashboard.",
  },
  {
    icon: Globe,
    title: "Import CSV catalogo",
    description: "Carica il tuo catalogo completo in pochi secondi con l'import da file CSV.",
  },
];

export default function ForSuppliersPage() {
  return (
    <div>
      {/* Hero */}
      <section className="py-20 sm:py-28 px-4 bg-gradient-to-b from-forest-light/30 to-cream">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="success" className="mb-6">Per i Fornitori</Badge>
          <h1 className="text-4xl sm:text-5xl font-display text-charcoal leading-tight mb-6">
            Fai crescere la tua attivita
            <br />
            <span className="text-forest">con GastroBridge</span>
          </h1>
          <p className="text-lg text-sage max-w-2xl mx-auto mb-10">
            Raggiungi centinaia di ristoratori nel Nord Italia. Gestisci catalogo, ordini e consegne
            da un&apos;unica piattaforma professionale.
          </p>
          <Link href="/signup?role=supplier">
            <Button size="lg">
              Diventa Fornitore <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-display text-charcoal text-center mb-16">
            Perche scegliere GastroBridge
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="shrink-0 w-12 h-12 bg-forest-light rounded-xl flex items-center justify-center">
                  <b.icon className="h-6 w-6 text-forest" />
                </div>
                <div>
                  <h3 className="font-bold text-charcoal mb-1">{b.title}</h3>
                  <p className="text-sm text-sage leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-display text-charcoal text-center mb-4">
            Piani Fornitori
          </h2>
          <p className="text-sage text-center mb-12">
            Scegli il piano che fa per te e inizia a vendere.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SUPPLIER_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-8 shadow-card relative ${
                  plan.highlighted ? "ring-2 ring-forest shadow-elevated" : ""
                }`}
              >
                {plan.highlighted && (
                  <Badge variant="success" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Consigliato
                  </Badge>
                )}
                <h3 className="text-xl font-bold text-charcoal">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6 mt-2">
                  <span className="text-4xl font-mono font-bold">€{plan.price}</span>
                  <span className="text-sage">/{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-forest mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/signup?role=supplier&plan=${plan.id}`}>
                  <Button
                    variant={plan.highlighted ? "primary" : "secondary"}
                    className="w-full"
                  >
                    Scegli {plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
