# Supplier Awwwards Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Phase 1 foundation polish for the supplier area — design tokens, shell refinements, UI primitives, and five signature components — so every downstream phase inherits a consistent, awwwards-level visual baseline.

**Architecture:** Additive changes only. Token additions live in `app/globals.css` alongside the already-shipped `[data-area="supplier"]` scopes. Primitives stay area-agnostic by reading CSS variables. New signature components live under `components/supplier/signature/`. The shell structure (`DashboardShell` + sidebar + topbar + drawer + command palette) is retained; we polish in place.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4 (`@theme`), `motion/react` (already installed), `next-themes`, Radix UI primitives (via Dialog), `lucide-react`, `clsx` + `tailwind-merge` via `cn()`.

**Spec:** `docs/superpowers/specs/2026-04-16-supplier-awwwards-foundation-design.md`

**Testing:** No unit-test framework is installed. Verification is: `npm run lint` + `npm run build` + manual browser verification per the spec's exit checklist (§5.6). Every task ends with lint + build green.

---

## File Structure

### Create

```
components/supplier/signature/
├── pulse-dot.tsx
├── count-up.tsx
├── ticker.tsx
├── celebration-check.tsx
├── serif-greeting.tsx
├── live-status.tsx
└── index.ts

components/ui/
├── empty-state.tsx        (new)
├── data-table.tsx         (new — unified Table primitive)

lib/hooks/
├── useReducedMotion.ts    (new)
├── useIntersectionOnce.ts (new — for CountUp trigger)
└── useDensity.ts          (new — for table density toggle, localStorage-backed)

components/dashboard/topbar/
└── keyboard-help-modal.tsx (new — shortcuts reference modal)
```

### Modify

```
app/globals.css                                     (add tokens)
components/ui/button.tsx                            (variants, sizes, states)
components/ui/input.tsx                             (focus ring, states)
components/ui/select.tsx                            (align with input)
components/ui/badge.tsx                             (variants, sizes, dot)
components/ui/card.tsx                              (slots, glow prop, padding)
components/ui/modal.tsx                             (motion + backdrop blur)
components/ui/toast.tsx                             (brand variant + stack)
components/ui/skeleton.tsx                          (shimmer)
components/dashboard/shell.tsx                      (max-width container)
components/dashboard/sidebar/collapsible-sidebar.tsx
components/dashboard/sidebar/sidebar-item.tsx       (active indicator)
components/dashboard/sidebar/sidebar-user-card.tsx  (if exists — polish)
components/dashboard/topbar/dark-topbar.tsx         (live status + polish)
components/dashboard/topbar/breadcrumbs.tsx         (editorial style)
components/dashboard/topbar/search-trigger.tsx     (mono placeholder, focus expand)
components/dashboard/topbar/notification-bell.tsx  (gold badge + pulse)
components/dashboard/mobile/sidebar-drawer.tsx     (blur, safe-area)
components/ui/theme-toggle.tsx                     (icon swap polish)
```

---

## Task 1 — Add foundation tokens to `globals.css`

**Files:**
- Modify: `app/globals.css` (inside the `@theme` block, top of file)

- [ ] **Step 1: Add motion, density, elevation, focus, and numeric-font tokens**

Open `app/globals.css`. Find the existing `@theme` block. Append the following inside it, just before the closing `}`:

```css
  /* ---- Phase 1 foundation additions ---- */

  /* Motion — additional easings + durations + stagger */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-hero: 600ms;
  --duration-pulse: 1800ms;
  --duration-ticker: 45s;
  --stagger-sm: 40ms;

  /* Density */
  --row-compact: 36px;
  --row-cozy: 44px;
  --row-editorial: 56px;
  --cell-pad-compact: 6px 10px;
  --cell-pad-cozy: 10px 14px;
  --cell-pad-editorial: 14px 16px;

  /* Elevation scale (light) */
  --elev-0: 0 0 0 transparent;
  --elev-1: 0 1px 2px rgba(0, 0, 0, 0.04);
  --elev-2: 0 4px 12px rgba(0, 0, 0, 0.06);
  --elev-3: 0 8px 24px rgba(0, 0, 0, 0.08);
  --elev-4: 0 20px 60px rgba(0, 0, 0, 0.12);

  /* Numeric font utility */
  --font-num: var(--font-display);
```

Then, inside the `.dashboard-dark` block (further down in the file), append:

```css
  /* Elevation scale (dark) — more aggressive shadows */
  --elev-1: 0 1px 2px rgba(0, 0, 0, 0.4);
  --elev-2: 0 4px 16px rgba(0, 0, 0, 0.5);
  --elev-3: 0 8px 28px rgba(0, 0, 0, 0.6);
  --elev-4: 0 24px 80px rgba(0, 0, 0, 0.7);
```

- [ ] **Step 2: Add unified focus-ring helper**

Immediately below the existing `@theme` closing brace (outside `@theme`), add a utility class:

```css
/* =========================================
   Unified focus ring — dual ring:
   inner = surface, outer = brand primary.
   Consumers apply via `focus-visible:outline-none` + class="focus-ring"
   or Tailwind `focus-visible:[box-shadow:var(--focus-ring)]`.
   ========================================= */
:root {
  --focus-ring: 0 0 0 2px var(--color-surface-base, #FFFFFF), 0 0 0 4px var(--color-brand-primary);
}

.focus-ring:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

Note the fallback `#FFFFFF` matches light supplier/ristoratore surfaces. Dark scopes override `--color-surface-base` to `#09090F`.

- [ ] **Step 3: Add shimmer keyframes and utility class**

Append to end of file:

