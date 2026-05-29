"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { gsap, SplitText } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona } from "@/lib/marketing-persona-context";
import { useMagnetic } from "@/lib/hooks/use-magnetic";
import { MARKETING_IMAGERY } from "@/lib/marketing-imagery";

// v1 — single funnel. The home speaks only to restaurateurs; the supplier
// side is parked (see SUPPLIER_PLATFORM_ENABLED) and lives at /per-fornitori.
const HEADLINE = ["Ordina dai tuoi", "fornitori in 90 secondi."] as const;
const ACCENT = "Zero commissioni. Per sempre.";

const TRUST = ["14 giorni gratis", "senza carta", "0% commissioni"] as const;

export function SplitHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { setPersona } = usePersona();
  const ctaRef = useMagnetic<HTMLAnchorElement>({ strength: 0.28, radius: 100 });

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      sectionRef.current
        ?.querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((el) => (el.style.opacity = "1"));
      return;
    }

    // Track every SplitText so we revert BEFORE React unmounts the host nodes.
    const splits: SplitText[] = [];
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: MOTION.easeEditorial } });

      const eyebrow = sectionRef.current?.querySelector<HTMLElement>("[data-reveal='eyebrow']");
      const heads = sectionRef.current?.querySelectorAll<HTMLElement>("[data-split-target]");
      const accent = sectionRef.current?.querySelector<HTMLElement>("[data-reveal='accent']");
      const sub = sectionRef.current?.querySelector<HTMLElement>("[data-reveal='sub']");
      const ctas = sectionRef.current?.querySelectorAll<HTMLElement>("[data-reveal='cta']");
      const trust = sectionRef.current?.querySelector<HTMLElement>("[data-reveal='trust']");

      if (eyebrow) {
        tl.fromTo(
          eyebrow,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealShort },
          0.1
        );
      }
      heads?.forEach((h, i) => {
        const split = new SplitText(h, { type: "words" });
        splits.push(split);
        tl.fromTo(
          split.words,
          { opacity: 0, y: 56 },
          {
            opacity: 1,
            y: 0,
            stagger: MOTION.stagger.word,
            duration: MOTION.duration.revealLong,
          },
          0.22 + i * 0.06
        );
      });
      if (accent) {
        tl.fromTo(
          accent,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealBase },
          "-=0.5"
        );
      }
      if (sub) {
        tl.fromTo(
          sub,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealBase },
          "-=0.4"
        );
      }
      if (ctas) {
        tl.fromTo(
          ctas,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealBase, stagger: 0.08 },
          "-=0.35"
        );
      }
      if (trust) {
        tl.fromTo(
          trust,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealShort },
          "-=0.3"
        );
      }
    }, sectionRef);

    return () => {
      splits.forEach((s) => {
        try {
          s.revert();
        } catch {
          // ignore — already reverted
        }
      });
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      data-force-dark="true"
      className="relative flex flex-col justify-center overflow-hidden isolate"
      style={{
        minHeight: "calc(100svh - 5rem)",
        paddingTop: "clamp(112px, 13vw, 184px)",
        paddingBottom: "clamp(56px, 7vw, 104px)",
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        background: "#0A0A0E",
      }}
    >
      {/* cinematic backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          src={MARKETING_IMAGERY.heroRestaurant.src}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={92}
          style={{
            objectFit: "cover",
            objectPosition: MARKETING_IMAGERY.heroRestaurant.position,
          }}
        />
        {/* warm editorial wash, anchored to the text side */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, rgba(15,15,16,0.94) 0%, rgba(46,21,32,0.82) 42%, rgba(78,21,32,0.5) 72%, rgba(15,15,16,0.4) 100%)",
            mixBlendMode: "multiply",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,15,16,0.3) 0%, rgba(15,15,16,0.12) 38%, rgba(15,15,16,0.72) 100%)",
          }}
        />
        {/* film grain */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.16,
            mixBlendMode: "overlay",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: "240px 240px",
          }}
        />
      </div>

      <div className="relative w-full max-w-[1100px]">
        {/* eyebrow */}
        <div data-reveal="eyebrow" className="opacity-0 mb-[clamp(28px,4vw,48px)]">
          <EditorialEyebrow tone="subtle">
            <span style={{ color: "var(--color-marketing-primary)" }}>●</span>{" "}
            PER CHI CUCINA · NORD ITALIA
          </EditorialEyebrow>
        </div>

        {/* headline */}
        <h1
          className="font-display"
          style={{
            fontSize: "var(--type-marketing-display)",
            lineHeight: "var(--type-marketing-display-lh)",
            letterSpacing: "var(--type-marketing-display-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          <span
            data-reveal="head"
            data-split-target
            className="block opacity-0"
            style={{ whiteSpace: "pre-line" }}
            suppressHydrationWarning
          >
            {HEADLINE.join("\n")}
          </span>
          <span
            data-reveal="accent"
            className="block opacity-0 mt-[0.12em]"
            style={{ color: "var(--color-marketing-primary)" }}
          >
            {ACCENT}
          </span>
        </h1>

        {/* sub */}
        <p
          data-reveal="sub"
          className="opacity-0 mt-[clamp(28px,3.5vw,48px)] max-w-[46ch]"
          style={{
            fontSize: "var(--type-marketing-pull)",
            lineHeight: "var(--type-marketing-pull-lh)",
            color: "var(--color-marketing-ink-muted)",
            fontFamily: "var(--font-display)",
          }}
        >
          Prezzi vivi, ordini tracciati, food cost sotto controllo. Smetti di
          rincorrere il telefono.
        </p>

        {/* CTAs */}
        <div className="mt-[clamp(36px,4.5vw,64px)] flex flex-wrap items-center gap-x-8 gap-y-5">
          <div data-reveal="cta" className="opacity-0">
            <Link
              ref={ctaRef}
              href="/signup?role=restaurant"
              onClick={() => setPersona("restaurant")}
              className="group inline-flex items-center gap-3 rounded-full px-8 py-4 text-[14px] tracking-wide will-change-transform"
              style={{
                background: "var(--color-marketing-primary)",
                color: "var(--color-marketing-on-primary)",
                transition: "background-color 240ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary)")}
            >
              Prova gratis
              <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          <div data-reveal="cta" className="opacity-0">
            <Link
              href="#come-funziona"
              className="group inline-flex items-center gap-3 text-[14px] tracking-wide"
              style={{ color: "var(--color-marketing-ink)" }}
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors"
                style={{ border: "1px solid var(--color-marketing-rule-strong)" }}
              >
                ▷
              </span>
              <span className="link-editorial">guarda 90 sec</span>
            </Link>
          </div>
        </div>

        {/* trust strip */}
        <div
          data-reveal="trust"
          className="opacity-0 mt-[clamp(40px,5vw,72px)] flex flex-wrap items-center gap-x-4 gap-y-2 font-mono uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          <span
            aria-hidden
            className="inline-block h-px"
            style={{ width: 36, background: "var(--color-marketing-ink-subtle)" }}
          />
          {TRUST.map((t, i) => (
            <span key={t} className="flex items-center gap-4">
              {i > 0 && <span aria-hidden className="opacity-40">·</span>}
              <span style={{ color: i === TRUST.length - 1 ? "var(--color-marketing-ink)" : undefined }}>
                {t}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
