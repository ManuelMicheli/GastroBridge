"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { gsap, SplitText } from "@/lib/gsap-config";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona } from "@/lib/marketing-persona-context";
import { useMagnetic } from "@/lib/hooks/use-magnetic";
import { Grain } from "./_primitives/grain";
import { MARKETING_IMAGERY } from "@/lib/marketing-imagery";

export function Closer() {
  const sectionRef = useRef<HTMLElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const ctaPrimaryRef = useMagnetic<HTMLAnchorElement>({ strength: 0.3, radius: 110 });
  const { persona, setPersona } = usePersona();

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      [yearRef, subRef, ctaRef, footRef].forEach((r) => {
        if (r.current) r.current.style.opacity = "1";
      });
      if (headlineRef.current) headlineRef.current.style.opacity = "1";
      return;
    }
    const splits: SplitText[] = [];
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

      const splitTarget =
        headlineRef.current?.querySelector<HTMLElement>("[data-split-target]");
      if (splitTarget) {
        gsap.set(splitTarget, { opacity: 1 });
        const split = new SplitText(splitTarget, { type: "words" });
        splits.push(split);
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
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <Image
          src={MARKETING_IMAGERY.closerAmbient.src}
          alt=""
          fill
          sizes="100vw"
          quality={90}
          style={{
            objectFit: "cover",
            objectPosition: MARKETING_IMAGERY.closerAmbient.position,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(9,9,15,0.78) 0%, rgba(9,9,15,0.86) 55%, rgba(9,9,15,0.95) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 70% 30%, rgba(107,31,46,0.32) 0%, transparent 60%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <Grain opacity={0.16} blendMode="overlay" zIndex={0} />

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
            fontSize: "clamp(44px, 10vw, 160px)",
            lineHeight: "0.96",
            letterSpacing: "-0.028em",
            color: "var(--color-marketing-ink)",
            perspective: "800px",
            wordBreak: "keep-all",
          }}
        >
          <span
            data-split-target
            className="block"
            style={{ whiteSpace: "pre-line" }}
            suppressHydrationWarning
          >
            {"Pronto\na smettere\ndi telefonare?"}
          </span>
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
