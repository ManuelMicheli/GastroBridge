"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Pause, Play } from "lucide-react";
import { gsap } from "@/lib/gsap-config";

const TESTIMONIALS = [
  {
    quote:
      "GastroBridge ha rivoluzionato il modo in cui gestiamo i nostri fornitori. Risparmiamo ore ogni settimana.",
    name: "Marco R.",
    role: "Chef Exec, Ristorante Esempio",
  },
  {
    quote:
      "Da quando usiamo la piattaforma, abbiamo aumentato i clienti del 40% in tre mesi.",
    name: "Laura B.",
    role: "Fornitore, Azienda Esempio",
  },
  {
    quote:
      "Confrontare prezzi non e mai stato cosi semplice. Un must per ogni ristoratore.",
    name: "Giuseppe T.",
    role: "Proprietario, Trattoria Esempio",
  },
];

export function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const quoteRef = useRef<HTMLBlockquoteElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => {
      if (index === current) return;
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced || !quoteRef.current) {
        setCurrent(index);
        return;
      }

      const dir = index > current ? 1 : -1;

      gsap.to(quoteRef.current, {
        opacity: 0,
        x: dir * -30,
        duration: 0.3,
        onComplete() {
          setCurrent(index);
          gsap.fromTo(
            quoteRef.current,
            { opacity: 0, x: dir * 30 },
            { opacity: 1, x: 0, duration: 0.3 }
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

  // Auto-rotate
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(next, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, next]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    const section = document.getElementById("testimonianze");
    section?.addEventListener("keydown", onKey);
    return () => section?.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const t = TESTIMONIALS[current];

  return (
    <section
      id="testimonianze"
      className="py-24 px-4 bg-forest-dark"
      tabIndex={-1}
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onFocus={() => setPlaying(false)}
      onBlur={() => setPlaying(true)}
    >
      <div className="max-w-3xl mx-auto text-center relative" aria-live="polite">
        {/* Decorative quote */}
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[8rem] font-display text-cream/[0.06] select-none leading-none">
          &ldquo;
        </span>

        <blockquote ref={quoteRef} className="relative z-10">
          <p className="text-xl sm:text-2xl font-display italic text-cream leading-relaxed mb-8">
            &ldquo;{t.quote}&rdquo;
          </p>
          <footer>
            <p className="text-cream font-semibold font-body">{t.name}</p>
            <p className="text-cream/70 text-sm font-body">{t.role}</p>
          </footer>
        </blockquote>

        {/* Navigation */}
        <div
          className="flex items-center justify-center gap-3 mt-10"
          role="tablist"
          aria-label="Testimonials"
        >
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={`Testimonial ${i + 1}`}
              onClick={() => goTo(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "bg-accent-orange scale-125"
                  : "bg-cream/30 hover:bg-cream/50"
              }`}
            />
          ))}
          <button
            onClick={() => setPlaying(!playing)}
            className="ml-3 text-cream/30 hover:text-cream/60 transition-colors"
            aria-label={playing ? "Pausa" : "Riproduci"}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}
