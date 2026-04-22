"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

const STEPS = [
  {
    step: "01",
    title: "Registri.",
    description:
      "Apri il profilo della tua attività in meno di cinque minuti. Verifichiamo P.IVA e dati fiscali in modo automatico. Nessun contratto, nessun vincolo: quando vuoi, esci.",
    meta: "≈ 5 minuti",
  },
  {
    step: "02",
    title: "Confronti.",
    description:
      "Cerchi per categoria, zona di consegna e tempi di ritorno. Confronti prezzi in tempo reale tra fornitori verificati e leggi recensioni di ristoratori come te. Nessun filtro nascosto sui risultati.",
    meta: "Prezzi vivi",
  },
  {
    step: "03",
    title: "Ordini.",
    description:
      "Crei l'ordine in pochi click, paghi con Stripe, ricevi conferma e traccia della consegna. Gestisci resi, fatture e spesa mensile dalla stessa dashboard — senza telefonate.",
    meta: "Consegne tracciate",
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const els = itemsRef.current.filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    if (prefersReducedMotion()) {
      els.forEach((el) => (el.style.opacity = "1"));
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: MOTION.stagger.block,
          ease: MOTION.easeEditorial,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: MOTION.scrollTrigger.defaultStart,
            once: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="come-funziona"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]">
        <div className="col-span-12 lg:col-span-4">
          <EditorialEyebrow number="— 03">COME FUNZIONA</EditorialEyebrow>
        </div>
        <h2
          className="col-span-12 lg:col-span-8 font-display"
          style={{
            fontSize: "var(--type-marketing-h2)",
            lineHeight: "var(--type-marketing-h2-lh)",
            letterSpacing: "var(--type-marketing-h2-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          Tre passi.
          <br />
          Un flusso senza frizione.
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3">
        {STEPS.map((item, i) => (
          <div
            key={item.step}
            ref={(el) => {
              itemsRef.current[i] = el;
            }}
            className="relative opacity-0 py-10 lg:py-0 lg:px-8 first:lg:pl-0 last:lg:pr-0"
            style={{
              borderTop: i !== 0 ? "1px solid var(--color-marketing-rule)" : undefined,
            }}
          >
            <div
              aria-hidden
              className="hidden lg:block absolute top-0 bottom-0 left-0"
              style={{
                width: i === 0 ? 0 : "1px",
                background: "var(--color-marketing-rule)",
              }}
            />

            <p
              className="font-mono tracking-[0.15em] mb-8"
              style={{
                fontSize: "11px",
                color: "var(--color-marketing-primary)",
              }}
            >
              {item.step} / 03
            </p>
            <h3
              className="font-display mb-6"
              style={{
                fontSize: "clamp(32px, 3.4vw, 48px)",
                lineHeight: "1.05",
                letterSpacing: "-0.018em",
                color: "var(--color-marketing-ink)",
              }}
            >
              {item.title}
            </h3>
            <p
              className="max-w-[38ch]"
              style={{
                fontSize: "var(--type-marketing-body)",
                lineHeight: "var(--type-marketing-body-lh)",
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {item.description}
            </p>
            <p
              className="mt-8 font-mono uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.2em",
                color: "var(--color-marketing-ink-subtle)",
              }}
            >
              — {item.meta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
