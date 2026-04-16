# Landing Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the GastroBridge marketing landing page with a premium "Monochrome Forest" design featuring GSAP animations, parallax 3D, and split text reveals.

**Architecture:** Rewrite all marketing components as client components using GSAP (ScrollTrigger, SplitText, ScrollToPlugin) for scroll-based animations. A shared `gsap-config.ts` handles plugin registration. Each section is a standalone component with its own scroll animations, composed in `app/(marketing)/page.tsx`. Native scroll (no ScrollSmoother).

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, GSAP 3.14 (ScrollTrigger, SplitText, ScrollToPlugin), `@gsap/react`, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-26-landing-page-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/gsap-config.ts` | Create | GSAP plugin registration (ScrollTrigger, SplitText, ScrollToPlugin) |
| `lib/animations.ts` | Create | Reusable animation presets: fadeInUp, splitReveal, counterAnimation |
| `app/globals.css` | Modify | Add marketing-specific CSS: mesh gradient keyframes, marquee animation, scroll-triggered initial states |
| `components/layout/marketing-nav.tsx` | Rewrite | Glassmorphism navbar, anchor links, scroll-spy, compact-on-scroll |
| `components/marketing/hero.tsx` | Rewrite | Full-viewport hero, mesh gradient bg, SplitText headline, badge, CTAs, stats |
| `components/marketing/social-proof.tsx` | Create | Logo marquee strip, CSS-only animation |
| `components/marketing/how-it-works.tsx` | Rewrite | Dark bg, 3 cards with watermark numbers, SVG connector line |
| `components/marketing/dual-section.tsx` | Create | Split cream/forest, parallax 3D with ScrollTrigger scrub |
| `components/marketing/stats.tsx` | Create | 4 counter stats with GSAP scroll-triggered count-up |
| `components/marketing/testimonials.tsx` | Rewrite | Single-testimonial carousel, auto-rotate, keyboard nav, a11y |
| `components/marketing/faq.tsx` | Create | 2-column sticky title + accordion, smooth height animation |
| `components/marketing/cta-section.tsx` | Rewrite | Mesh gradient bg, SplitText with rotationX reveal |
| `components/layout/footer.tsx` | Rewrite | 4-column charcoal footer |
| `app/(marketing)/page.tsx` | Modify | Import new sections, remove Categories |
| `app/(marketing)/layout.tsx` | Modify | Add skip-to-content link, remove pt-16 (hero is full-screen behind navbar) |

---

## Task 1: GSAP Config & Animation Utilities

**Files:**
- Create: `lib/gsap-config.ts`
- Create: `lib/animations.ts`

- [ ] **Step 1: Create GSAP plugin registration**

```typescript
// lib/gsap-config.ts
"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText);
}

export { gsap, ScrollTrigger, ScrollToPlugin, SplitText };
```

- [ ] **Step 2: Create reusable animation presets**

```typescript
// lib/animations.ts
"use client";

import { gsap, ScrollTrigger } from "@/lib/gsap-config";

/** Fade-in + slide-up triggered on scroll */
export function fadeInUp(
  element: gsap.TweenTarget,
  options?: { delay?: number; duration?: number; y?: number; trigger?: string | Element }
) {
  return gsap.fromTo(
    element,
    { opacity: 0, y: options?.y ?? 30 },
    {
      opacity: 1,
      y: 0,
      duration: options?.duration ?? 0.8,
      delay: options?.delay ?? 0,
      ease: "power3.out",
      scrollTrigger: {
        trigger: (options?.trigger ?? element) as gsap.DOMTarget,
        start: "top 80%",
        once: true,
      },
    }
  );
}

