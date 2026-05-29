"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, canAnimate } from "@/lib/marketing-motion";
import { useMagnetic } from "@/lib/hooks/use-magnetic";

// v1 — single funnel. Restaurant-only copy; no persona branching.
type Step = {
  step: string;
  title: string;
  description: string;
  meta: string;
  mock: "catalog" | "order" | "history";
};

const STEPS: readonly Step[] = [
  {
    step: "01",
    title: "Carica i tuoi fornitori.",
    description:
      "Aggiungi i fornitori con cui già lavori e importa i loro listini — a mano o da CSV/Excel. Una volta sola, poi sono sempre lì.",
    meta: "IMPORT · CSV",
    mock: "catalog",
  },
  {
    step: "02",
    title: "Ordini in 90 secondi.",
    description:
      "Apri il catalogo, aggiungi, conferma, invii. Storico, resi e ricorrenti nella stessa dashboard, senza una telefonata.",
    meta: "≈ 90 SECONDI",
    mock: "order",
  },
  {
    step: "03",
    title: "Tutto organizzato.",
    description:
      "Storico ordini, listini sempre aggiornati, food cost sotto controllo. Esporti in CSV o PDF quando vuoi.",
    meta: "STORICO · EXPORT",
    mock: "history",
  },
] as const;

export function Mechanism() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaLinkRef = useMagnetic<HTMLAnchorElement>({ strength: 0.28, radius: 100 });

  useEffect(() => {
    const revealAll = () => {
      headerRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      trackRef.current?.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => (el.style.opacity = "1"));
      if (ctaRef.current) ctaRef.current.style.opacity = "1";
    };
    // Mobile / reduced-motion: show content immediately, never load GSAP.
    // (The desktop horizontal-pin scroll below is irrelevant on touch anyway.)
    if (!canAnimate()) {
      revealAll();
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/gsap-config").then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
      const headerEls = headerRef.current?.querySelectorAll<HTMLElement>("[data-reveal]");
      if (headerEls) {
        gsap.fromTo(
          headerEls,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealBase,
            stagger: MOTION.stagger.block,
            ease: MOTION.easeEditorial,
            scrollTrigger: { trigger: headerRef.current, start: "top 78%", once: true },
          }
        );
      }

      if (ctaRef.current) {
        gsap.fromTo(
          ctaRef.current,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealBase,
            ease: MOTION.easeEditorial,
            scrollTrigger: { trigger: ctaRef.current, start: "top 88%", once: true },
          }
        );
      }

      const track = trackRef.current;
      if (!track) return;
      const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-card]"));
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const distance = isDesktop ? track.scrollWidth - window.innerWidth : 0;

      // Per-card vertical reveal — used on mobile AND on wide desktops where the
      // track fits without overflow (distance <= 0). Without this fallback the
      // cards keep their opacity-0 class and the whole section is invisible.
      const revealInPlace = () => {
        cards.forEach((card, i) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 32 },
            {
              opacity: 1,
              y: 0,
              duration: MOTION.duration.revealLong,
              ease: MOTION.easeEditorial,
              scrollTrigger: { trigger: card, start: "top 85%", once: true },
              delay: i * 0.05,
            }
          );
        });
      };

      if (isDesktop && distance > 0) {
        const horizontal = gsap.to(track, {
          x: -distance,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: () => `+=${distance + 200}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        cards.forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0.4, scale: 0.92 },
            {
              opacity: 1,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                containerAnimation: horizontal,
                start: "left 80%",
                end: "center 50%",
                scrub: true,
              },
            }
          );
        });
      } else {
        revealInPlace();
      }
      }, sectionRef);
      cleanup = () => ctx.revert();
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="come-funziona"
      className="relative overflow-hidden"
      style={{
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div
        ref={headerRef}
        className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]"
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
        }}
      >
        <div data-reveal className="col-span-12 lg:col-span-4 opacity-0">
          <EditorialEyebrow number="— 02">COME FUNZIONA</EditorialEyebrow>
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
          Tre passi.
          <br />
          <span style={{ color: "var(--color-marketing-ink-muted)" }}>Zero attrito.</span>
        </h2>
      </div>

      <div
        ref={trackRef}
        className="flex flex-col lg:flex-row lg:flex-nowrap gap-8 lg:gap-12 will-change-transform"
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
        }}
      >
        {STEPS.map((s) => (
          <article
            key={s.step}
            data-card
            className="relative opacity-0 flex flex-col lg:flex-shrink-0"
            style={{
              width: "min(100%, 480px)",
              minHeight: "clamp(420px, 60vh, 560px)",
            }}
          >
            <div
              className="flex items-center justify-between mb-6 pb-3"
              style={{ borderBottom: "1px solid var(--color-marketing-rule)" }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.16em",
                  color: "var(--color-marketing-primary)",
                }}
              >
                {s.step} / 03
              </span>
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                  color: "var(--color-marketing-ink-subtle)",
                }}
              >
                {s.meta}
              </span>
            </div>

            <h3
              className="font-display mb-5"
              style={{
                fontSize: "clamp(28px, 3vw, 44px)",
                lineHeight: 1.04,
                letterSpacing: "-0.018em",
                color: "var(--color-marketing-ink)",
              }}
            >
              {s.title}
            </h3>
            <p
              className="mb-8 max-w-[40ch]"
              style={{
                fontSize: "var(--type-marketing-body)",
                lineHeight: "var(--type-marketing-body-lh)",
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {s.description}
            </p>

            <MockPanel kind={s.mock} />
          </article>
        ))}
      </div>

      {/* CTA — close the loop before the next section */}
      <div
        ref={ctaRef}
        className="opacity-0 mt-[clamp(56px,7vw,112px)] flex flex-wrap items-center gap-x-8 gap-y-4"
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
        }}
      >
        <Link
          ref={ctaLinkRef}
          href="/signup?role=restaurant"
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
        <span
          className="font-mono uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "var(--color-marketing-ink-subtle)",
          }}
        >
          14 giorni · senza carta
        </span>
      </div>
    </section>
  );
}

function MockPanel({ kind }: { kind: Step["mock"] }) {
  return (
    <div
      className="mt-auto font-mono"
      style={{
        border: "0.5px solid var(--color-marketing-rule-strong)",
        borderRadius: 6,
        overflow: "hidden",
        background: "var(--color-marketing-bg-soft)",
        fontSize: "11px",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: "0.5px solid var(--color-marketing-rule)",
          background: "var(--color-marketing-bg)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: "var(--color-marketing-primary)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-marketing-primary) 14%, transparent)",
            }}
          />
          <span className="uppercase" style={{ color: "var(--color-marketing-ink-muted)", letterSpacing: "0.05em" }}>
            LIVE
          </span>
          <span style={{ color: "var(--color-marketing-rule-strong)" }}>|</span>
          <span style={{ color: "var(--color-marketing-ink)", fontWeight: 500 }}>
            {kind === "catalog" && "GBR.CTL"}
            {kind === "order" && "GBR.ORD"}
            {kind === "history" && "GBR.LOG"}
          </span>
        </div>
        <span style={{ color: "var(--color-marketing-ink-subtle)" }}>14:23</span>
      </div>

      <div className="px-4 py-4 space-y-2">
        {kind === "catalog" && <CatalogMock />}
        {kind === "order" && <OrderMock />}
        {kind === "history" && <HistoryMock />}
      </div>
    </div>
  );
}

function Row({
  cols,
  emphasis,
}: {
  cols: readonly (string | number)[];
  emphasis?: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-baseline">
      {cols.map((c, i) => (
        <span
          key={i}
          className={i === 2 ? "text-right" : ""}
          style={{
            color:
              i === emphasis
                ? "var(--color-marketing-ink)"
                : "var(--color-marketing-ink-muted)",
            fontWeight: i === emphasis ? 500 : 400,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function CatalogMock() {
  const rows: readonly (readonly [string, string, string])[] = [
    ["Mozzarella fior di latte", "€7.20/kg", "↓ −0.30"],
    ["Pomodoro pelato 3kg", "€4.80/cz", "↓ −0.10"],
    ["Olio EVO 5L", "€32.10/cz", "→ stab."],
    ["Farina 00 25kg", "€18.40/cz", "↑ +0.40"],
  ] as const;
  return (
    <>
      {rows.map((r) => (
        <Row key={r[0]} cols={r} emphasis={1} />
      ))}
    </>
  );
}

function OrderMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--color-marketing-ink-muted)" }}>A Caseificio Romanò</span>
        <span style={{ color: "var(--color-marketing-ink)", fontWeight: 500 }}>#A-1247</span>
      </div>
      <div style={{ borderTop: "0.5px solid var(--color-marketing-rule)", paddingTop: 10 }} className="space-y-2">
        <Row cols={["Mozz. fior di latte", "12 kg", "€86.40"]} emphasis={2} />
        <Row cols={["Burrata 250g", "20 pz", "€72.00"]} emphasis={2} />
        <Row cols={["Stracciatella", "4 vasche", "€48.00"]} emphasis={2} />
      </div>
      <div
        className="flex items-center justify-between pt-2"
        style={{ borderTop: "0.5px solid var(--color-marketing-rule)" }}
      >
        <span className="uppercase" style={{ color: "var(--color-marketing-ink-subtle)", letterSpacing: "0.15em" }}>
          Totale
        </span>
        <span style={{ color: "var(--color-marketing-ink)", fontWeight: 500 }}>€206.40</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block w-3 h-3 rounded-full"
          style={{ background: "var(--color-marketing-primary)" }}
        />
        <span className="uppercase" style={{ color: "var(--color-marketing-primary)", letterSpacing: "0.15em", fontSize: "10px" }}>
          Confermato · ETA 12 mag
        </span>
      </div>
    </div>
  );
}

function HistoryMock() {
  const rows: readonly (readonly [string, string, string])[] = [
    ["Caseificio Romanò", "12 mag", "consegnato"],
    ["Forno Marini", "11 mag", "consegnato"],
    ["Ortofrutta Po", "10 mag", "in transito"],
    ["Caseificio Romanò", "08 mag", "consegnato"],
  ] as const;
  return (
    <>
      {rows.map((r) => (
        <Row key={`${r[0]}-${r[1]}`} cols={r} emphasis={0} />
      ))}
      <div
        className="flex items-center justify-between pt-2 mt-1"
        style={{ borderTop: "0.5px solid var(--color-marketing-rule)" }}
      >
        <span className="uppercase" style={{ color: "var(--color-marketing-ink-subtle)", letterSpacing: "0.15em" }}>
          Esporta
        </span>
        <span style={{ color: "var(--color-marketing-ink)", fontWeight: 500 }}>CSV · PDF</span>
      </div>
    </>
  );
}
