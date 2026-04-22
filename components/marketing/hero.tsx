"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { gsap, SplitText } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const breveRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const footNoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      [eyebrowRef, metaRef, headlineRef, subtitleRef, breveRef, ctaRef, footNoteRef].forEach((r) => {
        if (r.current) r.current.style.opacity = "1";
      });
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: MOTION.easeEditorial } });

      tl.fromTo(
        eyebrowRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealShort },
        0.1
      );
      tl.fromTo(
        metaRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealShort },
        0.18
      );

      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "words" });
        tl.fromTo(
          split.words,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, stagger: MOTION.stagger.word, duration: MOTION.duration.revealLong },
          0.35
        );
      }

      tl.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealBase },
        "-=0.3"
      );
      tl.fromTo(
        breveRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealBase },
        "-=0.45"
      );
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: MOTION.duration.revealBase },
        "-=0.4"
      );
      tl.fromTo(
        footNoteRef.current,
        { opacity: 0 },
        { opacity: 1, duration: MOTION.duration.revealShort },
        "-=0.2"
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative flex flex-col"
      style={{
        minHeight: "calc(100svh - 5rem)",
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "clamp(112px, 14vw, 200px)",
        paddingBottom: "clamp(48px, 6vw, 96px)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 flex-1">
        {/* Eyebrow top-left */}
        <div ref={eyebrowRef} className="col-span-12 lg:col-span-9 opacity-0">
          <EditorialEyebrow number="N.01">PIATTAFORMA HO.RE.CA.</EditorialEyebrow>
        </div>

        {/* Meta top-right */}
        <div
          ref={metaRef}
          className="col-span-12 lg:col-span-3 lg:text-right font-mono uppercase opacity-0"
          style={{
            fontSize: "var(--type-marketing-eyebrow)",
            letterSpacing: "var(--type-marketing-eyebrow-ls)",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          <p>NORD ITALIA</p>
          <p className="mt-1">2024 —</p>
        </div>

        {/* H1 col 1-10 */}
        <h1
          ref={headlineRef}
          className="col-span-12 lg:col-span-10 font-display opacity-0 mt-[clamp(24px,6vw,80px)]"
          style={{
            fontSize: "var(--type-marketing-display)",
            lineHeight: "var(--type-marketing-display-lh)",
            letterSpacing: "var(--type-marketing-display-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          Fornitori e ristoranti.
          <br />
          Una sola piattaforma.
        </h1>

        {/* Subtitle col 1-7 */}
        <p
          ref={subtitleRef}
          className="col-span-12 lg:col-span-7 opacity-0 mt-[clamp(20px,3vw,40px)]"
          style={{
            fontSize: "var(--type-marketing-body)",
            lineHeight: "var(--type-marketing-body-lh)",
            color: "var(--color-marketing-ink-muted)",
            maxWidth: "58ch",
          }}
        >
          La rete Ho.Re.Ca. che mette ogni ordine, ogni prezzo e ogni
          relazione commerciale in un solo posto. Zero intermediari, zero
          costi nascosti, zero chiamate alle sette del mattino per capire
          se la consegna arriverà.
        </p>

        {/* In breve — mini caption row */}
        <div
          ref={breveRef}
          className="col-span-12 lg:col-span-7 opacity-0 mt-[clamp(20px,2.5vw,36px)] flex flex-wrap items-center gap-x-8 gap-y-2 font-mono uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          <span>— Nord Italia</span>
          <span>— Fornitori verificati</span>
          <span>— Pagamenti Stripe</span>
          <span>— Nessun contratto</span>
        </div>

        {/* CTAs col 1-12 */}
        <div
          ref={ctaRef}
          className="col-span-12 opacity-0 mt-[clamp(32px,4vw,56px)] flex flex-wrap items-center gap-x-8 gap-y-5"
        >
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
            Apri un account
          </Link>
          <Link
            href="/login"
            className="link-editorial text-[14px] tracking-wide text-[var(--color-marketing-ink)]"
          >
            Accedi →
          </Link>
        </div>
      </div>

      {/* Foot-note bottom-left */}
      <div
        ref={footNoteRef}
        className="opacity-0 flex items-center gap-4 mt-[clamp(48px,8vw,112px)]"
        aria-hidden
      >
        <span
          className="inline-block h-px"
          style={{ width: "48px", background: "var(--color-marketing-ink-subtle)" }}
        />
        <p
          className="font-mono uppercase"
          style={{
            fontSize: "var(--type-marketing-eyebrow)",
            letterSpacing: "var(--type-marketing-eyebrow-ls)",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          Scorri per leggere
        </p>
      </div>
    </section>
  );
}
