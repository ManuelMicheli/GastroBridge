"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { QuotePull } from "./_primitives/quote-pull";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona, type Persona } from "@/lib/marketing-persona-context";

type Cell = { year: string; value: number; label: string; stair: number };

const RESTAURANT_CELLS: readonly Cell[] = [
  { year: "2024", value: 110, label: "ristoranti", stair: 0 },
  { year: "2025", value: 410, label: "ristoranti", stair: 6 },
  { year: "2026", value: 1247, label: "ristoranti", stair: 12 },
  { year: "2027", value: 2800, label: "obiettivo", stair: 18 },
] as const;

const SUPPLIER_CELLS: readonly Cell[] = [
  { year: "2024", value: 28, label: "fornitori", stair: 0 },
  { year: "2025", value: 120, label: "fornitori", stair: 6 },
  { year: "2026", value: 312, label: "fornitori", stair: 12 },
  { year: "2027", value: 720, label: "obiettivo", stair: 18 },
] as const;

const HEADLINE_TOTAL: Record<Persona, { value: number; label: string; mom: string }> = {
  restaurant: { value: 1247, label: "ristoranti attivi al mese", mom: "▲ +18% MoM" },
  supplier: { value: 312, label: "fornitori live al mese", mom: "▲ +12% MoM" },
};

const TESTIMONIALS: Record<Persona, readonly { quote: string; author: string; role: string }[]> = {
  restaurant: [
    {
      quote:
        "Da quando uso GBR ordino in due minuti quello che prima richiedeva trenta telefonate. La spesa mensile la vedo per categoria, per fornitore, per piatto.",
      author: "Marco T.",
      role: "Chef · Pizzeria Centrale, Milano",
    },
    {
      quote:
        "Confronto prezzi in trenta secondi. Vedo subito se il mio fornitore storico è ancora competitivo. Senza piattaforme parallele, senza foglio Excel.",
      author: "Giuseppe T.",
      role: "Proprietario · Trattoria dei Navigli, Milano",
    },
    {
      quote:
        "La trasparenza è la cosa che mi ha convinto. Nessuna commissione nascosta, nessuno in mezzo. Rapporto diretto col fornitore con tutta la comodità del digitale.",
      author: "Davide C.",
      role: "F&B · Gruppo Lariano",
    },
  ],
  supplier: [
    {
      quote:
        "Da quando siamo sulla rete abbiamo aperto a quaranta nuovi ristoranti in tre mesi. Senza fiere, senza chiamate a freddo. Il listino lavora al posto nostro.",
      author: "Laura B.",
      role: "Vendite · Caseificio Artigiano, Lodi",
    },
    {
      quote:
        "Aggiorno un prezzo una volta e lo vedono tutti. Niente più listini di carta da rispedire. Il magazzino è felice perché gli ordini arrivano già strutturati.",
      author: "Stefano M.",
      role: "Titolare · Ortofrutta Po, Cremona",
    },
    {
      quote:
        "Siamo un panificio piccolo. Pensavamo non facesse per noi. Invece siamo usciti dalla provincia senza snaturarci. Stessi prodotti, solo più tracciati.",
      author: "Elena F.",
      role: "Co-fondatrice · Panificio Est, Bergamo",
    },
  ],
};

