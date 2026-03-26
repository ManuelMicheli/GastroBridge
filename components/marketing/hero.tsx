"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { gsap, SplitText } from "@/lib/gsap-config";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Badge fade in
      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.6 },
        0.2
      );

      // Headline split text
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "words" });
        tl.fromTo(
          split.words,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 1 },
          0.4
        );
      }

      // Subtitle
      tl.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.4"
      );

      // CTAs
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.3"
      );

      // Stats
      tl.fromTo(
        statsRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6 },
        "-=0.2"
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
    >
      {/* Mesh gradient background */}
      <div className="absolute inset-0 mesh-gradient" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div ref={badgeRef} className="opacity-0 mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cream/20 text-cream/70 text-sm font-body">
            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
            La piattaforma Ho.Re.Ca. #1 in Italia
          </span>
        </div>

        {/* Headline */}
        <h1
          ref={headlineRef}
          className="opacity-0 font-display text-cream text-4xl sm:text-5xl lg:text-[5.5rem] leading-[1.1] tracking-tight mb-6"
        >
          Tutti i tuoi fornitori. Un solo posto.
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="opacity-0 text-cream/70 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-body"
        >
          Confronta prezzi, scopri fornitori e gestisci ordini per la tua attivita.
        </p>

        {/* CTAs */}
        <div ref={ctaRef} className="opacity-0 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-cream text-forest-dark hover:bg-cream/90 shadow-lg"
            >
              Inizia Gratis <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-cream border border-cream/30 hover:bg-cream/10"
            >
              Scopri i Piani
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div
          ref={statsRef}
          className="opacity-0 mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-cream/50"
        >
          <span>Nord Italia</span>
          <div className="h-4 w-px bg-cream/20 hidden sm:block" />
          <span>Gratis per Iniziare</span>
          <div className="h-4 w-px bg-cream/20 hidden sm:block" />
          <span>Supporto 24/7</span>
        </div>
      </div>
    </section>
  );
}
