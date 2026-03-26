"use client";

import { Search, ShoppingCart, TrendingDown } from "lucide-react";
import { motion } from "motion/react";

const STEPS = [
  {
    icon: Search,
    step: "01",
    title: "Cerca e Confronta",
    description:
      "Cerca qualsiasi prodotto e confronta prezzi da tutti i fornitori della tua zona in tempo reale.",
  },
  {
    icon: ShoppingCart,
    step: "02",
    title: "Carrello Smart",
    description:
      "Aggiungi prodotti da fornitori diversi. Il carrello raggruppa automaticamente gli ordini per fornitore.",
  },
  {
    icon: TrendingDown,
    step: "03",
    title: "Risparmia Ogni Giorno",
    description:
      "Ricevi alert quando i prezzi scendono e scopri alternative piu convenienti per i tuoi prodotti.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display text-charcoal mb-4">
            Come funziona
          </h2>
          <p className="text-sage text-lg max-w-xl mx-auto">
            Confronta. Ordina. Risparmia. In tre semplici passi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((item, i) => (
            <motion.div
              key={item.step}
              className="relative bg-cream rounded-2xl p-8 text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-forest-light rounded-xl mb-5">
                <item.icon className="h-7 w-7 text-forest" />
              </div>
              <div className="text-xs font-mono text-sage mb-2 uppercase tracking-widest">
                Passo {item.step}
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-3">
                {item.title}
              </h3>
              <p className="text-sage leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
