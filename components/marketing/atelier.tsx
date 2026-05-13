"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { EditorialImage } from "./_primitives/editorial-image";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { MARKETING_IMAGERY } from "@/lib/marketing-imagery";

type Tile = {
  step: string;
  eyebrow: string;
  title: string;
  caption: string;
  src: string;
  alt: string;
  position: string;
  offset: string;
};

const TILES: readonly Tile[] = [
  {
    step: "I",
    eyebrow: "MATERIA",
    title: "La sostanza.",
    caption:
      "Materia prima d'autore, selezionata dai migliori produttori del territorio.",
    src: MARKETING_IMAGERY.atelierMarket.src,
    alt: MARKETING_IMAGERY.atelierMarket.alt,
    position: MARKETING_IMAGERY.atelierMarket.position,
    offset: "0",
  },
  {
    step: "II",
    eyebrow: "GESTO",
    title: "La mano.",
    caption:
      "Ogni piatto nasce da uno standard preciso. La rete lo rispetta, ordine dopo ordine.",
    src: MARKETING_IMAGERY.atelierKitchen.src,
    alt: MARKETING_IMAGERY.atelierKitchen.alt,
    position: MARKETING_IMAGERY.atelierKitchen.position,
    offset: "6vw",
  },
  {
    step: "III",
    eyebrow: "MEMORIA",
    title: "La cantina.",
    caption:
      "Storico ordini, fatture, scaduti, riconciliazione. Tutto in un unico cassetto digitale.",
    src: MARKETING_IMAGERY.atelierCellar.src,
    alt: MARKETING_IMAGERY.atelierCellar.alt,
    position: MARKETING_IMAGERY.atelierCellar.position,
    offset: "0",
  },
] as const;

export function Atelier() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      headRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      gridRef.current?.querySelectorAll<HTMLElement>("[data-tile]").forEach((el) => (el.style.opacity = "1"));
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headRef.current?.querySelectorAll("[data-reveal]") ?? [],
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: MOTION.stagger.block,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: sectionRef.current, start: "top 76%", once: true },
        }
      );
      gsap.fromTo(
        gridRef.current?.querySelectorAll("[data-tile]") ?? [],
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealLong,
          stagger: 0.12,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: gridRef.current, start: "top 78%", once: true },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="atelier"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div
        ref={headRef}
        className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 mb-[clamp(56px,7vw,112px)]"
      >
        <div data-reveal className="col-span-12 lg:col-span-4 opacity-0">
          <EditorialEyebrow number="— 04">L&apos;ATELIER</EditorialEyebrow>
        </div>
        <h2
          data-reveal
          className="col-span-12 lg:col-span-8 font-display opacity-0"
          style={{
            fontSize: "var(--type-marketing-h2)",
            lineHeight: "var(--type-marketing-h2-lh)",
            letterSpacing: "var(--type-marketing-h2-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          Materia, gesto, memoria.
          <br />
          <span style={{ color: "var(--color-marketing-ink-muted)" }}>
            Un piatto in tre atti.
          </span>
        </h2>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12"
      >
        {TILES.map((t) => (
          <article
            key={t.step}
            data-tile
            className="opacity-0 flex flex-col md:[margin-top:var(--tile-offset)]"
            style={{ ["--tile-offset" as string]: t.offset }}
          >
            <EditorialImage
              src={t.src}
              alt={t.alt}
              aspectClassName="aspect-[4/5]"
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
              overlay="soft"
              parallax
              parallaxStrength={0.12}
              position={t.position}
            />

            <div
              className="mt-6 flex items-center gap-3 font-mono uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: "var(--color-marketing-ink-subtle)",
              }}
            >
              <span style={{ color: "var(--color-marketing-primary)" }}>{t.step}</span>
              <span
                aria-hidden
                className="inline-block h-px"
                style={{ width: 28, background: "var(--color-marketing-rule-strong)" }}
              />
              <span>{t.eyebrow}</span>
            </div>

            <h3
              className="font-display mt-4"
              style={{
                fontSize: "clamp(26px, 2.4vw, 36px)",
                lineHeight: 1.05,
                letterSpacing: "-0.018em",
                color: "var(--color-marketing-ink)",
              }}
            >
              {t.title}
            </h3>

            <p
              className="mt-3 max-w-[36ch]"
              style={{
                fontSize: "15px",
                lineHeight: 1.55,
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {t.caption}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
