"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, SplitText } from "@/lib/gsap-config";
import { EditorialImage } from "./_primitives/editorial-image";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { MARKETING_IMAGERY } from "@/lib/marketing-imagery";
import { usePersona } from "@/lib/marketing-persona-context";

export function Interlude() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const { persona } = usePersona();

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      [headRef, footRef].forEach((r) => r.current && (r.current.style.opacity = "1"));
      return;
    }
    const splits: SplitText[] = [];
    const ctx = gsap.context(() => {
      if (headRef.current) {
        gsap.set(headRef.current, { opacity: 1 });
        const split = new SplitText(headRef.current, { type: "lines", linesClass: "ilde-line" });
        splits.push(split);
        gsap.fromTo(
          split.lines,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealLong,
            stagger: MOTION.stagger.line,
            ease: MOTION.easeEditorial,
            scrollTrigger: { trigger: sectionRef.current, start: "top 72%", once: true },
          }
        );
      }
      if (footRef.current) {
        gsap.fromTo(
          footRef.current.querySelectorAll<HTMLElement>("[data-foot]"),
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealBase,
            stagger: 0.08,
            ease: MOTION.easeEditorial,
            scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
          }
        );
      }
    }, sectionRef);
    return () => {
      splits.forEach((s) => {
        try {
          s.revert();
        } catch {
          /* noop */
        }
      });
      ctx.revert();
    };
  }, []);

  const pullLine =
    persona === "supplier"
      ? "Una rete che porta i tuoi listini ovunque."
      : "Una rete che mette la materia prima a portata di click.";

  return (
    <section
      ref={sectionRef}
      id="interlude"
      className="relative"
      style={{
        paddingTop: "var(--rhythm-block)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div
        className="grid grid-cols-12 gap-y-8 gap-x-6 lg:gap-x-10 mb-[clamp(36px,5vw,72px)]"
        style={{ paddingLeft: "var(--gutter-marketing)", paddingRight: "var(--gutter-marketing)" }}
      >
        <div className="col-span-12 lg:col-span-3">
          <EditorialEyebrow number="— ⌗">INTERMEZZO</EditorialEyebrow>
        </div>
        <h2
          ref={headRef}
          className="col-span-12 lg:col-span-9 font-display opacity-0"
          style={{
            fontSize: "var(--type-marketing-h2)",
            lineHeight: "var(--type-marketing-h2-lh)",
            letterSpacing: "var(--type-marketing-h2-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          La materia prima
          <br />
          <span style={{ color: "var(--color-marketing-ink-muted)" }}>
            non passa più per il fax.
          </span>
        </h2>
      </div>

      <div className="relative w-full">
        <EditorialImage
          src={MARKETING_IMAGERY.interludeWide.src}
          alt={MARKETING_IMAGERY.interludeWide.alt}
          aspectClassName="aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9]"
          sizes="100vw"
          overlay="duotone-warm"
          parallax
          parallaxStrength={0.16}
          position={MARKETING_IMAGERY.interludeWide.position}
        />
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            paddingLeft: "var(--gutter-marketing)",
            paddingRight: "var(--gutter-marketing)",
            paddingBottom: "clamp(28px, 5vw, 72px)",
          }}
        >
          <div className="grid grid-cols-12 gap-x-6 lg:gap-x-10 items-end">
            <p
              className="col-span-12 lg:col-span-8 font-display"
              style={{
                fontSize: "clamp(26px, 3.4vw, 52px)",
                lineHeight: 1.06,
                letterSpacing: "-0.018em",
                color: "#F5F4EE",
                textShadow: "0 1px 30px rgba(0,0,0,0.35)",
              }}
              suppressHydrationWarning
            >
              &ldquo;{pullLine}&rdquo;
            </p>
            <p
              className="col-span-12 lg:col-span-4 font-mono uppercase mt-6 lg:mt-0 lg:text-right"
              style={{
                fontSize: "11px",
                letterSpacing: "0.22em",
                color: "rgba(245,244,238,0.78)",
              }}
            >
              GBR · 2026
            </p>
          </div>
        </div>
      </div>

      <div
        ref={footRef}
        className="grid grid-cols-1 sm:grid-cols-3 gap-y-6 gap-x-8 mt-[clamp(40px,5vw,72px)]"
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
        }}
      >
        {[
          { k: "FILIERA", v: "diretta, tracciata, viva" },
          { k: "DISTANZA", v: "ridotta a un solo click" },
          { k: "FORMATO", v: "nessun PDF, nessuna telefonata" },
        ].map((row) => (
          <div key={row.k} data-foot className="opacity-0">
            <p
              className="font-mono uppercase mb-2"
              style={{
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: "var(--color-marketing-ink-subtle)",
              }}
            >
              {row.k}
            </p>
            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.5,
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {row.v}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
