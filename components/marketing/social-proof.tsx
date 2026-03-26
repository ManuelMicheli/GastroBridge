"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-config";

const PLACEHOLDER_LOGOS = [
  { shape: "circle", size: "w-10 h-10" },
  { shape: "rounded", size: "w-12 h-8" },
  { shape: "circle", size: "w-9 h-9" },
  { shape: "rounded", size: "w-14 h-8" },
  { shape: "circle", size: "w-11 h-11" },
  { shape: "rounded", size: "w-10 h-8" },
  { shape: "circle", size: "w-10 h-10" },
  { shape: "rounded", size: "w-13 h-8" },
];

export function SocialProof() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.8,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 90%",
            once: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const logos = PLACEHOLDER_LOGOS.map((logo, i) => (
    <div
      key={i}
      className={`${logo.size} ${
        logo.shape === "circle" ? "rounded-full" : "rounded-lg"
      } bg-forest/15 opacity-40 hover:opacity-100 transition-opacity duration-300 flex-shrink-0`}
    />
  ));

  return (
    <section
      ref={sectionRef}
      id="social-proof"
      className="gsap-reveal py-16 bg-cream border-b border-forest/10 overflow-hidden"
    >
      <p className="text-center text-xs uppercase tracking-[0.2em] text-forest/50 font-semibold mb-10">
        Scelto da ristoranti e fornitori in tutta Italia
      </p>

      <div className="relative">
        <div className="flex gap-12 marquee-track" style={{ width: "max-content" }}>
          {logos}
          {logos}
        </div>
      </div>
    </section>
  );
}
