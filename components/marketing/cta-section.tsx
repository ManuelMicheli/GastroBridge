"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";

export function CTASection() {
  return (
    <section className="py-20 px-4">
      <motion.div
        className="max-w-4xl mx-auto bg-forest rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-forest-dark/30 rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-forest-dark/20 rounded-full" />

        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl font-display text-white mb-4">
            Pronto a risparmiare sui tuoi ordini?
          </h2>
          <p className="text-forest-light text-lg mb-10 max-w-xl mx-auto">
            Unisciti a centinaia di ristoratori e fornitori che hanno gia scelto GastroBridge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto bg-white text-forest hover:bg-cream">
                Registrati Gratis
              </Button>
            </Link>
            <Link href="/signup?role=supplier">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-forest"
              >
                Sei un Fornitore?
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