```css
/* =========================================
   Skeleton shimmer — ocra-tinted sweep
   ========================================= */
@keyframes shimmer-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.shimmer-bg {
  position: relative;
  overflow: hidden;
  background: var(--color-surface-muted, #F5F0E4);
}

.shimmer-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(168, 117, 53, 0.04) 50%,
    transparent 100%
  );
  animation: shimmer-sweep 1.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .shimmer-bg::after {
    animation: none;
    opacity: 0.5;
  }
}
```

- [ ] **Step 4: Verify tokens compile**

Run: `npm run build`
Expected: build completes without Tailwind/PostCSS errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(supplier-foundation): add motion, density, elevation, focus, shimmer tokens"
```

---

## Task 2 — Hook: `useReducedMotion`

**Files:**
- Create: `lib/hooks/useReducedMotion.ts`

- [ ] **Step 1: Create the hook**

```tsx
// lib/hooks/useReducedMotion.ts
"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the user prefers reduced motion.
 * SSR-safe: first render returns false to avoid hydration mismatch,
 * then updates on the client once the media query resolves.
 */
export function useReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return prefers;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/useReducedMotion.ts
git commit -m "feat(supplier-foundation): add useReducedMotion hook"
```

---

## Task 3 — Hook: `useIntersectionOnce`

**Files:**
- Create: `lib/hooks/useIntersectionOnce.ts`

- [ ] **Step 1: Create the hook**

```tsx
// lib/hooks/useIntersectionOnce.ts
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sets `hasIntersected` to true the first time the target enters the viewport.
 * Never resets. Use for one-shot enter animations (counters, reveals).
 */
export function useIntersectionOnce<T extends Element>(
  options?: IntersectionObserverInit,
): { ref: React.RefObject<T | null>; hasIntersected: boolean } {
  const ref = useRef<T | null>(null);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || hasIntersected) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasIntersected(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2, ...options },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasIntersected, options]);

  return { ref, hasIntersected };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/useIntersectionOnce.ts
git commit -m "feat(supplier-foundation): add useIntersectionOnce hook"
```

---

## Task 4 — Hook: `useDensity`

**Files:**
- Create: `lib/hooks/useDensity.ts`

- [ ] **Step 1: Create the hook**

```tsx
// lib/hooks/useDensity.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export type Density = "compact" | "cozy" | "editorial";

/**
 * Per-table density preference, persisted to localStorage under
 * `gb:density:<tableId>`. Defaults to "cozy".
 */
export function useDensity(
  tableId: string,
  defaultDensity: Density = "cozy",
): { density: Density; setDensity: (d: Density) => void } {
  const storageKey = `gb:density:${tableId}`;
  const [density, setDensityState] = useState<Density>(defaultDensity);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "compact" || saved === "cozy" || saved === "editorial") {
      setDensityState(saved);
    }
  }, [storageKey]);

  const setDensity = useCallback(
    (d: Density) => {
      setDensityState(d);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, d);
      }
    },
    [storageKey],
  );

  return { density, setDensity };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/useDensity.ts
git commit -m "feat(supplier-foundation): add useDensity hook with localStorage persistence"
```

---

## Task 5 — Signature: `PulseDot`

**Files:**
- Create: `components/supplier/signature/pulse-dot.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/supplier/signature/pulse-dot.tsx
"use client";

import { cn } from "@/lib/utils/formatters";

type PulseVariant = "live" | "warning" | "brand";

const variantColors: Record<PulseVariant, string> = {
  live: "bg-success",
  warning: "bg-warning",
  brand: "bg-brand-primary",
};

const ringColors: Record<PulseVariant, string> = {
  live: "border-success",
  warning: "border-warning",
  brand: "border-brand-primary",
};

type Props = {
  variant?: PulseVariant;
  size?: number;
  label?: string;
  className?: string;
};

