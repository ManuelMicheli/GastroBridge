"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/formatters";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, canAnimate } from "@/lib/marketing-motion";

// v1 — restaurant-only FAQ. Blockers that stop a signup come first; billing /
// privacy / export / coverage follow. Prices reflect the real model (€50/€150).
type Item = { q: string; a: string };

const ITEMS: readonly Item[] = [
  {
    q: "Devo trovare nuovi fornitori sulla piattaforma?",
    a: "No. GastroBridge parte dai fornitori con cui già lavori: li aggiungi tu e importi i loro listini. Non è un marketplace — è lo strumento per digitalizzare e ordinare dai tuoi fornitori di sempre.",
  },
  {
    q: "Come importo i miei cataloghi?",
    a: "Aggiungi un fornitore e carichi il suo listino: a mano oppure importando un file CSV/Excel. Da quel momento ordini sempre da lì, con i prezzi che aggiorni una volta sola.",
  },
  {
    q: "Quanto tempo prima del primo ordine?",
    a: "Cinque minuti per registrarti e il tempo di caricare un listino — anche da CSV. Il primo ordine può partire lo stesso giorno.",
  },
  {
    q: "I pagamenti passano dalla piattaforma?",
    a: "Per ora no. GastroBridge è lo strumento per gestire fornitori, cataloghi e ordini: i pagamenti ai fornitori continui a farli come sempre, fuori dalla piattaforma.",
  },
  {
    q: "Quanto costa?",
    a: "Un canone fisso per usare lo strumento, niente percentuali sugli ordini. I prezzi sono in fase di definizione — li annunceremo presto. Prova gratis 14 giorni, senza carta, disdici quando vuoi.",
  },
  {
    q: "Privacy e proprietà dei dati?",
    a: "I tuoi dati restano tuoi: niente rivendita a terzi, niente profilazione cross-platform. Conservazione conforme a GDPR. Esporti storico ordini e listini in CSV/PDF, o cancelli l'account, in ogni momento.",
  },
] as const;

export function Objections() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const revealAll = () => {
      headRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      listRef.current?.querySelectorAll<HTMLElement>("[data-row]").forEach((el) => (el.style.opacity = "1"));
    };
    // Mobile / reduced-motion: show content immediately, never load GSAP.
    if (!canAnimate()) {
      revealAll();
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/gsap-config").then(({ gsap }) => {
      if (cancelled) return;
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
