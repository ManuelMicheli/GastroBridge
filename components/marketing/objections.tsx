"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/formatters";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { gsap } from "@/lib/gsap-config";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

// v1 — restaurant-only FAQ. Blockers that stop a signup come first; billing /
// privacy / export / coverage follow. Prices reflect the real model (€50/€150).
type Item = { q: string; a: string };

const ITEMS: readonly Item[] = [
  {
    q: "Cosa succede se il fornitore non consegna?",
    a: "Rimborso garantito entro sette giorni. Mediazione GastroBridge sulle dispute, audit del fornitore in caso di mancate consegne ripetute. Se i problemi continuano, viene sospeso dalla rete.",
  },
  {
    q: "Posso continuare con i miei fornitori storici?",
    a: "Sì. Nessuna esclusiva. Usaci per alcune categorie, lavora offline per altre. Quando vuoi tornare al telefono sei libero — semplicemente non ti sblocchiamo il listino vivo.",
  },
  {
    q: "Quanto tempo prima del primo ordine?",
    a: "Cinque minuti per registrarti, dieci per impostare gli alert sui prezzi delle categorie che usi. Il primo ordine può partire lo stesso giorno se trovi un fornitore già verificato sulla tua zona.",
  },
  {
    q: "Quanto costa?",
    a: "Base €50/mese, Pro €150/mese. Zero commissioni sulle transazioni: paghi il canone, non gli ordini. Prova gratis 14 giorni, senza carta, disdici quando vuoi. Stripe per i pagamenti, fattura elettronica al cassetto fiscale.",
  },
  {
    q: "Privacy dei dati ordini?",
    a: "Niente rivendita dati a terzi, niente profilazione cross-platform. Il volume aggregato della rete viene usato solo per benchmark anonimi. Conservazione conforme a GDPR, esporti o cancelli l'account in ogni momento.",
  },
  {
    q: "Posso esportare i miei dati?",
    a: "Sì. Storico ordini in CSV/XLSX, fatture in PDF, transazioni Stripe direttamente dal pannello. Niente lock-in: se decidi di andare via, esci con tutto ciò che hai prodotto sulla piattaforma.",
  },
  {
    q: "In quali zone siete attivi?",
    a: "Nord Italia: Lombardia, Piemonte, Veneto, Emilia-Romagna. Apertura Liguria, Trentino e Toscana nel 2026. Se la tua zona non è coperta, ti avvisiamo all'attivazione — nessun account fantasma in lista d'attesa.",
  },
] as const;

export function Objections() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      headRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      listRef.current?.querySelectorAll<HTMLElement>("[data-row]").forEach((el) => (el.style.opacity = "1"));
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
          scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true },
        }
      );
      gsap.fromTo(
        listRef.current?.querySelectorAll("[data-row]") ?? [],
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: 0.05,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: listRef.current, start: "top 78%", once: true },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="faq"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10">
        <div
          ref={headRef}
          className="col-span-12 lg:col-span-4 lg:sticky lg:top-32 lg:self-start"
        >
          <div data-reveal className="opacity-0">
            <EditorialEyebrow number="— 05" className="mb-6">DUBBI</EditorialEyebrow>
          </div>
          <h2
            data-reveal
            className="font-display opacity-0"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Le domande
            <br />
            <span style={{ color: "var(--color-marketing-ink-muted)" }}>che ci fate spesso.</span>
          </h2>
          <p
            data-reveal
            className="opacity-0 mt-8 font-mono uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.22em",
              color: "var(--color-marketing-ink-subtle)",
            }}
          >
            Non trovi la risposta?{" "}
            <a
              href="mailto:ciao@gastrobridge.it"
              className="link-editorial"
              style={{ color: "var(--color-marketing-primary)" }}
            >
              Scrivici
            </a>
          </p>
        </div>

        <div
          ref={listRef}
          className="col-span-12 lg:col-span-8"
          style={{ borderTop: "1px solid var(--color-marketing-rule)" }}
        >
          {ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const id = `obj-answer-${i}`;
            return (
              <div
                key={item.q}
                data-row
                className="opacity-0"
                style={{ borderBottom: "1px solid var(--color-marketing-rule)" }}
              >
                <button
                  id={`obj-q-${i}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-6 lg:py-7 text-left"
                  aria-expanded={isOpen}
                  aria-controls={id}
                >
                  <span className="flex items-baseline gap-5 pr-8">
                    <span
                      className="font-mono uppercase shrink-0"
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.22em",
                        color: isOpen ? "var(--color-marketing-primary)" : "var(--color-marketing-ink-subtle)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="font-body font-medium"
                      style={{
                        fontSize: "clamp(17px, 1.6vw, 20px)",
                        lineHeight: "1.32",
                        color: "var(--color-marketing-ink)",
                      }}
                    >
                      {item.q}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "font-display leading-none transition-transform shrink-0",
                      isOpen ? "rotate-45" : "rotate-0"
                    )}
                    style={{
                      fontSize: "24px",
                      width: "24px",
                      height: "24px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-marketing-primary)",
                      transitionDuration: "360ms",
                      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  id={id}
                  role="region"
                  aria-labelledby={`obj-q-${i}`}
                  className={cn(
                    "overflow-hidden transition-all",
                    isOpen ? "max-h-[400px] pb-7" : "max-h-0"
                  )}
                  style={{
                    transitionDuration: "420ms",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  <p
                    className="max-w-[64ch] pl-12"
                    style={{
                      fontSize: "16px",
                      lineHeight: "1.62",
                      color: "var(--color-marketing-ink-muted)",
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
