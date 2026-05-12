"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap, SplitText } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona, type Persona } from "@/lib/marketing-persona-context";
import { useMagnetic } from "@/lib/hooks/use-magnetic";

type SideData = {
  persona: Persona;
  eyebrow: string;
  headline: readonly [string, string, string];
  metric: { value: string; label: string };
  ctaLabel: string;
  ctaHref: string;
  side: "left" | "right";
};

const SIDES: readonly [SideData, SideData] = [
  {
    persona: "restaurant",
    eyebrow: "PER CHI CUCINA · 01",
    headline: ["Trova.", "Ordina.", "Risparmia."],
    metric: { value: "1,247", label: "ristoranti attivi" },
    ctaLabel: "Sono Ristoratore",
    ctaHref: "/signup?role=restaurant",
    side: "left",
  },
  {
    persona: "supplier",
    eyebrow: "PER CHI FORNISCE · 02",
    headline: ["Vendi.", "Cresci.", "Senza fee."],
    metric: { value: "312", label: "fornitori live" },
    ctaLabel: "Sono Fornitore",
    ctaHref: "/signup?role=supplier",
    side: "right",
  },
] as const;

export function SplitHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<Persona | null>(null);
  const { persona, setPersona } = usePersona();

  useEffect(() => {
    if (prefersReducedMotion()) {
      sectionRef.current
        ?.querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((el) => (el.style.opacity = "1"));
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: MOTION.easeEditorial } });
      const eyebrows = sectionRef.current?.querySelectorAll<HTMLElement>("[data-reveal='eyebrow']");
      const heads = sectionRef.current?.querySelectorAll<HTMLHeadingElement>("[data-reveal='head']");
      const metrics = sectionRef.current?.querySelectorAll<HTMLElement>("[data-reveal='metric']");
      const ctas = sectionRef.current?.querySelectorAll<HTMLElement>("[data-reveal='cta']");

      if (eyebrows) {
        tl.fromTo(
          eyebrows,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealShort, stagger: 0.06 },
          0.1
        );
      }
      heads?.forEach((h, i) => {
        const split = new SplitText(h, { type: "words" });
        tl.fromTo(
          split.words,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            stagger: MOTION.stagger.word,
            duration: MOTION.duration.revealLong,
          },
          0.25 + i * 0.08
        );
      });
      if (metrics) {
        tl.fromTo(
          metrics,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealBase, stagger: 0.08 },
          "-=0.45"
        );
      }
      if (ctas) {
        tl.fromTo(
          ctas,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: MOTION.duration.revealBase, stagger: 0.08 },
          "-=0.45"
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] overflow-hidden"
      style={{
        minHeight: "calc(100svh - 5rem)",
        paddingTop: "clamp(96px, 12vw, 168px)",
        paddingBottom: "clamp(48px, 6vw, 96px)",
      }}
      data-hovered={hovered ?? undefined}
    >
      <Side
        key={SIDES[0].persona}
        data={SIDES[0]}
        active={persona === SIDES[0].persona}
        dimmed={hovered !== null && hovered !== SIDES[0].persona}
        expanded={hovered === SIDES[0].persona}
        onHover={() => setHovered(SIDES[0].persona)}
        onLeave={() => setHovered(null)}
        onChoose={() => setPersona(SIDES[0].persona)}
      />

      {/* divider: horizontal rule on mobile, vertical line on desktop */}
      <div
        aria-hidden
        className="h-px w-full md:h-auto md:w-px md:self-stretch"
        style={{ background: "var(--color-marketing-rule-strong)" }}
      />

      <Side
        key={SIDES[1].persona}
        data={SIDES[1]}
        active={persona === SIDES[1].persona}
        dimmed={hovered !== null && hovered !== SIDES[1].persona}
        expanded={hovered === SIDES[1].persona}
        onHover={() => setHovered(SIDES[1].persona)}
        onLeave={() => setHovered(null)}
        onChoose={() => setPersona(SIDES[1].persona)}
      />
    </section>
  );
}

type SideProps = {
  data: SideData;
  active: boolean;
  dimmed: boolean;
  expanded: boolean;
  onHover: () => void;
  onLeave: () => void;
  onChoose: () => void;
};

function Side({ data, active, dimmed, expanded, onHover, onLeave, onChoose }: SideProps) {
  const ctaRef = useMagnetic<HTMLAnchorElement>({ strength: 0.28, radius: 100 });

  return (
    <div
      data-side={data.persona === "supplier" ? "supplier" : undefined}
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      className="relative flex flex-col justify-between order-1"
      style={{
        flex: expanded ? "1.4" : dimmed ? "0.6" : "1",
        transition: "flex 380ms cubic-bezier(0.16, 1, 0.3, 1), filter 380ms cubic-bezier(0.16, 1, 0.3, 1)",
        filter: dimmed ? "brightness(0.78) saturate(0.7)" : "none",
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "clamp(24px, 4vw, 48px)",
        paddingBottom: "clamp(32px, 4vw, 56px)",
      }}
    >
      {/* corner index + active marker */}
      <div className="flex items-start justify-between gap-6">
        <div data-reveal="eyebrow" className="opacity-0">
          <EditorialEyebrow tone={active ? "primary" : "subtle"}>
            {data.eyebrow}
          </EditorialEyebrow>
        </div>
        {active && (
          <span
            data-reveal="eyebrow"
            className="opacity-0 font-mono uppercase text-[10px] tracking-[0.22em] flex items-center gap-2"
            style={{ color: "var(--color-marketing-primary)" }}
          >
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: "var(--color-marketing-primary)",
                boxShadow: "0 0 0 4px color-mix(in srgb, var(--color-marketing-primary) 18%, transparent)",
              }}
            />
            ATTIVO
          </span>
        )}
      </div>

      {/* headline */}
      <h1
        data-reveal="head"
        className="font-display opacity-0 mt-[clamp(28px,5vw,72px)] mb-[clamp(28px,4vw,56px)]"
        style={{
          fontSize: "var(--type-marketing-display)",
          lineHeight: "var(--type-marketing-display-lh)",
          letterSpacing: "var(--type-marketing-display-ls)",
          color: "var(--color-marketing-ink)",
        }}
      >
        {data.headline.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      {/* metric + cta footer */}
      <div className="flex flex-col gap-[clamp(20px,3vw,32px)]">
        <div
          data-reveal="metric"
          className="opacity-0 flex items-center gap-4 font-mono uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          <span
            aria-hidden
            className="inline-block h-px"
            style={{ width: 36, background: "var(--color-marketing-ink-subtle)" }}
          />
          <span style={{ color: "var(--color-marketing-ink)" }}>{data.metric.value}</span>
          <span>{data.metric.label}</span>
        </div>

        <div data-reveal="cta" className="opacity-0">
          <Link
            ref={ctaRef}
            href={data.ctaHref}
            onClick={onChoose}
            className="group inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-[14px] tracking-wide will-change-transform"
            style={{
              background: "var(--color-marketing-primary)",
              color: "var(--color-marketing-on-primary)",
              transition: "background-color 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary)")}
          >
            {data.ctaLabel}
            <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
