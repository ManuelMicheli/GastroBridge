"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona, type Persona } from "@/lib/marketing-persona-context";

type Step = {
  step: string;
  title: { restaurant: string; supplier: string };
  description: { restaurant: string; supplier: string };
  meta: string;
  mock: "catalog" | "order" | "ledger";
};

const STEPS: readonly Step[] = [
  {
    step: "01",
    title: {
      restaurant: "Cataloghi vivi.",
      supplier: "Listini sempre online.",
    },
    description: {
      restaurant:
        "Prezzi aggiornati, disponibilità reale, nessun PDF chiuso da scaricare. Confronti tre fornitori in un'unica vista.",
      supplier:
        "Aggiorni un prezzo una volta: appare istantaneamente a tutti i ristoranti che ti seguono. Niente listini di carta da rinviare.",
    },
    meta: "REAL-TIME · ZERO PDF",
    mock: "catalog",
  },
  {
    step: "02",
    title: {
      restaurant: "Ordini in 90 secondi.",
      supplier: "Ordini in arrivo, già pronti.",
    },
    description: {
      restaurant:
        "Aggiungi, conferma, ricevi. Storico, resi e ricorrenti gestiti dalla stessa dashboard, senza una telefonata.",
      supplier:
        "Ricevi ordini strutturati pronti per il magazzino. Conferma con un click, programmi la consegna, chiudi la pratica.",
    },
    meta: "≈ 90 SECONDI",
    mock: "order",
  },
  {
    step: "03",
    title: {
      restaurant: "Pagamenti tracciati.",
      supplier: "Incassi senza solleciti.",
    },
    description: {
      restaurant:
        "Stripe paga il fornitore, la fattura arriva nel tuo cassetto fiscale, la riconciliazione è automatica.",
      supplier:
        "Stripe incassa al posto tuo. Vedi DSO, scaduti e flusso giornaliero senza chiamare il commercialista.",
    },
    meta: "STRIPE · CASSETTO FISCALE",
    mock: "ledger",
  },
] as const;

export function Mechanism() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { persona } = usePersona();

  useEffect(() => {
    if (prefersReducedMotion()) {
      headerRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      trackRef.current?.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => (el.style.opacity = "1"));
      return;
    }

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

      const track = trackRef.current;
      if (!track) return;
      const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-card]"));
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

      if (isDesktop) {
        const trackWidth = track.scrollWidth;
        const viewportWidth = window.innerWidth;
        const distance = trackWidth - viewportWidth;
        if (distance > 0) {
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
        }
      } else {
        cards.forEach((card, i) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 32 },
            {
              opacity: 1,
              y: 0,
              duration: MOTION.duration.revealLong,
              ease: MOTION.easeEditorial,
              scrollTrigger: {
                trigger: card,
                start: "top 80%",
                once: true,
              },
              delay: i * 0.05,
            }
          );
        });
      }
    }, sectionRef);

    return () => ctx.revert();
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
          <EditorialEyebrow number="— 02">IL MECCANISMO</EditorialEyebrow>
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
          <span style={{ color: "var(--color-marketing-ink-muted)" }}>Un flusso senza frizione.</span>
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
              {s.title[persona]}
            </h3>
            <p
              className="mb-8 max-w-[40ch]"
              style={{
                fontSize: "var(--type-marketing-body)",
                lineHeight: "var(--type-marketing-body-lh)",
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {s.description[persona]}
            </p>

            <MockPanel kind={s.mock} persona={persona} />
          </article>
        ))}
      </div>
    </section>
  );
}

function MockPanel({ kind, persona }: { kind: Step["mock"]; persona: Persona }) {
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
              background: "#1B6B4A",
              boxShadow: "0 0 0 3px rgba(27,107,74,0.12)",
            }}
          />
          <span className="uppercase" style={{ color: "var(--color-marketing-ink-muted)", letterSpacing: "0.05em" }}>
            LIVE
          </span>
          <span style={{ color: "var(--color-marketing-rule-strong)" }}>|</span>
          <span style={{ color: "var(--color-marketing-ink)", fontWeight: 500 }}>
            {kind === "catalog" && "GBR.CTL"}
            {kind === "order" && "GBR.ORD"}
            {kind === "ledger" && "GBR.LDG"}
          </span>
        </div>
        <span style={{ color: "var(--color-marketing-ink-subtle)" }}>14:23</span>
      </div>

      <div className="px-4 py-4 space-y-2">
        {kind === "catalog" && <CatalogMock persona={persona} />}
        {kind === "order" && <OrderMock persona={persona} />}
        {kind === "ledger" && <LedgerMock persona={persona} />}
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

function CatalogMock({ persona }: { persona: Persona }) {
  const rows: readonly (readonly [string, string, string])[] = [
    ["Mozzarella fior di latte", "€7.20/kg", persona === "supplier" ? "stock 240" : "↓ −0.30"],
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

function OrderMock({ persona }: { persona: Persona }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--color-marketing-ink-muted)" }}>
          {persona === "supplier" ? "Da Pizzeria Centrale" : "A Caseificio Romanò"}
        </span>
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
          {persona === "supplier" ? "Confermato · cons. 09:00" : "Confermato · ETA 12 mag"}
        </span>
      </div>
    </div>
  );
}

function LedgerMock({ persona }: { persona: Persona }) {
  const rows: readonly (readonly [string, string, string])[] = [
    persona === "supplier"
      ? (["Pizzeria Centrale", "INC 12 mag", "+€206.40"] as const)
      : (["Caseificio Romanò", "OUT 12 mag", "−€206.40"] as const),
    ["Stripe fee", "—", "−€0.00"],
    [
      persona === "supplier" ? "Trattoria Cinque" : "Forno Marini",
      "12 mag",
      persona === "supplier" ? "+€84.20" : "−€84.20",
    ],
    ["Saldo 12 mag", "—", persona === "supplier" ? "+€290.60" : "−€290.60"],
  ] as const;
  return (
    <>
      {rows.map((r, i) => (
        <div
          key={r[0]}
          className={i === rows.length - 1 ? "pt-2 mt-1" : ""}
          style={i === rows.length - 1 ? { borderTop: "0.5px solid var(--color-marketing-rule)" } : undefined}
        >
          <Row cols={r} emphasis={2} />
        </div>
      ))}
    </>
  );
}
