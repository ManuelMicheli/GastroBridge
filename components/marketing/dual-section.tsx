"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { prefersReducedMotion } from "@/lib/marketing-motion";

const RISTORATORI_BULLETS = [
  "Prezzi a confronto in tempo reale",
  "Fornitori verificati della tua zona",
  "Ordini e consegne in un solo posto",
  "Spesa trasparente, senza sorprese",
];

const FORNITORI_BULLETS = [
  "Vetrina prodotti sempre aggiornata",
  "Gestione ordini centralizzata",
  "Analytics e insight di mercato",
  "Nuovi clienti senza costi di acquisizione",
];

export function DualSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px)", () => {
      if (leftRef.current) {
        gsap.to(leftRef.current, {
          yPercent: -4,
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
          yPercent: 4,
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
      className="relative flex flex-col lg:flex-row overflow-hidden"
    >
      {/* Hairline between panels (desktop) */}
      <div
        aria-hidden
        className="hidden lg:block absolute top-0 bottom-0 left-1/2"
        style={{ width: "1px", background: "var(--color-marketing-rule)" }}
      />

      {/* Left — Restaurant (bordeaux primary inherited) */}
      <div
        ref={leftRef}
        className="flex-1 flex items-center"
        style={{
          background: "var(--color-marketing-bg)",
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "clamp(24px, 4vw, 80px)",
          paddingTop: "var(--rhythm-section)",
          paddingBottom: "var(--rhythm-section)",
        }}
      >
        <div className="max-w-lg lg:ml-auto w-full">
          <EditorialEyebrow tone="primary" className="mb-6">PER RISTORATORI</EditorialEyebrow>
          <h2
            className="font-display mb-8"
            style={{
              fontSize: "clamp(36px, 4.2vw, 56px)",
              lineHeight: "1.02",
              letterSpacing: "-0.018em",
              color: "var(--color-marketing-ink)",
            }}
          >
            Un solo posto
            <br />
            per i tuoi fornitori.
          </h2>
          <p
            className="mb-10 max-w-[42ch]"
            style={{
              fontSize: "16px",
              lineHeight: "1.55",
              color: "var(--color-marketing-ink-muted)",
            }}
          >
            Dalla panetteria al pesce fresco, dal detergente professionale
            al vino. Cataloghi aggiornati ogni giorno, spesa tracciata,
            consegne verificate.
          </p>
          <ul className="space-y-4 mb-12">
            {RISTORATORI_BULLETS.map((b) => (
              <li
                key={b}
                className="flex items-baseline gap-4"
                style={{
                  fontSize: "var(--type-marketing-body)",
                  lineHeight: "var(--type-marketing-body-lh)",
                  color: "var(--color-marketing-ink)",
                }}
              >
                <span
                  aria-hidden
                  className="font-display"
                  style={{ color: "var(--color-marketing-primary)" }}
                >
                  —
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full px-6 py-3 text-[14px] tracking-wide transition-colors"
            style={{
              background: "var(--color-marketing-primary)",
              color: "var(--color-marketing-on-primary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary)")}
          >
            Registra il tuo ristorante →
          </Link>
        </div>
      </div>

      {/* Right — Supplier (amber accent via data-side) */}
      <div
        ref={rightRef}
        data-side="supplier"
        className="flex-1 flex items-center"
        style={{
          background: "var(--color-marketing-accent-warm-subtle)",
          paddingLeft: "clamp(24px, 4vw, 80px)",
          paddingRight: "var(--gutter-marketing)",
          paddingTop: "var(--rhythm-section)",
          paddingBottom: "var(--rhythm-section)",
        }}
      >
        <div className="max-w-lg lg:mr-auto w-full">
          <EditorialEyebrow tone="primary" className="mb-6">PER FORNITORI</EditorialEyebrow>
          <h2
            className="font-display mb-8"
            style={{
              fontSize: "clamp(36px, 4.2vw, 56px)",
              lineHeight: "1.02",
              letterSpacing: "-0.018em",
              color: "var(--color-marketing-ink)",
            }}
          >
            Clienti nuovi,
            <br />
            senza intermediari.
          </h2>
          <p
            className="mb-10 max-w-[42ch]"
            style={{
              fontSize: "16px",
              lineHeight: "1.55",
              color: "var(--color-marketing-ink-muted)",
            }}
          >
            Raggiungi ristoranti, hotel e catering della tua zona di
            consegna. Niente commissioni sulle vendite: il prezzo che
            fai al cliente è quello che incassi.
          </p>
          <ul className="space-y-4 mb-12">
            {FORNITORI_BULLETS.map((b) => (
              <li
                key={b}
                className="flex items-baseline gap-4"
                style={{
                  fontSize: "var(--type-marketing-body)",
                  lineHeight: "var(--type-marketing-body-lh)",
                  color: "var(--color-marketing-ink)",
                }}
              >
                <span
                  aria-hidden
                  className="font-display"
                  style={{ color: "var(--color-marketing-primary)" }}
                >
                  —
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/per-fornitori"
            className="inline-flex items-center rounded-full px-6 py-3 text-[14px] tracking-wide transition-colors"
            style={{
              background: "var(--color-marketing-primary)",
              color: "var(--color-marketing-on-primary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary)")}
          >
            Diventa fornitore →
          </Link>
        </div>
      </div>
    </section>
  );
}
