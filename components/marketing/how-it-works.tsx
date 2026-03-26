"use client";

import { useRef, useEffect } from "react";
import { Hexagon, Circle, Triangle } from "lucide-react";
import { gsap } from "@/lib/gsap-config";

const STEPS = [
  {
    icon: Hexagon,
    step: "01",
    title: "Registrati",
    description: "Registrati e configura il profilo della tua attivita in pochi minuti.",
  },
  {
    icon: Circle,
    step: "02",
    title: "Cerca e Confronta",
    description: "Cerca, confronta prezzi e scopri i migliori fornitori della tua zona.",
  },
  {
    icon: Triangle,
    step: "03",
    title: "Ordina e Gestisci",
    description: "Ordina e gestisci tutto in un posto. Semplice, veloce, trasparente.",
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Cards stagger
      gsap.fromTo(
        cardsRef.current.filter(Boolean),
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.15,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            once: true,
          },
        }
      );

      // SVG line draw
      if (lineRef.current) {
        const length = lineRef.current.getTotalLength();
        gsap.set(lineRef.current, { strokeDasharray: length, strokeDashoffset: length });
        gsap.to(lineRef.current, {
          strokeDashoffset: 0,
          duration: 1.5,
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            once: true,
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="come-funziona" className="py-24 px-4 bg-forest-dark">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display text-cream mb-4">
            Come funziona
          </h2>
          <p className="text-cream/50 text-lg max-w-xl mx-auto font-body">
            Tre passi per trasformare i tuoi acquisti Ho.Re.Ca.
          </p>
        </div>

        {/* SVG connector line (desktop only) */}
        <div className="hidden lg:block relative">
          <svg
            className="absolute top-1/2 left-0 w-full h-1 -translate-y-1/2 z-0"
            viewBox="0 0 1000 2"
            preserveAspectRatio="none"
          >
            <path
              ref={lineRef}
              d="M 100 1 L 900 1"
              stroke="rgba(250,248,245,0.15)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
          {STEPS.map((item, i) => (
            <div
              key={item.step}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="gsap-reveal relative rounded-2xl border border-cream/10 bg-forest-dark/50 p-8 backdrop-blur-sm"
            >
              {/* Watermark number */}
              <span className="absolute top-4 right-6 text-7xl font-display text-cream/[0.06] select-none">
                {item.step}
              </span>

              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-orange/10 mb-5">
                  <item.icon className="h-6 w-6 text-accent-orange" />
                </div>
                <h3 className="text-xl font-display text-cream mb-3">{item.title}</h3>
                <p className="text-cream/70 font-body leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
