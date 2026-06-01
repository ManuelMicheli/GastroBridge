"use client";

import { useEffect, useRef } from "react";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, canAnimate } from "@/lib/marketing-motion";

// v1 — "Perché GBR". Trust built on verifiable product facts, not vanity
// metrics or fabricated testimonials. Every claim here is a real condition.
type Guarantee = {
  mark: string;
  title: string;
  caption: string;
};

const GUARANTEES: readonly Guarantee[] = [
  {
    mark: "TUOI",
    title: "La tua rete, digitale",
    caption: "La rete di fornitori che hai costruito negli anni, ora in formato digitale. Stesse condizioni, stessi contatti, zero ricerche obbligate.",
  },
  {
    mark: "CSV",
    title: "Importazione assistita",
    caption: "Listini e cataloghi caricati da Excel o CSV, senza reinserimenti manuali. Una variazione di prezzo si applica a tutti gli ordini successivi.",
  },
  {
    mark: "90s",
    title: "Processo d'ordine rapido",
    caption: "Dalla consultazione del catalogo all'invio in circa novanta secondi. Ordini, storico e ricorrenti in un'unica interfaccia.",
  },
  {
    mark: "0%",
    title: "Canone fisso",
    caption: "Abbonamento a costo prevedibile, senza commissioni sul transato. La spesa non aumenta al crescere del volume d'ordine.",
  },
  {
    mark: "GDPR",
    title: "Conformità e riservatezza",
    caption: "Trattamento dei dati conforme al GDPR. Nessuna cessione a terzi, nessuna profilazione. Esportazione e cancellazione su richiesta.",
  },
  {
    mark: "NO",
    title: "Portabilità garantita",
    caption: "Storico ordini e listini esportabili in CSV o PDF in qualsiasi momento. Nessun vincolo contrattuale di permanenza.",
  },
] as const;

export function Proof() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const revealAll = () => {
      headRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      gridRef.current?.querySelectorAll<HTMLElement>("[data-cell]").forEach((el) => (el.style.opacity = "1"));
    };
    // Mobile / reduced-motion: show content immediately, never load GSAP.
    if (!canAnimate()) {
      revealAll();
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/gsap-config").then(({ gsap }) => {
      if (cancelled) return;
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
      cleanup = () => ctx.revert();
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
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
            <h3
              className="font-display"
              style={{
                fontSize: "clamp(26px, 2.8vw, 40px)",
                lineHeight: 1.04,
                letterSpacing: "-0.018em",
                color: "var(--color-marketing-primary)",
              }}
            >
              {g.title}
            </h3>
            <p
              className="mt-8 max-w-[34ch]"
              style={{
                fontSize: "14px",
                lineHeight: 1.55,
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {g.caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
