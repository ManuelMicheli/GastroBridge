"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

const CAPABILITIES = [
  {
    code: "A",
    title: "Catalogo",
    headline: "Prodotti sempre aggiornati",
    body:
      "Fornitori pubblicano cataloghi vivi: prezzi, disponibilità e lotti minimi cambiano in tempo reale. Niente PDF datati, niente email con listini di sei mesi fa.",
    bullets: [
      "Import CSV massivo",
      "Filtri per zona, tempo di consegna, certificazioni",
      "Storico prezzi per categoria",
    ],
  },
  {
    code: "B",
    title: "Ordini",
    headline: "Dal carrello alla cucina",
    body:
      "Ordini multi-fornitore in un solo flusso. Conferme automatiche, modifiche fino a taglio, tracking della consegna minuto per minuto. Resi in due click.",
    bullets: [
      "Ordini ricorrenti e liste della spesa",
      "Taglio condiviso con il fornitore",
      "Notifiche per ritardi e sostituzioni",
    ],
  },
  {
    code: "C",
    title: "Pagamenti",
    headline: "Stripe, senza sorprese",
    body:
      "Pagamenti processati da Stripe con crittografia bancaria. Fatture elettroniche emesse in automatico. Saldo centralizzato: un bonifico, tutti i fornitori.",
    bullets: [
      "Pagamento a 30 giorni concordato",
      "Fatturazione elettronica SDI",
      "Riconciliazione automatica",
    ],
  },
  {
    code: "D",
    title: "Analytics",
    headline: "Spesa sotto controllo",
    body:
      "Dashboard con spesa mensile, prodotti più ordinati, scostamenti di prezzo, fornitori più affidabili. Esportabile in CSV, integrabile col commercialista.",
    bullets: [
      "Trend spesa per categoria",
      "Alert su aumenti di prezzo",
      "Confronto fornitori per performance",
    ],
  },
];

export function Capabilities() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const els = cardsRef.current.filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    if (prefersReducedMotion()) {
      els.forEach((el) => (el.style.opacity = "1"));
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: MOTION.stagger.block,
          ease: MOTION.easeEditorial,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: MOTION.scrollTrigger.defaultStart,
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
      id="capacita"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]">
        <div className="col-span-12 lg:col-span-4">
          <EditorialEyebrow number="— 04">CAPACITÀ</EditorialEyebrow>
        </div>
        <h2
          className="col-span-12 lg:col-span-8 font-display"
          style={{
            fontSize: "var(--type-marketing-h2)",
            lineHeight: "var(--type-marketing-h2-lh)",
            letterSpacing: "var(--type-marketing-h2-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          Quattro sistemi.
          <br />
          Un solo flusso.
        </h2>
        <p
          className="col-span-12 lg:col-span-6 lg:col-start-5"
          style={{
            fontSize: "var(--type-marketing-body)",
            lineHeight: "var(--type-marketing-body-lh)",
            color: "var(--color-marketing-ink-muted)",
            maxWidth: "56ch",
          }}
        >
          Catalogo, ordini, pagamenti, analytics. Pensati per parlarsi,
          non per essere quattro prodotti cuciti insieme.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px]">
        {CAPABILITIES.map((cap, i) => (
          <div
            key={cap.code}
            ref={(el) => {
              cardsRef.current[i] = el;
            }}
            className="opacity-0 flex flex-col"
            style={{
              border: "1px solid var(--color-marketing-rule)",
              padding: "clamp(32px, 3.5vw, 64px)",
              background: "var(--color-marketing-bg)",
              minHeight: "clamp(360px, 36vw, 460px)",
            }}
          >
            <div className="flex items-baseline justify-between mb-10">
              <p
                className="font-mono uppercase"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.22em",
                  color: "var(--color-marketing-primary)",
                }}
              >
                {cap.code} — {cap.title}
              </p>
              <p
                className="font-mono tabular-nums"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  color: "var(--color-marketing-ink-subtle)",
                }}
              >
                0{i + 1} / 04
              </p>
            </div>
            <h3
              className="font-display mb-6"
              style={{
                fontSize: "clamp(28px, 3vw, 44px)",
                lineHeight: "1.05",
                letterSpacing: "-0.02em",
                color: "var(--color-marketing-ink)",
              }}
            >
              {cap.headline}
            </h3>
            <p
              className="mb-10 max-w-[42ch]"
              style={{
                fontSize: "16px",
                lineHeight: "1.55",
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {cap.body}
            </p>
            <ul className="space-y-2 mt-auto">
              {cap.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-baseline gap-3"
                  style={{
                    fontSize: "14px",
                    color: "var(--color-marketing-ink)",
                  }}
                >
                  <span
                    aria-hidden
                    className="font-display"
                    style={{ color: "var(--color-marketing-primary)" }}
                  >
                    —
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
