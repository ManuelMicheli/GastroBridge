"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  MousePointerClick,
  Truck,
  Store,
  ClipboardList,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { gsap } from "@/lib/gsap-config";

const RISTORATORI_BULLETS = [
  { icon: BarChart3, text: "Confronta prezzi in tempo reale" },
  { icon: ShieldCheck, text: "Scopri fornitori verificati" },
  { icon: MousePointerClick, text: "Ordina con un click" },
  { icon: Truck, text: "Monitora consegne e spese" },
];

const FORNITORI_BULLETS = [
  { icon: Store, text: "Vetrina prodotti professionale" },
  { icon: ClipboardList, text: "Gestione ordini centralizzata" },
  { icon: TrendingUp, text: "Analytics e insights" },
  { icon: Sparkles, text: "Crescita garantita" },
];

export function DualSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      if (leftRef.current) {
        gsap.to(leftRef.current, {
          yPercent: -5,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (rightRef.current) {
        gsap.to(rightRef.current, {
          yPercent: 5,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      const layer1 = sectionRef.current?.querySelectorAll("[data-depth='1']");
      const layer3 = sectionRef.current?.querySelectorAll("[data-depth='3']");

      if (layer1?.length) {
        gsap.to(layer1, {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (layer3?.length) {
        gsap.to(layer3, {
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="per-chi"
      className="min-h-[80vh] flex flex-col lg:flex-row overflow-hidden"
    >
      {/* Left — Ristoratori (cream) */}
      <div
        ref={leftRef}
        className="flex-1 bg-cream px-8 py-20 lg:px-16 lg:py-28 flex items-center"
      >
        <div className="max-w-lg mx-auto lg:ml-auto lg:mr-16">
          <p
            data-depth="1"
            className="text-sm font-semibold uppercase tracking-[0.15em] text-terracotta mb-4"
          >
            Per Ristoratori
          </p>
          <h2 className="text-3xl sm:text-4xl font-display text-forest mb-8 leading-tight">
            Trova i migliori fornitori per la tua cucina
          </h2>
          <ul className="space-y-4 mb-10">
            {RISTORATORI_BULLETS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-charcoal/80 font-body">
                <div data-depth="3" className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-4 h-4 text-forest" />
                </div>
                {b.text}
              </li>
            ))}
          </ul>
          <Link href="/signup">
            <Button size="lg" className="bg-forest text-cream hover:bg-forest-dark">
              Registra il tuo Ristorante <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Right — Fornitori (forest dark) */}
      <div
        ref={rightRef}
        className="flex-1 bg-forest-dark px-8 py-20 lg:px-16 lg:py-28 flex items-center"
      >
        <div className="max-w-lg mx-auto lg:mr-auto lg:ml-16">
          <p
            data-depth="1"
            className="text-sm font-semibold uppercase tracking-[0.15em] text-accent-orange mb-4"
          >
            Per Fornitori
          </p>
          <h2 className="text-3xl sm:text-4xl font-display text-cream mb-8 leading-tight">
            Raggiungi centinaia di nuovi clienti
          </h2>
          <ul className="space-y-4 mb-10">
            {FORNITORI_BULLETS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-cream/80 font-body">
                <div data-depth="3" className="w-8 h-8 rounded-lg bg-cream/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-4 h-4 text-cream" />
                </div>
                {b.text}
              </li>
            ))}
          </ul>
          <Link href="/signup?role=supplier">
            <Button size="lg" className="bg-cream text-forest-dark hover:bg-cream/90">
              Diventa Fornitore <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