/** Animate a number from 0 to target on scroll */
export function counterAnimation(
  element: HTMLElement,
  target: number,
  options?: { duration?: number; suffix?: string; separator?: string }
) {
  const obj = { val: 0 };
  const suffix = options?.suffix ?? "";
  const sep = options?.separator ?? ".";

  return gsap.to(obj, {
    val: target,
    duration: options?.duration ?? 2.5,
    ease: "power2.out",
    scrollTrigger: {
      trigger: element,
      start: "top 80%",
      once: true,
    },
    onUpdate() {
      const formatted = Math.round(obj.val).toLocaleString("it-IT");
      element.textContent = formatted + suffix;
    },
  });
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`
Expected: Build succeeds or only pre-existing warnings

- [ ] **Step 4: Commit**

```bash
git add lib/gsap-config.ts lib/animations.ts
git commit -m "feat: add GSAP config and reusable animation utilities"
```

---

## Task 2: Global CSS — Marketing Animations & Initial States

**Files:**
- Modify: `app/globals.css` (append at end, after existing dashboard-dark section)

- [ ] **Step 1: Add marketing CSS at end of globals.css**

Append after line 205 (end of file):

```css
/* =========================================
   Marketing Landing Page — Animations & States
   ========================================= */

/* @property declarations for smooth mesh gradient interpolation */
@property --mesh-x1 { syntax: "<percentage>"; inherits: false; initial-value: 20%; }
@property --mesh-y1 { syntax: "<percentage>"; inherits: false; initial-value: 30%; }
@property --mesh-x2 { syntax: "<percentage>"; inherits: false; initial-value: 80%; }
@property --mesh-y2 { syntax: "<percentage>"; inherits: false; initial-value: 60%; }
@property --mesh-x3 { syntax: "<percentage>"; inherits: false; initial-value: 50%; }
@property --mesh-y3 { syntax: "<percentage>"; inherits: false; initial-value: 80%; }

/* Initial state for scroll-triggered elements — prevents FOUC */
.gsap-reveal {
  opacity: 0;
  transform: translateY(20px);
}

/* Mesh gradient animation */
@keyframes mesh-shift {
  0%, 100% {
    --mesh-x1: 20%;
    --mesh-y1: 30%;
    --mesh-x2: 80%;
    --mesh-y2: 60%;
    --mesh-x3: 50%;
    --mesh-y3: 80%;
  }
  33% {
    --mesh-x1: 40%;
    --mesh-y1: 50%;
    --mesh-x2: 60%;
    --mesh-y2: 30%;
    --mesh-x3: 30%;
    --mesh-y3: 60%;
  }
  66% {
    --mesh-x1: 60%;
    --mesh-y1: 20%;
    --mesh-x2: 30%;
    --mesh-y2: 70%;
    --mesh-x3: 70%;
    --mesh-y3: 40%;
  }
}

.mesh-gradient {
  background:
    radial-gradient(ellipse at var(--mesh-x1, 20%) var(--mesh-y1, 30%), rgba(27, 107, 74, 0.4) 0%, transparent 60%),
    radial-gradient(ellipse at var(--mesh-x2, 80%) var(--mesh-y2, 60%), rgba(20, 82, 56, 0.5) 0%, transparent 60%),
    radial-gradient(ellipse at var(--mesh-x3, 50%) var(--mesh-y3, 80%), rgba(45, 212, 122, 0.15) 0%, transparent 60%),
    var(--color-forest-dark);
  animation: mesh-shift 20s ease-in-out infinite;
}

/* Marquee animation */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.marquee-track {
  animation: marquee 30s linear infinite;
}

.marquee-track:hover {
  animation-play-state: paused;
}

/* Reduced motion: show everything, disable animations */
@media (prefers-reduced-motion: reduce) {
  .gsap-reveal {
    opacity: 1;
    transform: none;
  }
  .mesh-gradient {
    animation: none;
  }
  .marquee-track {
    animation: none;
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add marketing CSS for mesh gradient, marquee, and scroll reveal states"
```

---

## Task 3: Marketing Nav — Glassmorphism & Scroll Spy

**Files:**
- Rewrite: `components/layout/marketing-nav.tsx`

- [ ] **Step 1: Rewrite marketing-nav.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { gsap, ScrollToPlugin } from "@/lib/gsap-config";

const NAV_LINKS = [
  { href: "#come-funziona", label: "Come Funziona", type: "anchor" as const },
  { href: "#per-chi", label: "Per Chi", type: "anchor" as const },
  { href: "/pricing", label: "Prezzi", type: "page" as const },
  { href: "#faq", label: "FAQ", type: "anchor" as const },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // Compact on scroll
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    const sectionIds = NAV_LINKS.filter((l) => l.type === "anchor").map((l) =>
      l.href.replace("#", "")
    );
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -40% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    setMobileOpen(false);
    const target = document.querySelector(href);
    if (target) {
      gsap.to(window, {
        scrollTo: { y: target, offsetY: 80 },
        duration: 1,
        ease: "power3.inOut",
      });
    }
  }

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-forest-dark/95 backdrop-blur-xl h-14"
          : "bg-forest-dark/80 backdrop-blur-xl h-16"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-full">
        <Link href="/" className="flex items-center">
          <span className="text-xl font-display text-cream">Gastro</span>
          <span className="text-xl font-body font-bold text-accent-green">Bridge</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) =>
            link.type === "anchor" ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className={cn(
                  "text-sm text-cream/70 hover:text-cream transition-colors",
                  activeSection === link.href.replace("#", "") && "text-cream"
                )}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-cream/70 hover:text-cream transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-cream/70 hover:text-cream hover:bg-cream/10"
            >
              Accedi
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="bg-cream text-forest-dark hover:bg-cream/90"
            >
              Inizia Gratis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-cream"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile full-screen overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-forest-dark z-40 flex flex-col items-center justify-center gap-8">
          {NAV_LINKS.map((link, i) =>
            link.type === "anchor" ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className="text-2xl font-display text-cream hover:text-accent-green transition-colors"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-2xl font-display text-cream hover:text-accent-green transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <div className="flex gap-4 mt-8">
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button
                variant="ghost"
                size="lg"
                className="text-cream border border-cream/20 hover:bg-cream/10"
              >
                Accedi
              </Button>
            </Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)}>
              <Button size="lg" className="bg-cream text-forest-dark hover:bg-cream/90">
                Registrati
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/layout/marketing-nav.tsx
git commit -m "feat: redesign marketing nav with glassmorphism and scroll spy"
```

---

## Task 4: Hero Section — Mesh Gradient & SplitText

**Files:**
- Rewrite: `components/marketing/hero.tsx`

- [ ] **Step 1: Rewrite hero.tsx**

```tsx
"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { gsap, SplitText } from "@/lib/gsap-config";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Badge fade in
      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.6 },
        0.2
      );

      // Headline split text
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "words" });
        tl.fromTo(
          split.words,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 1 },
          0.4
        );
      }

      // Subtitle
      tl.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.4"
      );

      // CTAs
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.3"
      );

      // Stats
      tl.fromTo(
        statsRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6 },
        "-=0.2"
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
    >
      {/* Mesh gradient background */}
      <div className="absolute inset-0 mesh-gradient" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div ref={badgeRef} className="opacity-0 mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cream/20 text-cream/70 text-sm font-body">
            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
            La piattaforma Ho.Re.Ca. #1 in Italia
          </span>
        </div>

        {/* Headline */}
        <h1
          ref={headlineRef}
          className="opacity-0 font-display text-cream text-4xl sm:text-5xl lg:text-[5.5rem] leading-[1.1] tracking-tight mb-6"
        >
          Tutti i tuoi fornitori. Un solo posto.
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="opacity-0 text-cream/70 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-body"
        >
          Confronta prezzi, scopri fornitori e gestisci ordini per la tua attivita.
        </p>

        {/* CTAs */}
        <div ref={ctaRef} className="opacity-0 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-cream text-forest-dark hover:bg-cream/90 shadow-lg"
            >
              Inizia Gratis <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-cream border border-cream/30 hover:bg-cream/10"
            >
              Scopri i Piani
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div
          ref={statsRef}
          className="opacity-0 mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-cream/50"
        >
          <span>Nord Italia</span>
          <div className="h-4 w-px bg-cream/20 hidden sm:block" />
          <span>Gratis per Iniziare</span>
          <div className="h-4 w-px bg-cream/20 hidden sm:block" />
          <span>Supporto 24/7</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/hero.tsx
git commit -m "feat: redesign hero with mesh gradient and split text animation"
```

---

## Task 5: Social Proof — Logo Marquee

**Files:**
- Create: `components/marketing/social-proof.tsx`

- [ ] **Step 1: Create social-proof.tsx**

```tsx
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
          {/* Double the logos for seamless loop */}
          {logos}
          {logos}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/social-proof.tsx
git commit -m "feat: add social proof section with logo marquee"
```

---

## Task 6: How It Works — Dark Cards & SVG Connector

**Files:**
- Rewrite: `components/marketing/how-it-works.tsx`

- [ ] **Step 1: Rewrite how-it-works.tsx**

```tsx
"use client";

import { useRef, useEffect } from "react";
import { Hexagon, Circle, Triangle } from "lucide-react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";

const STEPS = [
  {
    icon: Hexagon,
    step: "01",
    title: "Registrati",
    description: "Registrati e configura il profilo della tua attivita in pochi minuti.",
  },
  {
    icon: Circle,
    step: "02",
    title: "Cerca e Confronta",
    description: "Cerca, confronta prezzi e scopri i migliori fornitori della tua zona.",
  },
  {
    icon: Triangle,
    step: "03",
    title: "Ordina e Gestisci",
    description: "Ordina e gestisci tutto in un posto. Semplice, veloce, trasparente.",
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Cards stagger
      gsap.fromTo(
        cardsRef.current.filter(Boolean),
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.15,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            once: true,
          },
        }
      );

      // SVG line draw
      if (lineRef.current) {
        const length = lineRef.current.getTotalLength();
        gsap.set(lineRef.current, { strokeDasharray: length, strokeDashoffset: length });
        gsap.to(lineRef.current, {
          strokeDashoffset: 0,
          duration: 1.5,
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            once: true,
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="come-funziona" className="py-24 px-4 bg-forest-dark">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display text-cream mb-4">
            Come funziona
          </h2>
          <p className="text-cream/50 text-lg max-w-xl mx-auto font-body">
            Tre passi per trasformare i tuoi acquisti Ho.Re.Ca.
          </p>
        </div>

        {/* SVG connector line (desktop only) */}
        <div className="hidden lg:block relative">
          <svg
            className="absolute top-1/2 left-0 w-full h-1 -translate-y-1/2 z-0"
            viewBox="0 0 1000 2"
            preserveAspectRatio="none"
          >
            <path
              ref={lineRef}
              d="M 100 1 L 900 1"
              stroke="rgba(250,248,245,0.15)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
          {STEPS.map((item, i) => (
            <div
              key={item.step}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="gsap-reveal relative rounded-2xl border border-cream/10 bg-forest-dark/50 p-8 backdrop-blur-sm"
            >
              {/* Watermark number */}
              <span className="absolute top-4 right-6 text-7xl font-display text-cream/[0.06] select-none">
                {item.step}
              </span>

              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-orange/10 mb-5">
                  <item.icon className="h-6 w-6 text-accent-orange" />
                </div>
                <h3 className="text-xl font-display text-cream mb-3">{item.title}</h3>
                <p className="text-cream/70 font-body leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/how-it-works.tsx
git commit -m "feat: redesign how-it-works with dark cards and SVG connector"
```

---

## Task 7: Dual Section — Parallax 3D (WOW Moment 1)

**Files:**
- Create: `components/marketing/dual-section.tsx`

- [ ] **Step 1: Create dual-section.tsx**

```tsx
"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  MousePointerClick,
  Truck,
  Store,
  ClipboardList,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";

const RISTORATORI_BULLETS = [
  { icon: BarChart3, text: "Confronta prezzi in tempo reale" },
  { icon: ShieldCheck, text: "Scopri fornitori verificati" },
  { icon: MousePointerClick, text: "Ordina con un click" },
  { icon: Truck, text: "Monitora consegne e spese" },
];

const FORNITORI_BULLETS = [
  { icon: Store, text: "Vetrina prodotti professionale" },
  { icon: ClipboardList, text: "Gestione ordini centralizzata" },
  { icon: TrendingUp, text: "Analytics e insights" },
  { icon: Sparkles, text: "Crescita garantita" },
];

export function DualSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Skip parallax on mobile
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      // Parallax: left half moves faster, right slower
      if (leftRef.current) {
        gsap.to(leftRef.current, {
          yPercent: -5,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (rightRef.current) {
        gsap.to(rightRef.current, {
          yPercent: 5,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // Inner elements depth layers
      const layer1 = sectionRef.current?.querySelectorAll("[data-depth='1']");
      const layer3 = sectionRef.current?.querySelectorAll("[data-depth='3']");

      if (layer1?.length) {
        gsap.to(layer1, {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (layer3?.length) {
        gsap.to(layer3, {
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="per-chi"
      className="min-h-[80vh] flex flex-col lg:flex-row overflow-hidden"
    >
      {/* Left — Ristoratori (cream) */}
      <div
        ref={leftRef}
        className="flex-1 bg-cream px-8 py-20 lg:px-16 lg:py-28 flex items-center"
      >
        <div className="max-w-lg mx-auto lg:ml-auto lg:mr-16">
          <p
            data-depth="1"
            className="text-sm font-semibold uppercase tracking-[0.15em] text-terracotta mb-4"
          >
            Per Ristoratori
          </p>
          <h2 className="text-3xl sm:text-4xl font-display text-forest mb-8 leading-tight">
            Trova i migliori fornitori per la tua cucina
          </h2>
          <ul className="space-y-4 mb-10">
            {RISTORATORI_BULLETS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-charcoal/80 font-body">
                <div data-depth="3" className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-4 h-4 text-forest" />
                </div>
                {b.text}
              </li>
            ))}
          </ul>
          <Link href="/signup">
            <Button size="lg" className="bg-forest text-cream hover:bg-forest-dark">
              Registra il tuo Ristorante <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Right — Fornitori (forest dark) */}
      <div
        ref={rightRef}
        className="flex-1 bg-forest-dark px-8 py-20 lg:px-16 lg:py-28 flex items-center"
      >
        <div className="max-w-lg mx-auto lg:mr-auto lg:ml-16">
          <p
            data-depth="1"
            className="text-sm font-semibold uppercase tracking-[0.15em] text-accent-orange mb-4"
          >
            Per Fornitori
          </p>
          <h2 className="text-3xl sm:text-4xl font-display text-cream mb-8 leading-tight">
            Raggiungi centinaia di nuovi clienti
          </h2>
          <ul className="space-y-4 mb-10">
            {FORNITORI_BULLETS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-cream/80 font-body">
                <div data-depth="3" className="w-8 h-8 rounded-lg bg-cream/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-4 h-4 text-cream" />
                </div>
                {b.text}
              </li>
            ))}
          </ul>
          <Link href="/signup?role=supplier">
            <Button size="lg" className="bg-cream text-forest-dark hover:bg-cream/90">
              Diventa Fornitore <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/dual-section.tsx
git commit -m "feat: add dual section with parallax 3D effect"
```

---

## Task 8: Stats Section — Counter Animation

**Files:**
- Create: `components/marketing/stats.tsx`

- [ ] **Step 1: Create stats.tsx**

```tsx
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
      // Show final values immediately
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/stats.tsx
git commit -m "feat: add stats section with GSAP counter animation"
```

---

## Task 9: Testimonials — Carousel with Keyboard Nav

**Files:**
- Rewrite: `components/marketing/testimonials.tsx`

- [ ] **Step 1: Rewrite testimonials.tsx**

```tsx
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/testimonials.tsx
git commit -m "feat: redesign testimonials as carousel with keyboard nav and a11y"
```

---

## Task 10: FAQ — Sticky Title & Accordion

**Files:**
- Create: `components/marketing/faq.tsx`

- [ ] **Step 1: Create faq.tsx**

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

const FAQ_ITEMS = [
  {
    q: "Come funziona GastroBridge?",
    a: "GastroBridge e una piattaforma B2B che connette ristoratori e fornitori Ho.Re.Ca. Registrati, cerca prodotti, confronta prezzi da piu fornitori e ordina tutto da un unico posto.",
  },
  {
    q: "Quanto costa?",
    a: "Per i ristoratori, l'accesso base e gratuito. Offriamo anche piani premium con funzionalita avanzate come analytics, alert sui prezzi e supporto prioritario. I fornitori hanno piani dedicati per la gestione della vetrina prodotti.",
  },
  {
    q: "Come mi registro come fornitore?",
    a: "Clicca su 'Diventa Fornitore', compila il form con i dati della tua azienda e il catalogo prodotti. Il nostro team verifichera il profilo entro 24 ore.",
  },
  {
    q: "In quali zone e disponibile?",
    a: "Attualmente operiamo nel Nord Italia, con copertura in Lombardia, Piemonte, Veneto e Emilia-Romagna. Stiamo espandendo rapidamente verso altre regioni.",
  },
  {
    q: "I pagamenti sono sicuri?",
    a: "Assolutamente. Utilizziamo Stripe per processare tutti i pagamenti, garantendo la massima sicurezza con crittografia a livello bancario e protezione antifrode.",
  },
  {
    q: "Posso provare gratis?",
    a: "Si! I ristoratori possono registrarsi gratuitamente e iniziare subito a cercare e confrontare fornitori. Nessuna carta di credito richiesta.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-4 bg-cream">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-20">
        {/* Left — sticky title */}
        <div className="lg:w-1/3 lg:sticky lg:top-32 lg:self-start">
          <h2 className="text-3xl sm:text-4xl font-display text-forest mb-4">
            Domande Frequenti
          </h2>
          <p className="text-forest/60 font-body">
            Tutto quello che devi sapere per iniziare.
          </p>
        </div>

        {/* Right — accordion */}
        <div className="lg:w-2/3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const id = `faq-answer-${i}`;

            return (
              <div key={i} className="border-b border-forest/10">
                <button
                  id={`faq-q-${i}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left group"
                  aria-expanded={isOpen}
                  aria-controls={id}
                >
                  <span className="font-semibold text-forest font-body pr-4">
                    {item.q}
                  </span>
                  <Plus
                    className={cn(
                      "w-5 h-5 text-terracotta flex-shrink-0 transition-transform duration-300",
                      isOpen && "rotate-45"
                    )}
                  />
                </button>
                <div
                  id={id}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className={cn(
                    "overflow-hidden transition-all duration-[400ms] ease-out",
                    isOpen ? "max-h-96 pb-5" : "max-h-0"
                  )}
                >
                  <p className="text-forest/80 font-body leading-relaxed">
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/faq.tsx
git commit -m "feat: add FAQ section with sticky title and accordion"
```

---

## Task 11: CTA Finale — Split Text (WOW Moment 2)

**Files:**
- Rewrite: `components/marketing/cta-section.tsx`

- [ ] **Step 1: Rewrite cta-section.tsx**

```tsx
"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { gsap, SplitText, ScrollTrigger } from "@/lib/gsap-config";

export function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Split text reveal
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0, y: 50, rotationX: 90 },
          {
            opacity: 1,
            y: 0,
            rotationX: 0,
            stagger: 0.08,
            duration: 0.8,
            ease: "power4.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      // Subtitle + CTA fade in after headline
      gsap.fromTo(
        [subtitleRef.current, ctaRef.current],
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.15,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            once: true,
          },
        }
      );

      // Mesh gradient intensification
      const meshEl = sectionRef.current?.querySelector(".mesh-gradient");
      if (meshEl) {
        gsap.fromTo(
          meshEl,
          { opacity: 0.5 },
          {
            opacity: 1,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="cta-finale"
      className="relative py-32 px-4 overflow-hidden bg-forest-dark"
    >
      {/* Mesh gradient bg overlay */}
      <div className="absolute inset-0 mesh-gradient" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2
          ref={headlineRef}
          className="opacity-0 text-3xl sm:text-4xl lg:text-5xl font-display text-cream mb-6 leading-tight"
          style={{ perspective: "600px" }}
        >
          Il futuro della ristorazione inizia qui
        </h2>
        <p
          ref={subtitleRef}
          className="opacity-0 text-cream/70 text-lg mb-12 font-body max-w-xl mx-auto"
        >
          Unisciti a centinaia di professionisti Ho.Re.Ca. che stanno gia crescendo con noi.
        </p>
        <div ref={ctaRef} className="opacity-0 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-cream text-forest-dark hover:bg-cream/90 shadow-lg text-lg px-10"
            >
              Registra il tuo Ristorante <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/signup?role=supplier">
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-cream border border-cream/30 hover:bg-cream/10 text-lg px-10"
            >
              Diventa Fornitore
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/marketing/cta-section.tsx
git commit -m "feat: redesign CTA finale with split text reveal and mesh gradient"
```

---

## Task 12: Footer — 4-Column Charcoal

**Files:**
- Rewrite: `components/layout/footer.tsx`

- [ ] **Step 1: Rewrite footer.tsx**

```tsx
import Link from "next/link";

const FOOTER_LINKS = {
  Piattaforma: [
    { href: "#come-funziona", label: "Come Funziona" },
    { href: "#per-chi", label: "Per Ristoratori" },
    { href: "#per-chi", label: "Per Fornitori" },
    { href: "/pricing", label: "Prezzi" },
  ],
  Risorse: [
    { href: "#", label: "Centro Assistenza" },
    { href: "#", label: "Blog" },
    { href: "#", label: "API Documentation" },
    { href: "#", label: "Status" },
  ],
  Legale: [
    { href: "#", label: "Privacy Policy" },
    { href: "#", label: "Termini di Servizio" },
    { href: "#", label: "Cookie Policy" },
    { href: "#", label: "P.IVA" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-charcoal py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <span className="text-2xl font-display text-cream/90">Gastro</span>
              <span className="text-2xl font-body font-bold text-accent-green">Bridge</span>
            </Link>
            <p className="text-cream/50 text-sm leading-relaxed font-body">
              Il marketplace B2B che connette ristoratori e fornitori Ho.Re.Ca. nel Nord Italia.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-sm uppercase tracking-[0.15em] text-cream/40 mb-4 font-body">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-cream/50 hover:text-cream transition-colors duration-200 font-body"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-cream/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-cream/30 font-body">
            &copy; {new Date().getFullYear()} GastroBridge. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add components/layout/footer.tsx
git commit -m "feat: redesign footer with 4-column charcoal layout"
```

---

## Task 13: Page Composition & Layout Update

**Files:**
- Modify: `app/(marketing)/page.tsx`
- Modify: `app/(marketing)/layout.tsx`

- [ ] **Step 1: Update page.tsx to compose new sections**

Replace entire contents of `app/(marketing)/page.tsx` with:

```tsx
import { Hero } from "@/components/marketing/hero";
import { SocialProof } from "@/components/marketing/social-proof";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DualSection } from "@/components/marketing/dual-section";
import { Stats } from "@/components/marketing/stats";
import { Testimonials } from "@/components/marketing/testimonials";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <HowItWorks />
      <DualSection />
      <Stats />
      <Testimonials />
      <FAQ />
      <CTASection />
    </>
  );
}
```

- [ ] **Step 2: Update layout.tsx — remove pt-16, add skip-to-content**

Replace entire contents of `app/(marketing)/layout.tsx` with:

```tsx
import type { ReactNode } from "react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { Footer } from "@/components/layout/footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#come-funziona"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:bg-cream focus:text-forest focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Vai al contenuto
      </a>
      <MarketingNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Delete old categories.tsx (replaced by dual-section.tsx)**

Run: `rm /d/Manum/GastroBridge/components/marketing/categories.tsx`

- [ ] **Step 4: Verify build passes**

Run: `cd /d/Manum/GastroBridge && npx next build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add app/(marketing)/page.tsx app/(marketing)/layout.tsx
git rm components/marketing/categories.tsx 2>/dev/null || true
git commit -m "feat: compose new landing page sections and update marketing layout"
```

---

## Task 14: Visual Verification & Polish

- [ ] **Step 1: Start dev server**

Run: `cd /d/Manum/GastroBridge && npm run dev`

- [ ] **Step 2: Open in browser and verify all sections render**

Check: `http://localhost:3000`
Verify:
- Hero: full-screen forest dark with mesh gradient, headline, badge, CTAs
- Social Proof: cream strip with marquee
- How It Works: dark cards with connector
- Dual Section: cream left / forest right
- Stats: 4 counters with animation
- Testimonials: single testimonial carousel on dark bg
- FAQ: sticky title + accordion on cream
- CTA: mesh gradient + split text
- Footer: 4-col charcoal
- Navbar: glassmorphism, compacts on scroll

- [ ] **Step 3: Fix any issues found during visual check**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish landing page visual issues"
```
