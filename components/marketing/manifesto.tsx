"use client";

import { useRef, useEffect } from "react";
import { gsap, SplitText } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

export function Manifesto() {
  const sectionRef = useRef<HTMLElement>(null);
  const paraRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = paraRef.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.style.opacity = "1";
      return;
    }

    const ctx = gsap.context(() => {
      const split = new SplitText(el, { type: "lines", linesClass: "mf-line" });
      gsap.set(el, { opacity: 1 });
      gsap.fromTo(
        split.lines,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealLong,
          stagger: MOTION.stagger.line,
          ease: MOTION.easeEditorial,
          scrollTrigger: {
            trigger: el,
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
      id="manifesto"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10">
        <div className="col-span-12 lg:col-span-4">
          <EditorialEyebrow number="— 01">MANIFESTO</EditorialEyebrow>
          <p
            className="mt-8 font-mono uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "var(--color-marketing-ink-subtle)",
              lineHeight: 1.7,
            }}
          >
            Scritto a Milano,
            <br />
            nell&apos;inverno del 2024.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-[clamp(24px,3vw,40px)]">
          <p
            ref={paraRef}
            className="font-display opacity-0"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            GastroBridge è la rete che unisce chi cucina a chi rifornisce.{" "}
            <span style={{ color: "var(--color-marketing-primary)" }}>In Italia.</span>{" "}
            Senza intermediari, senza filtri, senza costi nascosti.
          </p>
          <p
            className="max-w-[60ch]"
            style={{
              fontSize: "var(--type-marketing-body)",
              lineHeight: "var(--type-marketing-body-lh)",
              color: "var(--color-marketing-ink-muted)",
            }}
          >
            Siamo nati perché la filiera Ho.Re.Ca. italiana ha troppi
            passaggi e troppo poca trasparenza. Un ristoratore passa in
            media quattro ore a settimana al telefono con i fornitori.
            Un fornitore perde ordini perché il suo listino è chiuso in
            un PDF. Tutto questo è lavoro senza valore, tempo che non
            finisce in cucina.
          </p>
          <p
            className="max-w-[60ch]"
            style={{
              fontSize: "var(--type-marketing-body)",
              lineHeight: "var(--type-marketing-body-lh)",
              color: "var(--color-marketing-ink-muted)",
            }}
          >
            La nostra risposta è una cosa sola: una piattaforma che
            mette entrambe le parti nella stessa stanza, con prezzi
            vivi e ordini tracciati. Niente commissioni ai ristoratori,
            niente intermediazione, niente conflitti d&apos;interesse.
          </p>
        </div>
      </div>
    </section>
  );
}