export function Proof() {
  const sectionRef = useRef<HTMLElement>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const cellValueRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { persona } = usePersona();

  const cells = persona === "supplier" ? SUPPLIER_CELLS : RESTAURANT_CELLS;
  const headline = HEADLINE_TOTAL[persona];
  const quotes = TESTIMONIALS[persona];

  useEffect(() => {
    setCurrent(0);
  }, [persona]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      cellsRef.current?.querySelectorAll<HTMLElement>("[data-cell]").forEach((c) => (c.style.opacity = "1"));
      cells.forEach((c, i) => {
        const el = cellValueRefs.current[i];
        if (el) el.textContent = c.value.toLocaleString("it-IT");
      });
      if (totalRef.current) totalRef.current.textContent = headline.value.toLocaleString("it-IT");
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cellsRef.current?.querySelectorAll("[data-cell]") ?? [],
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: 0.1,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: cellsRef.current, start: "top 80%", once: true },
        }
      );

      const counter = (el: HTMLElement | null, target: number) => {
        if (!el) return;
        const state = { v: 0 };
        gsap.to(state, {
          v: target,
          duration: MOTION.duration.counter,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: () => {
            el.textContent = Math.round(state.v).toLocaleString("it-IT");
          },
        });
      };

      counter(totalRef.current, headline.value);
      cells.forEach((c, i) => counter(cellValueRefs.current[i] ?? null, c.value));
    }, sectionRef);

    return () => ctx.revert();
  }, [cells, headline.value]);

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

  const next = useCallback(() => goTo((current + 1) % quotes.length), [current, goTo, quotes.length]);
  const prev = useCallback(
    () => goTo((current - 1 + quotes.length) % quotes.length),
    [current, goTo, quotes.length]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let active = false;

    function onDown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      active = true;
      startX = e.clientX;
      startY = e.clientY;
    }
    function onUp(e: PointerEvent) {
      if (!active) return;
      active = false;
      if (e.pointerType !== "touch") return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) next();
      else prev();
    }

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", () => (active = false));
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [next, prev]);

  useEffect(() => {
    if (playing) intervalRef.current = setInterval(next, 7500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, next]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    const section = sectionRef.current;
    section?.addEventListener("keydown", onKey);
    return () => section?.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const safeCurrent = useMemo(
    () => Math.max(0, Math.min(current, quotes.length - 1)),
    [current, quotes.length]
  );
  const t = quotes[safeCurrent] ?? quotes[0]!;

  return (
    <section
      ref={sectionRef}
      id="crescita"
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
        background: "var(--color-marketing-bg)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10">
        <div className="col-span-12 lg:col-span-6">
          <EditorialEyebrow number="— 03" className="mb-6">I NUMERI</EditorialEyebrow>
          <h2
            className="font-display"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            La rete cresce.
            <br />
            <span style={{ color: "var(--color-marketing-ink-muted)" }}>Mese dopo mese.</span>
          </h2>
        </div>

        <div className="col-span-12 lg:col-span-5 lg:col-start-8 flex flex-col justify-between">
          <EditorialEyebrow className="mb-6">{headline.label.toUpperCase()}</EditorialEyebrow>
          <div
            className="font-display"
            style={{
              fontSize: "var(--type-marketing-mega)",
              lineHeight: "var(--type-marketing-mega-lh)",
              letterSpacing: "var(--type-marketing-mega-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            <span ref={totalRef}>0</span>
            <span style={{ color: "var(--color-marketing-primary)" }}>+</span>
          </div>
          <p
            className="mt-4 font-mono uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.22em",
              color: "var(--color-marketing-primary)",
            }}
          >
            {headline.mom}
          </p>
        </div>
      </div>

      <hr
        className="my-[clamp(48px,6vw,96px)]"
        style={{ borderTop: "1px solid var(--color-marketing-rule)", borderLeft: 0, borderRight: 0, borderBottom: 0 }}
      />

      <div ref={cellsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {cells.map((cell, i) => (
          <div
            key={cell.year}
            data-cell
            className="relative flex flex-col justify-between opacity-0 lg:[margin-top:var(--stair)]"
            style={
              {
                ["--stair" as string]: `${cell.stair}vw`,
                border: "1px solid var(--color-marketing-rule)",
                padding: "clamp(24px, 3vw, 56px)",
                minHeight: "clamp(220px, 22vw, 320px)",
                background: "var(--color-marketing-bg)",
              } as React.CSSProperties
            }
          >
            <p
              className="font-mono uppercase"
              style={{
                fontSize: "var(--type-marketing-eyebrow)",
                letterSpacing: "var(--type-marketing-eyebrow-ls)",
                color: "var(--color-marketing-ink-subtle)",
              }}
            >
              {cell.year}
            </p>
            <div className="mt-10">
              <div
                className="font-display leading-[0.9]"
                style={{
                  fontSize: "clamp(48px, 7vw, 112px)",
                  letterSpacing: "var(--type-marketing-display-ls)",
                  color: "var(--color-marketing-ink)",
                }}
              >
                <span ref={(el) => { cellValueRefs.current[i] = el; }}>0</span>
              </div>
              <p
                className="mt-3"
                style={{
                  fontSize: "13px",
                  color: "var(--color-marketing-ink-muted)",
                }}
              >
                {cell.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[clamp(72px,9vw,144px)] grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10" aria-live="polite">
        <div className="col-span-12 lg:col-span-4">
          <EditorialEyebrow number="— 03b">VOCI · {persona === "supplier" ? "FORNITORI" : "RISTORATORI"}</EditorialEyebrow>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div ref={wrapRef}>
            <QuotePull quote={t.quote} author={t.author} role={t.role} />
          </div>

          <div className="flex items-center gap-6 mt-14" role="tablist" aria-label="Testimonianze">
            {quotes.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === safeCurrent}
                aria-label={`Testimonianza ${i + 1} di ${quotes.length}`}
                onClick={() => goTo(i)}
                className="font-mono uppercase tracking-[0.18em] text-[12px] transition-colors"
                style={{
                  color:
                    i === safeCurrent
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
