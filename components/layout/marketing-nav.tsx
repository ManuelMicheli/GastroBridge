"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { AnimatePresence, motion } from "motion/react";

const NAV_LINKS = [
  { href: "/pricing", label: "Prezzi" },
  { href: "/per-fornitori", label: "Per i Fornitori" },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-md border-b border-sage-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center">
          <span className="text-xl font-display text-charcoal">Gastro</span>
          <span className="text-xl font-body font-bold text-forest">Bridge</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-charcoal hover:text-forest transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Accedi</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">
              Inizia Gratis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-cream border-b border-sage-muted/30"
          >
            <div className="px-4 py-4 space-y-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block py-2 text-charcoal hover:text-forest"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-3 pt-2">
                <Link href="/login" className="flex-1">
                  <Button variant="secondary" className="w-full" size="sm">Accedi</Button>
                </Link>
                <Link href="/signup" className="flex-1">
                  <Button className="w-full" size="sm">Registrati</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
