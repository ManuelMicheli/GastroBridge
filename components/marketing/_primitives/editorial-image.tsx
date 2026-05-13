"use client";

import Image, { type ImageProps } from "next/image";
import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { prefersReducedMotion } from "@/lib/marketing-motion";

type Overlay = "none" | "soft" | "heavy" | "duotone-burgundy" | "duotone-warm";

type EditorialImageProps = {
  src: ImageProps["src"];
  alt: string;
  /** Tailwind aspect class, e.g. "aspect-[4/5] md:aspect-[21/9]". */
  aspectClassName?: string;
  /** Legacy single-aspect string ("21/9"). */
  aspect?: string;
  priority?: boolean;
  sizes?: string;
  overlay?: Overlay;
  parallax?: boolean;
  parallaxStrength?: number;
  grain?: boolean;
  className?: string;
  scrim?: number;
  fit?: "cover" | "contain";
  position?: string;
};

const OVERLAY_STYLE: Record<Overlay, React.CSSProperties> = {
  none: {},
  soft: {
    background:
      "linear-gradient(180deg, rgba(15,15,16,0) 0%, rgba(15,15,16,0.35) 78%, rgba(15,15,16,0.6) 100%)",
  },
  heavy: {
    background:
      "linear-gradient(180deg, rgba(9,9,15,0.55) 0%, rgba(9,9,15,0.7) 60%, rgba(9,9,15,0.86) 100%)",
  },
  "duotone-burgundy": {
    background:
      "linear-gradient(135deg, rgba(78,21,32,0.55) 0%, rgba(15,15,16,0.65) 100%)",
    mixBlendMode: "multiply",
  },
  "duotone-warm": {
    background:
      "linear-gradient(140deg, rgba(46,27,18,0.5) 0%, rgba(107,31,46,0.55) 60%, rgba(15,15,16,0.7) 100%)",
    mixBlendMode: "multiply",
  },
};

export function EditorialImage({
  src,
  alt,
  aspect,
  aspectClassName,
  priority = false,
  sizes = "100vw",
  overlay = "soft",
  parallax = false,
  parallaxStrength = 0.18,
  grain = true,
  className,
  scrim,
  fit = "cover",
  position = "center",
}: EditorialImageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!parallax || prefersReducedMotion()) return;
    const wrap = wrapRef.current;
    const inner = imgWrapRef.current;
    if (!wrap || !inner) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        inner,
        { yPercent: -parallaxStrength * 100 * 0.5 },
        {
          yPercent: parallaxStrength * 100 * 0.5,
          ease: "none",
          scrollTrigger: {
            trigger: wrap,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        }
      );
      ScrollTrigger.refresh();
    }, wrap);
    return () => ctx.revert();
  }, [parallax, parallaxStrength]);

  const aspectClass = aspectClassName ?? (aspect ? "" : "aspect-[16/10]");
  const inlineAspect = aspect && !aspectClassName ? { aspectRatio: aspect } : undefined;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden ${aspectClass} ${className ?? ""}`}
      style={{ isolation: "isolate", ...inlineAspect }}
    >
      <div
        ref={imgWrapRef}
        className="absolute inset-0"
        style={parallax ? { willChange: "transform", height: "120%", top: "-10%" } : undefined}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          quality={92}
          style={{
            objectFit: fit,
            objectPosition: position,
          }}
        />
      </div>

      {overlay !== "none" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={OVERLAY_STYLE[overlay]}
        />
      )}

      {scrim !== undefined && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `rgba(9,9,15,${Math.min(Math.max(scrim, 0), 1)})` }}
        />
      )}

      {grain && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.14,
            mixBlendMode: "overlay",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: "240px 240px",
          }}
        />
      )}
    </div>
  );
}