export function PulseDot({
  variant = "live",
  size = 8,
  label,
  className,
}: Props) {
  return (
    <span
      role="status"
      aria-label={label ?? `${variant} indicator`}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span
        className={cn(
          "relative inline-block rounded-full",
          variantColors[variant],
        )}
        style={{ width: size, height: size }}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-[-3px] rounded-full border-2 opacity-60 motion-reduce:hidden",
            ringColors[variant],
          )}
          style={{
            animation: "pulse-ring var(--duration-pulse, 1800ms) ease-out infinite",
          }}
        />
      </span>
      {label ? (
        <span className="font-mono text-[11px] text-text-secondary">
          {label}
        </span>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 2: Add `pulse-ring` keyframe to `globals.css`**

Open `app/globals.css`. After the `shimmer-sweep` keyframe block, append:

```css
@keyframes pulse-ring {
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(2.2); }
}
```

- [ ] **Step 3: Verify via quick page render**

Run: `npm run lint && npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add components/supplier/signature/pulse-dot.tsx app/globals.css
git commit -m "feat(supplier-foundation): add PulseDot signature component"
```

---

## Task 6 — Signature: `CountUp`

**Files:**
- Create: `components/supplier/signature/count-up.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/supplier/signature/count-up.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useIntersectionOnce } from "@/lib/hooks/useIntersectionOnce";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

export type CountUpFormat = "currency" | "number" | "percent" | "compact";

type Props = {
  value: number;
  format?: CountUpFormat;
  decimals?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

function formatValue(value: number, format: CountUpFormat, decimals: number): string {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case "percent":
      return `${value.toFixed(decimals)}%`;
    case "compact":
      return new Intl.NumberFormat("it-IT", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    case "number":
    default:
      return new Intl.NumberFormat("it-IT", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
  }
}

// ease-out-quart
function ease(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function CountUp({
  value,
  format = "number",
  decimals = 0,
  duration = 1400,
  delay = 0,
  prefix,
  suffix,
  className,
}: Props) {
  const { ref, hasIntersected } = useIntersectionOnce<HTMLSpanElement>();
  const prefersReduced = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    if (!hasIntersected) return;
    if (prefersReduced) {
      setDisplayed(value);
      return;
    }

    fromRef.current = displayed;
    startRef.current = null;
    let rafId = 0;

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t + delay;
      const elapsed = t - startRef.current;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, elapsed / duration);
      const next = fromRef.current + (value - fromRef.current) * ease(progress);
      setDisplayed(next);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, hasIntersected, prefersReduced, duration, delay]);

  return (
    <span
      ref={ref}
      className={cn("tabular-nums tracking-tight [font-feature-settings:'tnum']", className)}
    >
      {prefix}
      {formatValue(displayed, format, decimals)}
      {suffix}
    </span>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/supplier/signature/count-up.tsx
git commit -m "feat(supplier-foundation): add CountUp signature component"
```

---

## Task 7 — Signature: `Ticker`

**Files:**
- Create: `components/supplier/signature/ticker.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/supplier/signature/ticker.tsx
"use client";

import { type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils/formatters";

export type TickerItem = {
  key: string;
  label: string;
  value: string;
  icon?: ReactNode;
};

type Props = {
  items: TickerItem[];
  speed?: number;
  pauseOnHover?: boolean;
  className?: string;
};

export function Ticker({
  items,
  speed = 45,
  pauseOnHover = true,
  className,
}: Props) {
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-border-subtle bg-surface-page",
        "[mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      aria-label="Live data ticker"
    >
      <div
        ref={trackRef}
        className="flex items-center gap-6 whitespace-nowrap py-2.5 px-4 motion-reduce:animate-none"
        style={{
          animation: `ticker-scroll ${speed}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}
      >
        {doubled.map((item, i) => (
          <span
            key={`${item.key}-${i}`}
            className="flex items-center gap-2 font-mono text-[11px] text-brand-depth"
          >
            {item.icon}
            <span className="text-text-secondary">{item.label}</span>
            <b className="text-brand-primary font-semibold">{item.value}</b>
            <span
              aria-hidden
              className="mx-4 inline-block size-1 rounded-full bg-brand-highlight"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `ticker-scroll` keyframe to `globals.css`**

Append near the other keyframes:

```css
@keyframes ticker-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/supplier/signature/ticker.tsx app/globals.css
git commit -m "feat(supplier-foundation): add Ticker signature component"
```

---

## Task 8 — Signature: `CelebrationCheck`

**Files:**
- Create: `components/supplier/signature/celebration-check.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/supplier/signature/celebration-check.tsx
"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

type Props = {
  size?: number;
  className?: string;
};

export function CelebrationCheck({ size = 32, className }: Props) {
  const reduced = useReducedMotion();
  const iconSize = Math.round(size * 0.55);

  if (reduced) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-brand-highlight text-brand-highlight-on",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label="Completato"
        role="status"
      >
        <Check strokeWidth={3} width={iconSize} height={iconSize} />
      </span>
    );
  }

  return (
    <motion.span
      initial={{ scale: 0.2, opacity: 0 }}
      animate={{ scale: [0.2, 1.1, 1], opacity: 1 }}
      transition={{
        duration: 0.6,
        times: [0, 0.6, 1],
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-brand-highlight text-brand-highlight-on",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Completato"
      role="status"
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        initial={{ boxShadow: "0 0 0 0 rgba(232, 181, 71, 0.55)" }}
        animate={{ boxShadow: "0 0 0 12px rgba(232, 181, 71, 0)" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <Check strokeWidth={3} width={iconSize} height={iconSize} />
    </motion.span>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/supplier/signature/celebration-check.tsx
git commit -m "feat(supplier-foundation): add CelebrationCheck signature component"
```

---

## Task 9 — Signature: `SerifGreeting`

**Files:**
- Create: `components/supplier/signature/serif-greeting.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/supplier/signature/serif-greeting.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

type Props = {
  name: string;
  showDateTime?: boolean;
  className?: string;
};

function greetingFor(hour: number): string {
  if (hour < 12) return "Buongiorno";
  if (hour < 19) return "Buon pomeriggio";
  return "Buonasera";
}

function formatItalianDateTime(d: Date): string {
  const day = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${day} · h. ${hh}:${mm}`;
}

export function SerifGreeting({ name, showDateTime = true, className }: Props) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    if (!showDateTime) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [showDateTime]);

  const hour = now?.getHours() ?? 12;
  const eyebrow = greetingFor(hour);

  const MotionDiv = reduced ? "div" : motion.div;
  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
      };

  return (
    <MotionDiv className={cn("space-y-1", className)} {...motionProps}>
      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-secondary">
        {eyebrow}
      </div>
      <h1 className="font-display text-3xl sm:text-4xl lg:text-[36px] leading-tight text-text-primary">
        {name}
        <span className="text-brand-primary">.</span>
      </h1>
      {showDateTime && now ? (
        <p className="text-xs text-text-secondary">{formatItalianDateTime(now)}</p>
      ) : null}
    </MotionDiv>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/supplier/signature/serif-greeting.tsx
git commit -m "feat(supplier-foundation): add SerifGreeting signature component"
```

---

## Task 10 — Signature: `LiveStatus` + barrel export

**Files:**
- Create: `components/supplier/signature/live-status.tsx`
- Create: `components/supplier/signature/index.ts`

- [ ] **Step 1: Implement `LiveStatus`**

```tsx
// components/supplier/signature/live-status.tsx
"use client";

import { PulseDot } from "./pulse-dot";
import { cn } from "@/lib/utils/formatters";

type Props = {
  count: number;
  label: string;
  variant?: "live" | "warning" | "brand";
  className?: string;
};

export function LiveStatus({ count, label, variant = "live", className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-muted px-3 py-1",
        className,
      )}
    >
      <PulseDot variant={variant} />
      <span className="font-mono text-[11px] text-text-secondary">
        <b className="text-text-primary font-semibold">{count}</b> {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create barrel export**

```ts
// components/supplier/signature/index.ts
export { CountUp, type CountUpFormat } from "./count-up";
export { PulseDot } from "./pulse-dot";
export { Ticker, type TickerItem } from "./ticker";
export { CelebrationCheck } from "./celebration-check";
export { SerifGreeting } from "./serif-greeting";
export { LiveStatus } from "./live-status";
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/supplier/signature/live-status.tsx components/supplier/signature/index.ts
git commit -m "feat(supplier-foundation): add LiveStatus + signature barrel"
```

---

## Task 11 — Button polish

**Files:**
- Modify: `components/ui/button.tsx`

- [ ] **Step 1: Rewrite variants, sizes, and focus ring**

Replace the entire file with:

```tsx
"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/formatters";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost"
  | "link"
  | "celebration";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-brand-on-primary hover:bg-brand-primary-hover active:bg-brand-primary-active active:scale-[0.98] shadow-[var(--elev-1)] hover:shadow-[var(--elev-2)]",
  secondary:
    "border border-brand-primary text-brand-primary hover:bg-brand-primary-subtle active:scale-[0.98]",
  destructive:
    "bg-error text-white hover:bg-error/90 active:bg-error/80 shadow-[var(--elev-1)]",
  ghost:
    "text-text-primary hover:bg-surface-hover active:bg-surface-hover/80",
  link: "text-brand-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",
  celebration:
    "bg-brand-highlight text-brand-highlight-on hover:bg-brand-highlight-strong active:scale-[0.98] shadow-[var(--elev-1)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-10 w-10 p-0",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-body font-semibold transition-[background-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, type ButtonProps };
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: clean. If any existing consumer breaks (e.g. legacy sizes), fix at call site — not by rolling back the component.

- [ ] **Step 3: Commit**

```bash
git add components/ui/button.tsx
git commit -m "feat(supplier-foundation): button polish — variants, sizes, unified focus ring"
```

---

## Task 12 — Input + Select polish

**Files:**
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/select.tsx`

- [ ] **Step 1: Rewrite `Input`**

```tsx
// components/ui/input.tsx
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, prefix, suffix, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-2 h-10 rounded-lg border border-default bg-surface-page px-3 transition-[border-color,box-shadow] duration-[var(--duration-fast)] focus-within:border-brand-primary focus-within:[box-shadow:var(--focus-ring)]",
            error && "border-error focus-within:border-error",
          )}
        >
          {prefix ? <span className="text-text-secondary shrink-0">{prefix}</span> : null}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "flex-1 bg-transparent font-body text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-50",
              className,
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          {suffix ? <span className="text-text-secondary shrink-0">{suffix}</span> : null}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-error" role="alert">
            {error}
          </p>
        ) : null}
        {helperText && !error ? (
          <p id={`${inputId}-helper`} className="text-xs text-text-secondary">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input, type InputProps };
```

- [ ] **Step 2: Read current `select.tsx` and align its focus/border styling with `Input`**

Open `components/ui/select.tsx`. Mirror the border/focus ring classes so `Select` matches `Input`: border `border-default`, focus border `brand-primary`, dual-ring focus via `[box-shadow:var(--focus-ring)]`, same height 40px, same label style (11px uppercase tracking-wider). Keep its existing API; only restyle.

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: clean build. If Tailwind does not recognize `border-default`, add a utility mapping in `@theme`:

```css
--color-border-default: var(--color-border-default);
```

It already exists per existing `globals.css`; otherwise confirm the class `border-default` resolves.

- [ ] **Step 4: Commit**

```bash
git add components/ui/input.tsx components/ui/select.tsx
git commit -m "feat(supplier-foundation): input + select polish — uppercase label, dual-ring focus"
```

---

## Task 13 — Badge polish

**Files:**
- Modify: `components/ui/badge.tsx`

- [ ] **Step 1: Rewrite**

```tsx
// components/ui/badge.tsx
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/formatters";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "outline"
  | "brand"
  | "highlight"
  | "neutral";

export type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  mono?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-muted text-text-primary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  error: "bg-error-subtle text-error",
  info: "bg-info-subtle text-info",
  outline: "border border-border-default text-text-secondary bg-transparent",
  brand: "bg-brand-primary-subtle text-brand-primary",
  highlight: "bg-brand-highlight text-brand-highlight-on",
  neutral: "bg-surface-hover text-text-secondary",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-text-secondary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  outline: "bg-text-secondary",
  brand: "bg-brand-primary",
  highlight: "bg-brand-highlight-on",
  neutral: "bg-text-tertiary",
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: "text-[9px] px-1.5 py-0.5 gap-1",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-[13px] px-2.5 py-1 gap-2",
};

function Badge({
  className,
  variant = "default",
  size = "sm",
  dot = false,
  mono = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wider",
        mono && "font-mono tracking-normal",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("inline-block size-1.5 rounded-full", dotColors[variant])}
        />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, type BadgeProps };
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: clean. Fix any call-site that passed a now-invalid variant.

- [ ] **Step 3: Commit**

```bash
git add components/ui/badge.tsx
git commit -m "feat(supplier-foundation): badge polish — variants, sizes, dot, mono"
```

---

## Task 14 — Card polish (slots, glow, padding)

**Files:**
- Modify: `components/ui/card.tsx`

- [ ] **Step 1: Rewrite**

```tsx
// components/ui/card.tsx
import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/formatters";

export type CardPadding = "compact" | "default" | "hero" | "none";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  clickable?: boolean;
  glow?: boolean;
}

const paddingStyles: Record<CardPadding, string> = {
  none: "p-0",
  compact: "p-4",
  default: "p-5",
  hero: "p-7",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = "default", clickable = false, glow = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[14px] border border-border-default bg-surface-card shadow-[var(--elev-1)] transition-[box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-expo)]",
        paddingStyles[padding],
        clickable && "cursor-pointer hover:shadow-[var(--elev-2)] hover:-translate-y-[1px]",
        glow && "dark:hover:[box-shadow:var(--glow-brand)]",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-start justify-between gap-3 pb-3", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardEyebrow = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.2em] text-brand-depth",
        className,
      )}
      {...props}
    />
  ),
);
CardEyebrow.displayName = "CardEyebrow";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-display text-lg text-text-primary leading-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-text-secondary", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 pt-4 border-t border-border-subtle mt-4", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardEyebrow,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
};
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/ui/card.tsx
git commit -m "feat(supplier-foundation): card polish — slots, glow, padding variants"
```

---

## Task 15 — Modal + Toast polish

**Files:**
- Modify: `components/ui/modal.tsx`
- Modify: `components/ui/toast.tsx`

- [ ] **Step 1: Update `Modal`**

Open `components/ui/modal.tsx`. The existing component must:
- Overlay: `bg-surface-overlay backdrop-blur-sm` (replace any current `bg-black/50`).
- Panel: `rounded-2xl border border-border-default shadow-[var(--elev-4)] p-6 bg-surface-card max-w-lg w-full`.
- Motion: ensure entry animation is `fade + scale 0.98 → 1.0` at 300ms with ease `var(--ease-out-expo)`.
- Focus trap + Escape + click-outside close must remain.
- Title: wrap any title in `font-display text-xl text-text-primary`.

Apply these changes in place. Keep the component's existing props and API.

- [ ] **Step 2: Update `Toast`**

Open `components/ui/toast.tsx`. Ensure:
- Variants: `success | warning | error | info | brand` — add `brand` if missing (`bg-brand-primary-subtle text-brand-depth border-brand-primary-border`).
- Enter animation: `translateX(16px) + opacity 0 → 100%` at 300ms `var(--ease-out-expo)`.
- Stack max 3; overflow collapses to a `+N altri` chip above the stack.
- Mobile swipe-to-dismiss: use a pointer-down → pointer-move → pointer-up handler. On horizontal drag ≥ 80px, call dismiss. Keep auto-dismiss at 4s, pause on hover.
- Container has `role="region" aria-live="polite" aria-label="Notifications"`.

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/ui/modal.tsx components/ui/toast.tsx
git commit -m "feat(supplier-foundation): modal + toast polish — blur overlay, brand variant, swipe"
```

