"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { GrowthNumber } from "./_primitives/growth-number";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

/* TBD: populate with real metrics once product has data.
   Keep structure, leave value=null so placeholder renders. */
const CELLS = [
  { year: "2024", value: null, suffix: "", label: "ristoranti attivi", stair: 0 },
  { year: "2025", value: null, suffix: "", label: "ordini gestiti", stair: 6 },
  { year: "2026", value: null, suffix: "", label: "fornitori verificati", stair: 12 },
  { year: "2027", value: null, suffix: "", label: "obiettivo", stair: 18 },
] as const;

export function GrowthGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const cellsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = cellsRef.current;
    if (!container) return;

    if (prefersReducedMotion()) {
      container.querySelectorAll("[data-cell]").forEach((c) => {
        (c as HTMLElement).style.opacity = "1";
      });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        container.querySelectorAll("[data-cell]"),
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: 0.1,
          ease: MOTION.easeEditorial,
          scrollTrigger: {
            trigger: container,
            start: "top 78%",
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
      id="crescita"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
        background: "var(--color-marketing-bg)",
      }}
    >
      {/* Upper band */}
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10">
        <div className="col-span-12 lg:col-span-6">
          <EditorialEyebrow number="— 02" className="mb-6">ATTIVITÀ SULLA RETE</EditorialEyebrow>
          <h2
            className="font-display"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Dal 2024,
            <br />
            la rete cresce.
          </h2>
        </div>

        <div className="col-span-12 lg:col-span-5 lg:col-start-8 flex flex-col justify-between">
          <EditorialEyebrow className="mb-6">CLIENTI ATTIVI AL MESE</EditorialEyebrow>
          <div
            className="font-display"
            style={{
              fontSize: "var(--type-marketing-mega)",
              lineHeight: "var(--type-marketing-mega-lh)",
              letterSpacing: "var(--type-marketing-mega-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            <GrowthNumber value={null} placeholder="[TBD]" />
            <span
              style={{ color: "var(--color-marketing-primary)" }}
              aria-hidden
            >
              +
            </span>
          </div>
        </div>
      </div>

      {/* Rule */}
      <hr
        className="my-[clamp(48px,6vw,96px)]"
        style={{ borderTop: "1px solid var(--color-marketing-rule)", borderLeft: 0, borderRight: 0, borderBottom: 0 }}
      />

      {/* Lower band — stair-step year cells */}
      <div ref={cellsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {CELLS.map((cell) => (
          <div
            key={cell.year}
            data-cell
            className="relative flex flex-col justify-between opacity-0 lg:[margin-top:var(--stair)]"
            style={
              {
                // desktop stair-step via CSS var; overridden to 0 on mobile via media query below
                ["--stair" as string]: `${cell.stair}vw`,
                border: "1px solid var(--color-marketing-rule)",
                padding: "clamp(24px, 3vw, 56px)",
                minHeight: "clamp(220px, 22vw, 320px)",
                background: "var(--color-marketing-bg)",
              } as React.CSSProperties
            }
          >
            <p
              className="font-mono uppercase"
              style={{
                fontSize: "var(--type-marketing-eyebrow)",
                letterSpacing: "var(--type-marketing-eyebrow-ls)",
                color: "var(--color-marketing-ink-subtle)",
              }}
            >
              {cell.year}
            </p>
            <div className="mt-10">
              <div
                className="font-display leading-[0.9]"
                style={{
                  fontSize: "clamp(48px, 7vw, 112px)",
                  letterSpacing: "var(--type-marketing-display-ls)",
                  color: "var(--color-marketing-ink)",
                }}
              >
                <GrowthNumber value={cell.value} suffix={cell.suffix} placeholder="[TBD]" />
              </div>
              <p
                className="mt-3"
                style={{
                  fontSize: "13px",
                  color: "var(--color-marketing-ink-muted)",
                }}
              >
                {cell.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
