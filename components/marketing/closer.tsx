"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap, SplitText } from "@/lib/gsap-config";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona } from "@/lib/marketing-persona-context";
import { useMagnetic } from "@/lib/hooks/use-magnetic";
import { Grain } from "./_primitives/grain";

const HEADLINE = "Pronto a smettere di telefonare?";

export function Closer() {
  const sectionRef = useRef<HTMLElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const ctaPrimaryRef = useMagnetic<HTMLAnchorElement>({ strength: 0.3, radius: 110 });
  const { persona, setPersona } = usePersona();

  useEffect(() => {
    if (prefersReducedMotion()) {
      [yearRef, subRef, ctaRef, footRef].forEach((r) => {
        if (r.current) r.current.style.opacity = "1";
      });
      if (headlineRef.current) headlineRef.current.style.opacity = "1";
      return;
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: MOTION.easeEditorial },
        scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true },
      });

      tl.fromTo(
        yearRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealShort },
        0
      );

      if (headlineRef.current) {
        gsap.set(headlineRef.current, { opacity: 1 });
        const split = new SplitText(headlineRef.current, { type: "words" });
        tl.fromTo(
          split.words,
          { opacity: 0, y: 56, rotateX: 45 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            stagger: MOTION.stagger.block,
            duration: MOTION.duration.revealLong,
            ease: MOTION.easeDramatic,
          },
          0.1
        );
      }

      tl.fromTo(
        subRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealBase },
        "-=0.4"
      );
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealBase },
        "-=0.5"
      );
      tl.fromTo(
        footRef.current,
        { opacity: 0 },
        { opacity: 1, duration: MOTION.duration.revealShort },
        "-=0.25"
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const restaurantActive = persona === "restaurant";
  const supplierActive = persona === "supplier";

  return (
    <section
      ref={sectionRef}
      id="cta-finale"
      data-force-dark="true"
      className="relative overflow-hidden"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "clamp(120px, 16vw, 220px)",
        paddingBottom: "clamp(96px, 12vw, 180px)",
      }}
    >
      <Grain opacity={0.18} blendMode="overlay" zIndex={0} />

      <div className="relative z-[1] mx-auto max-w-[72rem]">
        <div
          ref={yearRef}
          className="opacity-0 flex items-center gap-4 mb-[clamp(40px,6vw,80px)]"
        >
          <span
            aria-hidden
            className="inline-block h-px"
            style={{ width: 64, background: "var(--color-marketing-ink-subtle)" }}
          />
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.22em",
              color: "var(--color-marketing-ink-subtle)",
            }}
          >
            2026 · GBR · CHIUSURA
          </span>
        </div>

        <h2
          ref={headlineRef}
          className="font-display opacity-0"
          style={{
            fontSize: "clamp(56px, 10vw, 160px)",
            lineHeight: "0.94",
            letterSpacing: "-0.03em",
            color: "var(--color-marketing-ink)",
            perspective: "800px",
          }}
        >
          {HEADLINE.split(" ").map((w, i, arr) => (
            <span key={i} className="inline-block">
              {w}
              {i < arr.length - 1 ? " " : ""}
              {(w === "Pronto" || w === "smettere") && i < arr.length - 1 && <br />}
            </span>
          ))}
        </h2>

        <p
          ref={subRef}
          className="opacity-0 mt-[clamp(32px,4vw,56px)] max-w-[52ch]"
          style={{
            fontSize: "var(--type-marketing-pull)",
            lineHeight: "var(--type-marketing-pull-lh)",
            color: "var(--color-marketing-ink-muted)",
            fontFamily: "var(--font-display)",
          }}
        >
          Cinque minuti per registrarti. Due settimane per capire se ti stiamo
          restituendo tempo. Nessuna carta, nessun contratto.
        </p>

        <div
          ref={ctaRef}
          className="opacity-0 mt-[clamp(40px,5vw,72px)] flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8"
        >
          <Link
            ref={ctaPrimaryRef}
            href="/signup?role=restaurant"
            onClick={() => setPersona("restaurant")}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = restaurantActive ? "var(--color-marketing-primary)" : "transparent")}
            className="inline-flex items-center gap-3 rounded-full px-8 py-4 text-[14px] tracking-wide will-change-transform"
            style={{
              background: restaurantActive ? "var(--color-marketing-primary)" : "transparent",
              color: restaurantActive ? "var(--color-marketing-on-primary)" : "var(--color-marketing-ink)",
              border: restaurantActive ? "1px solid transparent" : "1px solid var(--color-marketing-rule-strong)",
              transition: "background-color 240ms cubic-bezier(0.16, 1, 0.3, 1), color 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            Crea account ristoratore
            <span aria-hidden>→</span>
          </Link>

          <span
            aria-hidden
            className="hidden sm:block"
            style={{ height: 28, width: 1, background: "var(--color-marketing-rule-strong)" }}
          />

          <Link
            href="/signup?role=supplier"
            onClick={() => setPersona("supplier")}
            data-side="supplier"
            className="inline-flex items-center gap-3 rounded-full px-8 py-4 text-[14px] tracking-wide"
            style={{
              background: supplierActive ? "var(--color-marketing-primary)" : "transparent",
              color: supplierActive ? "var(--color-marketing-on-primary)" : "var(--color-marketing-ink)",
              border: supplierActive ? "1px solid transparent" : "1px solid var(--color-marketing-rule-strong)",
              transition: "background-color 240ms cubic-bezier(0.16, 1, 0.3, 1), color 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = supplierActive ? "var(--color-marketing-primary)" : "transparent")}
          >
            Crea account fornitore
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div
          ref={footRef}
          className="opacity-0 mt-[clamp(48px,7vw,96px)] flex flex-wrap items-center gap-x-6 gap-y-3 font-mono uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.22em",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          <span>90 secondi</span>
          <span aria-hidden className="opacity-50">·</span>
          <span>senza carta</span>
          <span aria-hidden className="opacity-50">·</span>
          <span>zero impegno</span>
        </div>

        <hr
          className="mt-[clamp(72px,9vw,144px)] border-0 border-t"
          style={{ borderColor: "var(--color-marketing-rule)" }}
        />
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-4 font-mono uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.22em",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          <span>GBR · Bologna · 2026</span>
          <span aria-hidden>—</span>
        </div>
      </div>
    </section>
  );
}