---

## Task 16 — Skeleton shimmer + EmptyState

**Files:**
- Modify: `components/ui/skeleton.tsx`
- Create: `components/ui/empty-state.tsx`

- [ ] **Step 1: Rewrite `Skeleton`**

```tsx
// components/ui/skeleton.tsx
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/formatters";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface-muted",
        shimmer && "shimmer-bg",
        !shimmer && "animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Create `EmptyState`**

```tsx
// components/ui/empty-state.tsx
import { type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-[420px] flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-primary-subtle text-brand-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-xl text-text-primary">{title}</h3>
      {description ? (
        <p className="text-sm text-text-secondary">{description}</p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="flex items-center gap-2 pt-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/ui/skeleton.tsx components/ui/empty-state.tsx
git commit -m "feat(supplier-foundation): skeleton shimmer + EmptyState primitive"
```

---

## Task 17 — Unified `DataTable` primitive

**Files:**
- Create: `components/ui/data-table.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/ui/data-table.tsx
"use client";

import { type ReactNode } from "react";
import { ChevronDown, ChevronUp, LayoutList, Rows } from "lucide-react";
import { useDensity, type Density } from "@/lib/hooks/useDensity";
import { cn } from "@/lib/utils/formatters";

export type ColumnDef<T> = {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

type Props<T> = {
  id: string;
  columns: ColumnDef<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  emptyState?: ReactNode;
  pagination?: ReactNode;
  defaultDensity?: Density;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectedKeysChange?: (keys: Set<string>) => void;
  className?: string;
};

const rowHeight: Record<Density, string> = {
  compact: "h-9",
  cozy: "h-11",
  editorial: "h-14",
};

const cellPad: Record<Density, string> = {
  compact: "px-2.5 py-1.5",
  cozy: "px-3.5 py-2.5",
  editorial: "px-4 py-3.5",
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  id,
  columns,
  rows,
  getRowKey,
  sort,
  onSortChange,
  emptyState,
  pagination,
  defaultDensity = "cozy",
  selectable = false,
  selectedKeys,
  onSelectedKeysChange,
  className,
}: Props<T>) {
  const { density, setDensity } = useDensity(id, defaultDensity);

  const onHeaderClick = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (!sort || sort.key !== col.key) {
      onSortChange({ key: col.key, dir: "asc" });
    } else if (sort.dir === "asc") {
      onSortChange({ key: col.key, dir: "desc" });
    } else {
      onSortChange(null);
    }
  };

  return (
    <div className={cn("rounded-xl border border-border-default bg-surface-card overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle">
        <div className="text-xs text-text-secondary font-mono">{rows.length} risultati</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDensity("compact")}
            aria-pressed={density === "compact"}
            aria-label="Densità compatta"
            className={cn(
              "p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover",
              density === "compact" && "text-brand-primary bg-brand-primary-subtle",
            )}
          >
            <Rows className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDensity("cozy")}
            aria-pressed={density === "cozy"}
            aria-label="Densità comoda"
            className={cn(
              "p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover",
              density === "cozy" && "text-brand-primary bg-brand-primary-subtle",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-surface-page border-b border-border-subtle">
            <tr>
              {selectable ? <th className="w-8 px-2" aria-label="Select" /> : null}
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.15em] text-text-secondary font-semibold whitespace-nowrap",
                      cellPad[density],
                      alignClass[col.align ?? "left"],
                      col.sortable && "cursor-pointer select-none hover:text-text-primary",
                    )}
                    onClick={() => onHeaderClick(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isSorted ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12">
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = getRowKey(row);
                const selected = selectable && selectedKeys?.has(key);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b border-border-subtle last:border-0 transition-colors",
                      rowHeight[density],
                      "hover:bg-surface-hover",
                      selected && "bg-brand-primary-subtle",
                    )}
                  >
                    {selectable ? (
                      <td className="px-2">
                        <input
                          type="checkbox"
                          checked={selected ?? false}
                          onChange={(e) => {
                            if (!selectedKeys || !onSelectedKeysChange) return;
                            const next = new Set(selectedKeys);
                            if (e.target.checked) next.add(key);
                            else next.delete(key);
                            onSelectedKeysChange(next);
                          }}
                          className="h-3.5 w-3.5 accent-brand-primary"
                        />
                      </td>
                    ) : null}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "text-sm text-text-primary",
                          cellPad[density],
                          alignClass[col.align ?? "left"],
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination ? (
        <div className="border-t border-border-subtle px-3 py-2">{pagination}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/ui/data-table.tsx
git commit -m "feat(supplier-foundation): add unified DataTable primitive with density toggle"
```

---

## Task 18 — Sidebar polish (wordmark, role pill, sections, user card)

**Files:**
- Modify: `components/dashboard/sidebar/collapsible-sidebar.tsx`
- Modify (if exists): `components/dashboard/sidebar/sidebar-user-card.tsx`

- [ ] **Step 1: Update wordmark**

In `collapsible-sidebar.tsx`, replace the logo block with:

```tsx
<Link href={homeHref} className="flex items-baseline gap-0 overflow-hidden">
  {isCollapsed ? (
    <span className="font-display text-lg text-text-primary">
      GB<span className="text-brand-primary">.</span>
    </span>
  ) : (
    <>
      <span className="font-display text-lg text-text-primary">Gastro</span>
      <span className="font-display text-lg text-text-primary">Bridge</span>
      <span className="font-display text-lg text-brand-primary">.</span>
    </>
  )}
</Link>
```

- [ ] **Step 2: Update role pill**

Replace the `role badge` block in the expanded sidebar with:

```tsx
{!isCollapsed && (
  <div className="px-4 py-2">
    <span className="inline-flex items-center rounded-full border border-brand-primary-border bg-brand-primary-subtle px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-depth">
      {role === "supplier" ? "Area Fornitore" : "Area Ristorante"}
    </span>
  </div>
)}
```

- [ ] **Step 3: Add section dividers**

Inside the section-rendering loop, introduce a hairline above each section label (skip the first):

```tsx
{Object.entries(sections).map(([sectionKey, items], index) => (
  <div key={sectionKey} className={cn("px-3", index > 0 && "pt-4 mt-4 border-t border-border-subtle")}>
    {!isCollapsed && sectionKey !== "main" ? (
      <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-text-tertiary font-semibold">
        {sectionLabel(sectionKey)}
      </div>
    ) : null}
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <SidebarItem key={item.href} item={item} role={role} collapsed={isCollapsed} />
      ))}
    </div>
  </div>
))}
```

Define `sectionLabel` locally (or co-locate in a helper):

```tsx
function sectionLabel(key: string): string {
  const labels: Record<string, string> = {
    main: "Principale",
    operations: "Operazioni",
    catalog: "Catalogo",
    management: "Gestione",
    settings: "Impostazioni",
  };
  return labels[key] ?? key;
}
```

- [ ] **Step 4: Polish user-card footer**

If `components/dashboard/sidebar/sidebar-user-card.tsx` exists, ensure the avatar monogramma uses `bg-brand-primary-subtle text-brand-primary`, name uses `text-text-primary font-semibold text-sm`, email uses `text-text-tertiary text-xs truncate`. Layout: avatar 32px left + column (name + email) + `ThemeToggle` inline right. Collapsed mode: only avatar 32px, theme toggle moves to a stacked icon below.

- [ ] **Step 5: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/sidebar/
git commit -m "feat(supplier-foundation): sidebar wordmark, role pill, section dividers, user card"
```

---

## Task 19 — Sidebar item polish (active indicator, hover, badges)

**Files:**
- Modify: `components/dashboard/sidebar/sidebar-item.tsx`

- [ ] **Step 1: Restructure the item**

Update the file so each nav link renders with:
- A 2px left indicator bar in `bg-brand-primary`, visible only when `isActive`, absolutely positioned on the left edge of the item's rounded rectangle.
- Hover: `bg-surface-hover` + icon color transition to `brand-primary` at 150ms.
- Active: `bg-brand-primary-subtle text-brand-primary` + indicator bar.
- Badges: `stockBadge` renders via `<Badge variant="warning" size="xs" mono>` (amber — operational). `ordersBadge` renders via `<Badge variant="highlight" size="xs" mono>` (gold — positive attention).
- Collapsed state: hide label + badge count, keep icon only; wrap entire item in a Radix `Tooltip` with 300ms open delay, side `right`, content `{label} · {badge?}`.

Illustrative JSX (adapt to the existing item prop shape):

```tsx
<Link
  href={item.href}
  aria-current={isActive ? "page" : undefined}
  className={cn(
    "relative group flex items-center gap-3 h-9 rounded-lg px-3 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-expo)]",
    isActive
      ? "bg-brand-primary-subtle text-brand-primary"
      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
  )}
>
  {isActive ? (
    <span
      aria-hidden
      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-brand-primary dark:[box-shadow:var(--glow-brand)]"
    />
  ) : null}
  <Icon
    className={cn(
      "size-4 shrink-0 transition-colors",
      !isActive && "group-hover:text-brand-primary",
    )}
  />
  {!collapsed ? (
    <>
      <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
      {badge ? <Badge variant={badge.tone} size="xs" mono>{badge.count}</Badge> : null}
    </>
  ) : null}
</Link>
```

Wrap in `Tooltip` when `collapsed`.

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/sidebar/sidebar-item.tsx
git commit -m "feat(supplier-foundation): sidebar item — indicator, hover, gold/amber badges, collapsed tooltip"
```

---

## Task 20 — Topbar breadcrumbs editorial

**Files:**
- Modify: `components/dashboard/topbar/breadcrumbs.tsx`

- [ ] **Step 1: Restyle**

Update the breadcrumb separator and text styles:
- Separator character: `/` in `text-brand-primary text-xs`.
- Parent links: `font-mono text-[11px] text-text-tertiary hover:text-brand-primary hover:underline underline-offset-4`.
- Current page: `font-display text-sm text-text-primary`.

Render with 4px gap between segments. Ensure the component keeps its existing segment derivation logic (paths → labels).

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/topbar/breadcrumbs.tsx
git commit -m "feat(supplier-foundation): editorial breadcrumbs — mono parent, display current, ocra slash"
```

---

## Task 21 — Topbar search trigger polish

**Files:**
- Modify: `components/dashboard/topbar/search-trigger.tsx`

- [ ] **Step 1: Restyle**

- Container: `h-9 rounded-lg border border-border-subtle bg-surface-muted px-3 flex items-center gap-2 transition-[width,border-color] duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]`.
- Default width: `w-[240px]`. Focus-within: `w-[320px]` on `md+` (guard with media query via Tailwind `md:focus-within:w-[320px]`).
- Icon search left, 14px stroke 1.5.
- Placeholder text: render as two spans — `"Cerca..."` in `font-sans text-[11px] text-text-tertiary` and `"⌘K"` in `font-mono text-[10px] text-text-tertiary px-1.5 py-0.5 rounded bg-surface-hover border border-border-subtle ml-auto`.
- Clicking the trigger should continue to open the existing command palette (no behaviour change).

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/topbar/search-trigger.tsx
git commit -m "feat(supplier-foundation): search trigger polish — mono placeholder, focus expand"
```

---

## Task 22 — Notification bell polish (gold badge + pulse)

**Files:**
- Modify: `components/dashboard/topbar/notification-bell.tsx`

- [ ] **Step 1: Restyle**

- Icon button: 40×40, `rounded-lg`, `text-text-tertiary hover:text-text-primary hover:bg-surface-hover`.
- Unread count badge: positioned top-right, use `<Badge variant="highlight" size="xs" mono>` when `count > 0`. For counts `> 9`, render `9+`.
- Unread pulse dot: when `count > 0`, overlay `<PulseDot variant="brand" size={6}>` at the top-right above the badge for realtime emphasis. Hide pulse if `prefers-reduced-motion`.
- `aria-label`: `"Notifiche ({count} non lette)"`.

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/topbar/notification-bell.tsx
git commit -m "feat(supplier-foundation): notification bell — gold badge, realtime pulse"
```

---

## Task 23 — Theme toggle icon swap polish

**Files:**
- Modify: `components/ui/theme-toggle.tsx`

- [ ] **Step 1: Polish icon transition**

Wrap both icons in a single button, stack them absolutely, and animate opacity + rotation on theme change. Reduced-motion → no rotation.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-9 w-9 rounded-lg bg-surface-muted", className)} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Attiva modalità chiara" : "Attiva modalità scura"}
      className={cn(
        "relative h-9 w-9 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]",
        className,
      )}
    >
      <Sun
        className={cn(
          "absolute inset-0 m-auto h-4 w-4 transition-[transform,opacity] duration-[var(--duration-normal)] ease-[var(--ease-out-expo)] motion-reduce:transition-none",
          isDark ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100",
        )}
      />
      <Moon
        className={cn(
          "absolute inset-0 m-auto h-4 w-4 transition-[transform,opacity] duration-[var(--duration-normal)] ease-[var(--ease-out-expo)] motion-reduce:transition-none",
          isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75",
        )}
      />
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/ui/theme-toggle.tsx
git commit -m "feat(supplier-foundation): theme toggle — rotate+scale icon swap"
```

---

## Task 24 — Topbar LiveStatus integration (conditional)

**Files:**
- Modify: `components/dashboard/topbar/dark-topbar.tsx`

- [ ] **Step 1: Add conditional LiveStatus slot**

Introduce a prop `liveStatus?: { count: number; label: string }` on `DarkTopbar`. Render it at the far-left of the right-hand cluster (before `SearchTrigger`), hidden below `md`.

```tsx
import { LiveStatus } from "@/components/supplier/signature";

