"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-config";

const STATS = [
  { target: 500, suffix: "+", label: "Ristoranti Attivi" },
  { target: 150, suffix: "+", label: "Fornitori Verificati" },
  { target: 10000, suffix: "+", label: "Prodotti Disponibili" },
  { target: 98, suffix: "%", label: "Tasso di Soddisfazione" },
];

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      STATS.forEach((stat, i) => {
        const el = numberRefs.current[i];
        if (el) el.textContent = stat.target.toLocaleString("it-IT") + stat.suffix;
      });
      return;
    }

    const ctx = gsap.context(() => {
      STATS.forEach((stat, i) => {
        const el = numberRefs.current[i];
        if (!el) return;

        el.textContent = "0" + stat.suffix;
        const obj = { val: 0 };

        gsap.to(obj, {
          val: stat.target,
          duration: 2.5,
          ease: "power2.out",
          delay: i * 0.1,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            once: true,
          },
          onUpdate() {
            el.textContent = Math.round(obj.val).toLocaleString("it-IT") + stat.suffix;
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="numeri" className="py-20 px-4 bg-cream">
      <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center ${
              i < STATS.length - 1 ? "lg:border-r lg:border-forest/10" : ""
            }`}
          >
            <span
              ref={(el) => { numberRefs.current[i] = el; }}
              className="block text-4xl sm:text-5xl font-display text-forest mb-2"
            >
              0{stat.suffix}
            </span>
            <span className="text-sm text-forest/60 font-body">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
