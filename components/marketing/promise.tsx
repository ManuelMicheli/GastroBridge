"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, SplitText, ScrollTrigger } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona } from "@/lib/marketing-persona-context";

const META = [
  { label: "ZERO INTERMEDIARI", caption: "Tu e il fornitore. Punto." },
  { label: "PREZZI VIVI", caption: "Aggiornati ogni ora, non in PDF." },
  { label: "ORDINI IN 90 SECONDI", caption: "Aggiungi, conferma, ricevi." },
  { label: "PAGAMENTI CERTI", caption: "Stripe + cassetto fiscale." },
] as const;

export function PromiseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const numberRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const { persona } = usePersona();

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      [headRef, numberRef, labelRef, metaRef].forEach((r) => {
        if (r.current) r.current.style.opacity = "1";
      });
      return;
    }

    const splits: SplitText[] = [];
    const ctx = gsap.context(() => {
      const tlScroll = {
        trigger: sectionRef.current,
        start: "top 70%",
        once: true,
      };

      if (headRef.current) {
        const split = new SplitText(headRef.current, { type: "lines", linesClass: "pr-line" });
        splits.push(split);
        gsap.set(headRef.current, { opacity: 1 });
        gsap.fromTo(
          split.lines,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealLong,
            stagger: MOTION.stagger.line,
            ease: MOTION.easeEditorial,
            scrollTrigger: tlScroll,
          }
        );
      }

      if (numberRef.current) {
        gsap.set(numberRef.current, { opacity: 1, clipPath: "inset(100% 0 0 0)" });
        gsap.to(numberRef.current, {
          clipPath: "inset(0% 0 0 0)",
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { ...tlScroll, start: "top 75%" },
        });
      }
      if (labelRef.current) {
        gsap.fromTo(
          labelRef.current,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealBase,
            ease: MOTION.easeEditorial,
            scrollTrigger: { ...tlScroll, start: "top 72%" },
            delay: 0.5,
          }
        );
      }

      if (metaRef.current) {
        const items = metaRef.current.querySelectorAll<HTMLElement>("[data-meta-item]");
        gsap.fromTo(
          items,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealBase,
            stagger: MOTION.stagger.block,
            ease: MOTION.easeEditorial,
            scrollTrigger: { ...tlScroll, start: "top 80%" },
          }
        );
      }

      ScrollTrigger.refresh();
    }, sectionRef);

    return () => {
      splits.forEach((s) => {
        try {
          s.revert();
        } catch {
          // ignore
        }
      });
      ctx.revert();
    };
  }, [persona]);

  const accentLine =
    persona === "supplier" ? "e per chi la rifornisce." : "per chi vive in cucina";
  const muteLine =
    persona === "supplier" ? "per chi vive in cucina" : "e per chi la rifornisce.";

  return (
    <section
      ref={sectionRef}
      id="promise"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-block)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10 items-start">
        <div className="col-span-12 lg:col-span-7">
          <EditorialEyebrow number="— 01">LA PROMESSA</EditorialEyebrow>

          <h2
            key={persona}
            ref={headRef}
            className="font-display opacity-0 mt-[clamp(24px,3vw,40px)]"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
            suppressHydrationWarning
          >
            Una piattaforma{" "}
            <span style={{ color: "var(--color-marketing-primary)" }}>{accentLine}</span>{" "}
            {persona === "supplier" ? "" : <>e <span style={{ color: "var(--color-marketing-ink-muted)" }}>{muteLine}</span></>}
            {persona === "supplier" && (
              <span style={{ color: "var(--color-marketing-ink-muted)" }}> {muteLine}</span>
            )}
          </h2>

          <p
            className="mt-[clamp(28px,3vw,44px)] max-w-[52ch]"
            style={{
              fontSize: "var(--type-marketing-pull)",
              lineHeight: "var(--type-marketing-pull-lh)",
              color: "var(--color-marketing-ink-muted)",
              fontFamily: "var(--font-display)",
            }}
          >
            Una rete dove ogni ordine, ogni prezzo e ogni relazione vivono nello
            stesso posto — senza filtri e senza fee.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col items-start lg:items-end justify-start">
          <div
            ref={numberRef}
            className="font-display leading-none opacity-0"
            style={{
              fontSize: "var(--type-marketing-mega)",
              letterSpacing: "var(--type-marketing-mega-ls)",
              color: "var(--color-marketing-primary)",
              willChange: "clip-path",
            }}
            aria-hidden
          >
            €0
          </div>
          <div
            ref={labelRef}
            className="opacity-0 mt-4 lg:text-right font-mono uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.22em",
              color: "var(--color-marketing-ink-subtle)",
              maxWidth: "22ch",
            }}
          >
            commissioni{" "}
            <span style={{ color: "var(--color-marketing-ink)" }}>fisse</span>
            <br />
            per ristoratori
            <br />
            <span aria-hidden className="opacity-50">— da sempre</span>
          </div>
        </div>
      </div>

      <div
        ref={metaRef}
        className="mt-[clamp(64px,8vw,128px)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-8 pt-10"
        style={{ borderTop: "1px solid var(--color-marketing-rule)" }}
      >
        {META.map((m, i) => (
          <div key={m.label} data-meta-item className="opacity-0">
            <p
              className="font-mono uppercase mb-3"
              style={{
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: "var(--color-marketing-ink-subtle)",
              }}
            >
              0{i + 1}
            </p>
            <p
              className="font-mono uppercase mb-2"
              style={{
                fontSize: "13px",
                letterSpacing: "0.14em",
                color: "var(--color-marketing-ink)",
              }}
            >
              {m.label}
            </p>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {m.caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