// ... inside the component's right cluster:
{liveStatus ? (
  <div className="hidden md:block">
    <LiveStatus count={liveStatus.count} label={liveStatus.label} />
  </div>
) : null}
<SearchTrigger />
```

Update the `Props` type and the `shell.tsx` wiring (Task 27) to pass this prop only on pages that request it.

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/topbar/dark-topbar.tsx
git commit -m "feat(supplier-foundation): topbar — optional LiveStatus slot"
```

---

## Task 25 — Mobile drawer polish (blur, safe-area, swipe)

**Files:**
- Modify: `components/dashboard/mobile/sidebar-drawer.tsx`

- [ ] **Step 1: Polish styling and behavior**

- Overlay: `fixed inset-0 bg-surface-overlay backdrop-blur-xl`.
- Panel: `fixed left-0 top-0 h-full w-[320px] bg-surface-sidebar border-r border-border-default z-50 flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]`.
- Motion: use `motion.div` with `initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}`.
- Swipe-to-close: track pointer events on the panel. On horizontal drag left (delta < -80 px) release, call `onClose`. Ignore if the user is scrolling vertically (delta-y > delta-x).

Pointer handler sketch:

```tsx
const startRef = useRef<{ x: number; y: number } | null>(null);

function onPointerDown(e: React.PointerEvent) {
  startRef.current = { x: e.clientX, y: e.clientY };
}
function onPointerUp(e: React.PointerEvent) {
  const s = startRef.current;
  if (!s) return;
  const dx = e.clientX - s.x;
  const dy = Math.abs(e.clientY - s.y);
  if (dx < -80 && Math.abs(dx) > dy) onClose();
  startRef.current = null;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/mobile/sidebar-drawer.tsx
git commit -m "feat(supplier-foundation): mobile drawer — blur overlay, safe-area, swipe close"
```

