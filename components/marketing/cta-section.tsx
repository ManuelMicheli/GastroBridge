"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { gsap, SplitText } from "@/lib/gsap-config";

export function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Split text reveal
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0, y: 50, rotationX: 90 },
          {
            opacity: 1,
            y: 0,
            rotationX: 0,
            stagger: 0.08,
            duration: 0.8,
            ease: "power4.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      // Subtitle + CTA fade in after headline
      gsap.fromTo(
        [subtitleRef.current, ctaRef.current],
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.15,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            once: true,
          },
        }
      );

      // Mesh gradient intensification
      const meshEl = sectionRef.current?.querySelector(".mesh-gradient");
      if (meshEl) {
        gsap.fromTo(
          meshEl,
          { opacity: 0.5 },
          {
            opacity: 1,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="cta-finale"
      className="relative py-32 px-4 overflow-hidden bg-forest-dark"
    >
      {/* Mesh gradient bg overlay */}
      <div className="absolute inset-0 mesh-gradient" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2
          ref={headlineRef}
          className="opacity-0 text-3xl sm:text-4xl lg:text-5xl font-display text-cream mb-6 leading-tight"
          style={{ perspective: "600px" }}
        >
          Il futuro della ristorazione inizia qui
        </h2>
        <p
          ref={subtitleRef}
          className="opacity-0 text-cream/70 text-lg mb-12 font-body max-w-xl mx-auto"
        >
          Unisciti a centinaia di professionisti Ho.Re.Ca. che stanno gia crescendo con noi.
        </p>
        <div ref={ctaRef} className="opacity-0 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-cream text-forest-dark hover:bg-cream/90 shadow-lg text-lg px-10"
            >
              Registra il tuo Ristorante <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/signup?role=supplier">
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-cream border border-cream/30 hover:bg-cream/10 text-lg px-10"
            >
              Diventa Fornitore
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
