"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { QuotePull } from "./_primitives/quote-pull";
import { prefersReducedMotion } from "@/lib/marketing-motion";

const TESTIMONIALS = [
  {
    quote:
      "GastroBridge ha trasformato il modo in cui gestiamo i fornitori. Ore risparmiate ogni settimana, e finalmente una visione chiara della spesa mensile — per categoria, per fornitore, per piatto del menu.",
    author: "Marco R.",
    role: "Chef Executive — Ristorante Bellaria, Milano",
  },
  {
    quote:
      "Da quando siamo sulla piattaforma, abbiamo aperto a quaranta nuovi ristoranti in tre mesi. Senza costi di acquisizione, senza telefonate, senza fiere. Il catalogo lavora al posto nostro.",
    author: "Laura B.",
    role: "Responsabile vendite — Caseificio Artigiano, Lodi",
  },
  {
    quote:
      "Confrontare prezzi non è mai stato così immediato. Vedo in trenta secondi se il mio fornitore storico è ancora competitivo oppure se è il momento di parlarci. Un cambio di categoria per chi lavora ogni giorno in cucina.",
    author: "Giuseppe T.",
    role: "Proprietario — Trattoria dei Navigli, Milano",
  },
  {
    quote:
      "Siamo un panificio piccolo. Pensavamo che una piattaforma non facesse per noi. Invece ci ha permesso di uscire dalla nostra provincia senza snaturarci: stessi clienti, stesso prodotto, solo più tracciabili.",
    author: "Elena F.",
    role: "Co-fondatrice — Panificio Est, Bergamo",
  },
  {
    quote:
      "La cosa che mi ha convinto è la trasparenza: nessuna commissione nascosta, nessuno sta in mezzo. È un rapporto diretto con il fornitore, ma con tutta la comodità del digitale.",
    author: "Davide C.",
    role: "Direttore F&B — Gruppo Alberghiero Lariano",
  },
];

export function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => {
      if (index === current) return;
      if (prefersReducedMotion() || !wrapRef.current) {
        setCurrent(index);
        return;
      }
      const dir = index > current ? 1 : -1;
      gsap.to(wrapRef.current, {
        opacity: 0,
        x: dir * -16,
        duration: 0.3,
        ease: "power2.in",
        onComplete() {
          setCurrent(index);
          gsap.fromTo(
            wrapRef.current,
            { opacity: 0, x: dir * 16 },
            { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }
          );
        },
      });
    },
    [current]
  );

  const next = useCallback(() => {
    goTo((current + 1) % TESTIMONIALS.length);
  }, [current, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, [current, goTo]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(next, 7000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, next]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    const section = document.getElementById("testimonianze");
    section?.addEventListener("keydown", onKey);
    return () => section?.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const t = TESTIMONIALS[current] ?? TESTIMONIALS[0]!;

  return (
    <section
      id="testimonianze"
      tabIndex={-1}
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onFocus={() => setPlaying(false)}
      onBlur={() => setPlaying(true)}
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
        background: "var(--color-marketing-bg-soft)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10">
        <div className="col-span-12 lg:col-span-4">
          <EditorialEyebrow number="— 07">VOCI</EditorialEyebrow>
        </div>

        <div className="col-span-12 lg:col-span-8" aria-live="polite">
          <div ref={wrapRef}>
            <QuotePull quote={t.quote} author={t.author} role={t.role} />
          </div>

          {/* Index plate */}
          <div
            className="flex items-center gap-6 mt-14"
            role="tablist"
            aria-label="Testimonianze"
          >
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`Testimonianza ${i + 1} di ${TESTIMONIALS.length}`}
                onClick={() => goTo(i)}
                className="font-mono uppercase tracking-[0.18em] text-[12px] transition-colors"
                style={{
                  color:
                    i === current
                      ? "var(--color-marketing-primary)"
                      : "var(--color-marketing-ink-subtle)",
                }}
              >
                0{i + 1}
              </button>
            ))}
            <span
              aria-hidden
              className="h-px flex-1 max-w-[120px]"
              style={{ background: "var(--color-marketing-rule)" }}
            />
            <button
              onClick={() => setPlaying(!playing)}
              className="font-mono uppercase tracking-[0.18em] text-[12px] text-[var(--color-marketing-ink-subtle)] hover:text-[var(--color-marketing-ink)] link-editorial"
              aria-label={playing ? "Pausa" : "Riproduci"}
            >
              {playing ? "Pausa" : "Play"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
