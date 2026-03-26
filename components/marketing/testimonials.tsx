"use client";

import { motion } from "motion/react";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Marco Bianchi",
    role: "Chef, Trattoria Da Marco",
    city: "Milano",
    quote: "Da quando uso GastroBridge risparmio il 15% sugli acquisti mensili. Confrontare i prezzi e semplicissimo.",
    rating: 5,
  },
  {
    name: "Laura Rossi",
    role: "Titolare, Osteria del Ponte",
    city: "Bergamo",
    quote: "Finalmente un unico posto per gestire tutti i miei fornitori. Il carrello multi-fornitore e geniale.",
    rating: 5,
  },
  {
    name: "Giuseppe Verdi",
    role: "Food & Beverage Manager",
    city: "Torino",
    quote: "Gli alert sui prezzi mi hanno fatto scoprire fornitori locali che non conoscevo. Qualita superiore a prezzi migliori.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display text-charcoal mb-4">
            I ristoratori ne parlano
          </h2>
          <p className="text-sage text-lg">
            Scopri cosa dicono chi usa GastroBridge ogni giorno.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              className="bg-cream rounded-2xl p-8 relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Quote className="h-8 w-8 text-forest-light mb-4" />
              <p className="text-charcoal leading-relaxed mb-6">{t.quote}</p>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-terracotta text-terracotta" />
                ))}
              </div>
              <div>
                <p className="font-bold text-charcoal">{t.name}</p>
                <p className="text-sm text-sage">{t.role} — {t.city}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