---

## Task 26 — Shell: max-width container + `PageHero` slot

**Files:**
- Modify: `components/dashboard/shell.tsx`

- [ ] **Step 1: Update the main container**

Change the `<main>` to:

```tsx
<main className="flex-1 w-full pb-20 lg:pb-6">
  <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
    {children}
  </div>
</main>
```

- [ ] **Step 2: Add optional `hero` prop**

Extend the shell props with `hero?: ReactNode`. Render it directly above the children inside the same max-width container, with bottom spacing:

```tsx
<div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
  {hero ? <div className="mb-8">{hero}</div> : null}
  {children}
</div>
```

The dashboard page in Phase 2 will pass `<SerifGreeting name={companyName} />` here. This task only exposes the slot.

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/shell.tsx
git commit -m "feat(supplier-foundation): shell — max-width container + hero slot"
```

---

## Task 27 — Keyboard shortcuts help modal

**Files:**
- Create: `components/dashboard/topbar/keyboard-help-modal.tsx`
- Modify: `components/dashboard/topbar/dark-topbar.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// components/dashboard/topbar/keyboard-help-modal.tsx
"use client";

import { Modal } from "@/components/ui/modal";

type Props = { open: boolean; onClose: () => void };

const groups: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Navigazione",
    items: [
      { keys: ["⌘", "K"], label: "Apri command palette" },
      { keys: ["Ctrl", "B"], label: "Toggle sidebar" },
      { keys: ["G", "D"], label: "Vai a Dashboard" },
      { keys: ["G", "O"], label: "Vai a Ordini" },
      { keys: ["G", "C"], label: "Vai a Catalogo" },
      { keys: ["G", "K"], label: "Vai a Clienti" },
    ],
  },
  {
    title: "Azioni",
    items: [
      { keys: ["N"], label: "Nuovo (contestuale)" },
      { keys: ["Esc"], label: "Chiudi overlay" },
      { keys: ["?"], label: "Apri questa guida" },
    ],
  },
];

