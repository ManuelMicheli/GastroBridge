"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { gsap } from "@/lib/gsap-config";

const NAV_LINKS = [
  { href: "#come-funziona", label: "Come Funziona", type: "anchor" as const },
  { href: "#per-chi", label: "Per Chi", type: "anchor" as const },
  { href: "/pricing", label: "Prezzi", type: "page" as const },
  { href: "#faq", label: "FAQ", type: "anchor" as const },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // Compact on scroll
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    const sectionIds = NAV_LINKS.filter((l) => l.type === "anchor").map((l) =>
      l.href.replace("#", "")
    );
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -40% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    setMobileOpen(false);
    const target = document.querySelector(href);
    if (target) {
      gsap.to(window, {
        scrollTo: { y: target, offsetY: 80 },
        duration: 1,
        ease: "power3.inOut",
      });
    }
  }

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-forest-dark/95 backdrop-blur-xl h-14"
          : "bg-forest-dark/80 backdrop-blur-xl h-16"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-full">
        <Link href="/" className="flex items-center">
          <span className="text-xl font-display text-cream">Gastro</span>
          <span className="text-xl font-body font-bold text-accent-green">Bridge</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) =>
            link.type === "anchor" ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className={cn(
                  "text-sm text-cream/70 hover:text-cream transition-colors",
                  activeSection === link.href.replace("#", "") && "text-cream"
                )}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-cream/70 hover:text-cream transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-cream/70 hover:text-cream hover:bg-cream/10"
            >
              Accedi
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="bg-cream text-forest-dark hover:bg-cream/90"
            >
              Inizia Gratis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-cream"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile full-screen overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-forest-dark z-40 flex flex-col items-center justify-center gap-8">
          {NAV_LINKS.map((link, i) =>
            link.type === "anchor" ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className="text-2xl font-display text-cream hover:text-accent-green transition-colors"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-2xl font-display text-cream hover:text-accent-green transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <div className="flex gap-4 mt-8">
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button
                variant="ghost"
                size="lg"
                className="text-cream border border-cream/20 hover:bg-cream/10"
              >
                Accedi
              </Button>
            </Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)}>
              <Button size="lg" className="bg-cream text-forest-dark hover:bg-cream/90">
                Registrati
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
