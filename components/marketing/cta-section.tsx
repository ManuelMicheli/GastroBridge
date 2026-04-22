"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { gsap, SplitText } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

export function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      if (headlineRef.current) headlineRef.current.style.opacity = "1";
      if (ctaRef.current) ctaRef.current.style.opacity = "1";
      return;
    }

    const ctx = gsap.context(() => {
      if (headlineRef.current) {
        gsap.set(headlineRef.current, { opacity: 1 });
        const split = new SplitText(headlineRef.current, { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0, y: 50, rotationX: 90 },
          {
            opacity: 1,
            y: 0,
            rotationX: 0,
            stagger: MOTION.stagger.block,
            duration: MOTION.duration.revealBase,
            ease: MOTION.easeDramatic,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      gsap.fromTo(
        ctaRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          ease: MOTION.easeEditorial,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
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
      id="cta-finale"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
        background: "var(--color-marketing-bg)",
      }}
    >
      <div className="mx-auto max-w-[68rem]">
        <EditorialEyebrow number="— 09" className="mb-10">CHIUSURA</EditorialEyebrow>

        <h2
          ref={headlineRef}
          className="font-display opacity-0"
          style={{
            fontSize: "clamp(56px, 9vw, 140px)",
            lineHeight: "0.96",
            letterSpacing: "-0.028em",
            color: "var(--color-marketing-ink)",
            perspective: "600px",
          }}
        >
          Un gesto piccolo
          <br />
          cambia una{" "}
          <span style={{ color: "var(--color-marketing-primary)" }}>filiera</span>.
        </h2>

        <p
          className="mt-[clamp(32px,4vw,56px)] max-w-[56ch]"
          style={{
            fontSize: "var(--type-marketing-body)",
            lineHeight: "var(--type-marketing-body-lh)",
            color: "var(--color-marketing-ink-muted)",
          }}
        >
          Cinque minuti per registrarti. Due settimane per capire se ti
          stiamo restituendo tempo. Nessuna carta all&apos;iscrizione,
          nessun contratto.
        </p>

        <div
          ref={ctaRef}
          className="opacity-0 mt-[clamp(32px,4vw,56px)] flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10"
        >
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full px-8 py-4 text-[14px] tracking-wide transition-colors"
            style={{
              background: "var(--color-marketing-primary)",
              color: "var(--color-marketing-on-primary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary)")}
          >
            Apri un account
          </Link>

          <span
            aria-hidden
            className="hidden sm:block h-6"
            style={{ width: "1px", background: "var(--color-marketing-rule-strong)" }}
          />

          <span data-side="supplier">
            <Link
              href="/per-fornitori"
              className="link-editorial text-[14px] tracking-wide"
              style={{ color: "var(--color-marketing-primary)" }}
            >
              Diventa fornitore →
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
}