export function KeyboardHelpModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Scorciatoie da tastiera">
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-2">
              {g.title}
            </div>
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <li key={it.label} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-text-primary">{it.label}</span>
                  <span className="flex items-center gap-1">
                    {it.keys.map((k) => (
                      <kbd
                        key={k}
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border-default bg-surface-muted text-text-primary"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire `?` shortcut in the topbar**

In `dark-topbar.tsx`, add state + effect:

```tsx
const [helpOpen, setHelpOpen] = useState(false);

useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
    if (typing) return;
    if (e.key === "?") {
      e.preventDefault();
      setHelpOpen(true);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

Render `<KeyboardHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />` inside the topbar.

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/topbar/keyboard-help-modal.tsx components/dashboard/topbar/dark-topbar.tsx
git commit -m "feat(supplier-foundation): add keyboard shortcuts help modal triggered by '?'"
```

---

## Task 28 — Manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full build**

Run: `npm run lint && npm run build`
Expected: both green.

- [ ] **Step 2: Start dev and walk the supplier area**

Run: `npm run dev`

Verify each item from the spec §5.6 checklist:

1. `/supplier/dashboard` light: ivory surface, ocra brand elements, no visible green/terracotta regressions.
2. Same page dark: deep `#09090F`, ocra-miele brand, elevation aggressive.
3. Sidebar expand/collapse at 250ms, tooltip in collapsed state, active indicator bar visible.
4. Topbar: editorial breadcrumbs, mono search trigger with `⌘K` badge, theme toggle rotation.
5. Toast: mount a success toast (manual trigger if available) → slide-in + auto-dismiss 4s.
6. Modal: open any modal → focus trap, Escape closes.
7. Command palette: `⌘K` opens it (pre-existing behaviour preserved).
8. Press `?` → keyboard help modal opens, lists shortcuts.
9. Turn on OS reduced-motion → reload supplier dashboard → no shimmer, no pulse, no bounce.
10. Keyboard-only: Tab through sidebar, focus visible everywhere, no trapped focus.
11. Mobile viewport: drawer opens via hamburger, backdrop blur visible, swipe-left closes, safe-area respected.
12. Lighthouse on `/supplier/dashboard`: Performance ≥ 95, A11y ≥ 95, Best Practices ≥ 95.
13. Smoke test restaurant area: load `/dashboard` (restaurant). Visual parity with pre-change state — no ocra bleed, no layout shift.

- [ ] **Step 2: Fix any regression found**

If step 1–13 surface issues, fix inline and re-run verification. Do not proceed to commit until all pass.

- [ ] **Step 3: Commit verification notes (optional)**

If you made any verification-driven fixes:

```bash
git add -A
git commit -m "fix(supplier-foundation): verification pass corrections"
```

---

## Done

Phase 1 foundation complete. Five signature components available under `@/components/supplier/signature`, polished primitives and shell in place, tokens extended. Phase 2 (dashboard hero redesign) consumes this foundation.
