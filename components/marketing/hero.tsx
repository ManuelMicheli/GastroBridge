"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32 px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-forest-light/30 via-cream to-cream" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="success" className="mb-6 text-sm px-4 py-1.5">
            <span className="h-2 w-2 bg-forest rounded-full animate-pulse mr-2 inline-block" />
            Marketplace B2B Ho.Re.Ca.
          </Badge>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl lg:text-7xl font-display text-charcoal leading-[1.1] tracking-tight mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Tutti i tuoi fornitori.
          <br />
          <span className="text-forest">Un solo posto.</span>
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl text-sage max-w-2xl mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Confronta prezzi, scopri nuovi fornitori e gestisci gli ordini per il tuo
          ristorante da un&apos;unica piattaforma. Risparmia fino al 20% sugli acquisti.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto">
              Inizia Gratis <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              Scopri i Piani
            </Button>
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-sage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full bg-sage-muted border-2 border-cream"
                />
              ))}
            </div>
            <span>500+ ristoratori</span>
          </div>
          <div className="h-4 w-px bg-sage-muted hidden sm:block" />
          <span>150+ fornitori verificati</span>
          <div className="h-4 w-px bg-sage-muted hidden sm:block" />
          <span>Nord Italia</span>
        </motion.div>
      </div>
    </section>
  );
}
