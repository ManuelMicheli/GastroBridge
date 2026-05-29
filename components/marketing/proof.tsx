"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

// v1 — "Perché GBR". Trust built on verifiable product facts, not vanity
// metrics or fabricated testimonials. Every claim here is a real condition.
type Guarantee = {
  mark: string;
  title: string;
  caption: string;
};

const GUARANTEES: readonly Guarantee[] = [
  {
    mark: "0%",
    title: "Commissioni",
    caption: "Zero percentuali su ogni ordine. Paghi il canone, non le transazioni.",
  },
  {
    mark: "NO",
    title: "Lock-in",
    caption: "Esporti storico ordini e fatture in CSV/PDF quando vuoi. Niente gabbia.",
  },
  {
    mark: "7gg",
    title: "Rimborso garantito",
    caption: "Mediazione GBR sulle dispute. Fornitore inadempiente sospeso dalla rete.",
  },
  {
    mark: "GDPR",
    title: "I dati sono tuoi",
    caption: "Mai rivenduti, mai profilati cross-platform. Esporti o cancelli in ogni momento.",
  },
  {
    mark: "STRIPE",
    title: "Pagamenti + fisco",
    caption: "Stripe incassa, la fattura va al cassetto fiscale, la riconciliazione è automatica.",
  },
  {
    mark: "NO",
    title: "Esclusiva",
    caption: "Tieni i tuoi fornitori storici. Usaci per le categorie che vuoi, libero di uscire.",
  },
] as const;

export function Proof() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      headRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      gridRef.current?.querySelectorAll<HTMLElement>("[data-cell]").forEach((el) => (el.style.opacity = "1"));
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headRef.current?.querySelectorAll("[data-reveal]") ?? [],
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: MOTION.stagger.block,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true },
        }
      );
      gsap.fromTo(
        gridRef.current?.querySelectorAll("[data-cell]") ?? [],
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: 0.08,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: gridRef.current, start: "top 82%", once: true },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="perche"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
        background: "var(--color-marketing-bg)",
      }}
    >
      <div
        ref={headRef}
        className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]"
      >
        <div data-reveal className="col-span-12 lg:col-span-4 opacity-0">
          <EditorialEyebrow number="— 03">PERCHÉ GBR</EditorialEyebrow>
        </div>
        <h2
          data-reveal
          className="col-span-12 lg:col-span-8 font-display opacity-0"
          style={{
            fontSize: "var(--type-marketing-h2)",
            lineHeight: "var(--type-marketing-h2-lh)",
            letterSpacing: "var(--type-marketing-h2-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          Le condizioni,
          <br />
          <span style={{ color: "var(--color-marketing-ink-muted)" }}>nere su bianco.</span>
        </h2>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "var(--color-marketing-rule)" }}>
        {GUARANTEES.map((g) => (
          <div
            key={g.title}
            data-cell
            className="opacity-0 flex flex-col justify-between"
            style={{
              background: "var(--color-marketing-bg)",
              padding: "clamp(28px, 3vw, 48px)",
              minHeight: "clamp(220px, 20vw, 300px)",
            }}
          >
            <span
              className="font-display leading-none"
              style={{
                fontSize: "clamp(40px, 4.5vw, 72px)",
                letterSpacing: "var(--type-marketing-display-ls)",
                color: "var(--color-marketing-primary)",
              }}
            >
              {g.mark}
            </span>
            <div className="mt-8">
              <p
                className="font-mono uppercase mb-3"
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.14em",
                  color: "var(--color-marketing-ink)",
                }}
              >
                {g.title}
              </p>
              <p
                className="max-w-[34ch]"
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--color-marketing-ink-muted)",
                }}
              >
                {g.caption}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
