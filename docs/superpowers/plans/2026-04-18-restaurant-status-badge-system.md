# Restaurant Status Badge System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring supplier-area status/badge professionalism to restaurant area (`app/(app)/**`) without altering its white/cream visual identity, by centralising status semantics into one meta map, three primitives (`OrderStatusBadge`, `RelationshipStatusBadge`, `StatusDot`), a palette-coherent `CelebrationCheck`, and six restaurant-scoped tone tokens.

**Architecture:** Additive-dominant. Six new `--tone-*` CSS vars scoped under `[data-area="restaurant"]` drive all badge pills; Tailwind v4 `@theme` naming convention (`--color-brand-*`) preserved for brand refs. One status-meta module per domain (orders, relationships) is the single source of truth for label + tone + pulse + terminal. Primitives read meta via helper getters with a neutral fallback. 18 migration touchpoints, four waves (foundation → ordini core → peripheral → cleanup). Supplier area untouched (tokens scoped, signature components duplicated not moved).

**Tech Stack:** Next.js 15 (App Router, Turbopack), React 19, Tailwind v4 (`@theme` in `globals.css`), TypeScript strict, `motion` v12 (`motion/react`), `lucide-react` icons, no test framework — verification via `npm run build` + `npm run lint` + manual browser check.

**Verification model (no test runner in project):** Each task ends with `npm run lint` (fast, per-file) and/or `npm run build` (full typecheck) gate. Wave boundaries trigger manual browser check of one target route per wave. Visual regression is inspected in both `/ordini` (restaurant scope) and `/supplier/ordini` (supplier scope, must be unchanged).

---

## File Structure

### New files (7)

| Path | Responsibility |
|---|---|
| `lib/orders/status-meta.ts` | `ORDER_STATUS_META` map + `getOrderStatusMeta(status)` helper. Single source of truth for restaurant-area order status semantics (label + tone + pulse + terminal). |
| `lib/relationships/status-meta.ts` | `RELATIONSHIP_STATUS_META` map + `getRelationshipStatusMeta(status)` helper. Same shape, different domain. |
| `components/ui/status-dot.tsx` | `<StatusDot tone size pulse />` — decorative dot primitive. Pure presentation, `aria-hidden`. |
| `components/ui/order-status-badge.tsx` | `<OrderStatusBadge status size showIcon celebrate />` — tinted pill consuming `ORDER_STATUS_META`. |
| `components/ui/relationship-status-badge.tsx` | `<RelationshipStatusBadge status size />` — relationship domain twin. |
| `components/ui/celebration-check.tsx` | Palette-coherent duplicate of supplier's `CelebrationCheck` with `tone` prop (`"emerald"` default, `"brand"` alternate). |
| `lib/ui/tones.ts` | `StatusTone` type + `TONE_NAMES` constant. Shared type between meta modules and primitives. |

### Modified files (13)

| Path | Change |
|---|---|
| `app/globals.css` | Add `--tone-*` light + dark tokens scoped under `[data-area="restaurant"]` (light block around line 556, dark block around line 643). |
| `app/(app)/ordini/_lib/bucketize.ts` | `statusColorClass` delegates to `getOrderStatusMeta(status).tone` via a tone→Tailwind-class bridge, marked `@deprecated`. |
| `app/(app)/ordini/_components/timeline-row.tsx` | Raw dot `<span className="h-2 w-2 rounded-full ${dot}">` replaced with `<StatusDot tone size={8}>` reading meta. Row height preserved. |
| `app/(app)/ordini/_components/status-chips.tsx` | Inline dot `<span className="h-2 w-2 ... ${statusColorClass(status)}">` replaced with `<StatusDot tone={meta.tone} size={8}>`. Chip layout preserved. |
| `app/(app)/ordini/_components/order-peek.tsx` | Inline status block replaced with `<OrderStatusBadge size="md">`. |
| `app/(app)/ordini/orders-client.tsx` | No direct status rendering (consumer of timeline-row). Smoke-read to confirm. No edit expected. |
| `app/(app)/ordini/[id]/page.tsx` | Hero header `<Badge variant="info">{label}</Badge>` swapped with `<OrderStatusBadge status={order.status} size="md" celebrate={order.status === "delivered"}>`. Split cards (line 227) `<Badge variant="info">` swapped identically. |
| `app/(app)/ordini/[id]/conferma/confirm-client.tsx` | Same treatment as detail page. |
| `app/(app)/analytics/_components/recent-orders-log.tsx` | Dot `<span className="h-2 w-2 rounded-full ${dot}">` replaced with `<StatusDot tone={meta.tone} size={6}>`. Label logic unchanged. |
| `app/(app)/carrello/_components/receipt-supplier-block.tsx` | Split status pill swapped with `<OrderStatusBadge size="sm">`. |
| `app/(app)/fornitori/suppliers-client.tsx` | Status column/filter pill swapped with `<RelationshipStatusBadge size="sm">`. Filter count badges untouched. |
| `app/(app)/fornitori/_components/supplier-row.tsx` | Inline relationship pill swapped with `<RelationshipStatusBadge size="xs">`. |
| `app/(app)/fornitori/_components/supplier-detail-pane.tsx` | Header relationship pill swapped with `<RelationshipStatusBadge size="md">`. |

### Deletions / deprecations (2 spots)

| Path | Action |
|---|---|
| `lib/utils/constants.ts` lines 245-253 (`ORDER_STATUS_COLORS`) | Delete after Wave 3 verifies zero runtime imports. |
| `app/(app)/ordini/_lib/bucketize.ts` (`statusColorClass`) | Keep during migration; remove if zero imports remain after Wave 3. |

---

## Wave 1 — Foundation

All tasks in this wave are additive. Nothing visible changes on screen. Lint + build must pass after every task; no manual browser check required until Wave 1 end.

---

### Task 1: Add tone type module

**Files:**
- Create: `lib/ui/tones.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/ui/tones.ts
//
// Shared palette "tone" type for restaurant-area badges/dots.
// Each tone has matching --tone-{tone}-bg, --tone-{tone}-fg, --tone-{tone}-ring
// CSS variables scoped under [data-area="restaurant"] in globals.css.

export const TONE_NAMES = [
  "neutral",
  "amber",
  "blue",
  "brand",
  "emerald",
  "rose",
] as const;

export type StatusTone = (typeof TONE_NAMES)[number];
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint -- lib/ui/tones.ts`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add lib/ui/tones.ts
git commit -m "feat(ui): add StatusTone type module for restaurant badges"
```

---

### Task 2: Add tone tokens to globals.css (light + dark, restaurant scope)

**Files:**
- Modify: `app/globals.css` (light block under `[data-area="restaurant"]` around line 556; dark block under `.dark[data-area="restaurant"]` around line 643)

- [ ] **Step 1: Append tone tokens to the restaurant light-mode block**

Locate the block that starts with `[data-area="restaurant"] {` around line 556 and ends around line 635. Append the following lines BEFORE the closing `}` of that block:

```css
  /* =========================================
     Status tone palette (badges, dots)
     Soft tints on white surface; ring for hairline definition.
     ========================================= */
  --tone-neutral-bg:   rgb(244 244 245);
  --tone-neutral-fg:   rgb(82 82 91);
  --tone-neutral-ring: rgb(228 228 231);

  --tone-amber-bg:     rgb(254 243 199);
  --tone-amber-fg:     rgb(146 64 14);
  --tone-amber-ring:   rgb(253 230 138);

  --tone-blue-bg:      rgb(219 234 254);
  --tone-blue-fg:      rgb(29 78 216);
  --tone-blue-ring:    rgb(191 219 254);

  --tone-brand-bg:     var(--color-brand-primary-subtle);
  --tone-brand-fg:     var(--color-brand-depth);
  --tone-brand-ring:   var(--color-brand-primary-border);

  --tone-emerald-bg:   rgb(209 250 229);
  --tone-emerald-fg:   rgb(4 120 87);
  --tone-emerald-ring: rgb(167 243 208);

  --tone-rose-bg:      rgb(255 228 230);
  --tone-rose-fg:      rgb(159 18 57);
  --tone-rose-ring:    rgb(254 205 211);
```

- [ ] **Step 2: Append tone tokens to the restaurant dark-mode block**

Locate the block starting `.dark[data-area="restaurant"], [data-area="restaurant"].dark, [data-area="restaurant"] .dark {` around line 643. Append BEFORE the closing `}`:

```css
  /* Status tone palette — dark mode (alpha-tinted bg, brightened fg) */
  --tone-neutral-bg:   rgba(244, 244, 245, 0.06);
  --tone-neutral-fg:   rgb(212 212 216);
  --tone-neutral-ring: rgba(244, 244, 245, 0.14);

  --tone-amber-bg:     rgba(251, 191, 36, 0.12);
  --tone-amber-fg:     rgb(252 211 77);
  --tone-amber-ring:   rgba(251, 191, 36, 0.28);

  --tone-blue-bg:      rgba(96, 165, 250, 0.12);
  --tone-blue-fg:      rgb(147 197 253);
  --tone-blue-ring:    rgba(96, 165, 250, 0.28);

  --tone-brand-bg:     var(--color-brand-primary-subtle);
  --tone-brand-fg:     var(--color-brand-depth);
  --tone-brand-ring:   var(--color-brand-primary-border);

  --tone-emerald-bg:   rgba(52, 211, 153, 0.12);
  --tone-emerald-fg:   rgb(110 231 183);
  --tone-emerald-ring: rgba(52, 211, 153, 0.28);

  --tone-rose-bg:      rgba(251, 113, 133, 0.12);
  --tone-rose-fg:      rgb(253 164 175);
  --tone-rose-ring:    rgba(251, 113, 133, 0.28);
```

- [ ] **Step 3: Verify build (no CSS parse errors)**

Run: `npm run build`
Expected: build completes. No warnings about invalid CSS.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(tokens): add restaurant-scoped status tone palette (light+dark)"
```

---

### Task 3: Add order status meta module

**Files:**
- Create: `lib/orders/status-meta.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/orders/status-meta.ts
//
// Single source of truth for restaurant-area order status semantics.
// Consumed by <OrderStatusBadge>, <StatusDot> call sites, and the
// deprecated statusColorClass bridge in bucketize.ts.

import type { StatusTone } from "@/lib/ui/tones";

export type OrderStatusMeta = {
  label: string;
  tone: StatusTone;
  pulse?: boolean;                  // true → render PulseDot instead of StatusDot
  terminal?: "ok" | "ko";           // "ok" enables opt-in celebrate micro-anim
};

export const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  draft:                         { label: "Bozza",           tone: "neutral" },
  pending:                       { label: "In attesa",       tone: "amber" },
  submitted:                     { label: "Inviato",         tone: "amber" },
  pending_confirmation:          { label: "Attesa conferma", tone: "amber" },
  pending_customer_confirmation: { label: "Attesa cliente",  tone: "amber" },
  confirmed:                     { label: "Confermato",      tone: "blue" },
  preparing:                     { label: "In preparazione", tone: "brand" },
  packed:                        { label: "Imballato",       tone: "brand" },
  shipping:                      { label: "In spedizione",   tone: "brand", pulse: true },
  in_transit:                    { label: "In transito",     tone: "brand", pulse: true },
  shipped:                       { label: "Spedito",         tone: "brand", pulse: true },
  delivered:                     { label: "Consegnato",      tone: "emerald", terminal: "ok" },
  completed:                     { label: "Completato",      tone: "emerald", terminal: "ok" },
  cancelled:                     { label: "Annullato",       tone: "rose",    terminal: "ko" },
  rejected:                      { label: "Rifiutato",       tone: "rose",    terminal: "ko" },
  stock_conflict:                { label: "Conflitto stock", tone: "rose" },
};

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  return (
    ORDER_STATUS_META[status] ?? {
      label: capitalize(status),
      tone: "neutral",
    }
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint -- lib/orders/status-meta.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/orders/status-meta.ts
git commit -m "feat(orders): add ORDER_STATUS_META as single source of truth"
```

---

### Task 4: Add relationship status meta module

**Files:**
- Create: `lib/relationships/status-meta.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/relationships/status-meta.ts
//
// Single source of truth for restaurant↔supplier relationship status.
// Consumed by <RelationshipStatusBadge> in /fornitori area.

import type { StatusTone } from "@/lib/ui/tones";

export type RelationshipStatusMeta = {
  label: string;
  tone: StatusTone;
};

export const RELATIONSHIP_STATUS_META: Record<string, RelationshipStatusMeta> = {
  pending:  { label: "In attesa",  tone: "amber" },
  active:   { label: "Attiva",     tone: "emerald" },
  paused:   { label: "In pausa",   tone: "neutral" },
  rejected: { label: "Rifiutata",  tone: "rose" },
  archived: { label: "Archiviata", tone: "neutral" },
};

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function getRelationshipStatusMeta(status: string): RelationshipStatusMeta {
  return (
    RELATIONSHIP_STATUS_META[status] ?? {
      label: capitalize(status),
      tone: "neutral",
    }
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint -- lib/relationships/status-meta.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/relationships/status-meta.ts
git commit -m "feat(relationships): add RELATIONSHIP_STATUS_META"
```

---

### Task 5: Add StatusDot primitive

**Files:**
- Create: `components/ui/status-dot.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/ui/status-dot.tsx
//
// Decorative colored dot used inside status badges, filter chips, and
// dense log rows. aria-hidden — the accessible label lives on the parent.
// When pulse=true, renders an absolute-positioned animated ring layer
// (hidden under prefers-reduced-motion).

import { cn } from "@/lib/utils/formatters";
import type { StatusTone } from "@/lib/ui/tones";

type Props = {
  tone: StatusTone;
  size?: number;    // px, default 6
  pulse?: boolean;  // default false
  className?: string;
};

export function StatusDot({ tone, size = 6, pulse = false, className }: Props) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: `var(--tone-${tone}-fg)`,
  };

  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block shrink-0 rounded-full", className)}
      style={style}
    >
      {pulse ? (
        <span
          aria-hidden
          className="absolute inset-[-3px] rounded-full border-2 opacity-60 motion-reduce:hidden"
          style={{
            borderColor: `var(--tone-${tone}-fg)`,
            animation: "pulse-ring var(--duration-pulse, 1800ms) ease-out infinite",
          }}
        />
      ) : null}
    </span>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint -- components/ui/status-dot.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/status-dot.tsx
git commit -m "feat(ui): add StatusDot primitive (tone-driven, pulse-capable)"
```

---

### Task 6: Add CelebrationCheck primitive (palette-coherent duplicate)

**Files:**
- Create: `components/ui/celebration-check.tsx`

Note: the supplier version lives at `components/supplier/signature/celebration-check.tsx` and is bound to `--color-brand-highlight` (gold, which restaurant does not have). We duplicate rather than share, parameterize by `tone`. Supplier remains untouched.

- [ ] **Step 1: Write the component**

```tsx
// components/ui/celebration-check.tsx
//
// Palette-coherent celebratory checkmark for restaurant-area terminal-ok
// states (delivered, completed). Mounts with a spring overshoot; respects
// prefers-reduced-motion (falls back to a static filled circle).
// Tone parameterises the fill/icon color; defaults to emerald (restaurant
// coerente with soft emerald badge). Alternate "brand" ties to carmine.

"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

type Tone = "emerald" | "brand";

type Props = {
  size?: number;       // px diameter, default 14
  tone?: Tone;         // default "emerald"
  className?: string;
};

export function CelebrationCheck({
  size = 14,
  tone = "emerald",
  className,
}: Props) {
  const reduced = useReducedMotion();
  const iconSize = Math.max(8, Math.round(size * 0.62));
  const style = {
    width: size,
    height: size,
    background: `var(--tone-${tone}-bg)`,
    color: `var(--tone-${tone}-fg)`,
  } as React.CSSProperties;

  if (reduced) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          className,
        )}
        style={style}
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
        duration: 0.55,
        times: [0, 0.6, 1],
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        className,
      )}
      style={style}
      aria-label="Completato"
      role="status"
    >
      <Check strokeWidth={3} width={iconSize} height={iconSize} />
    </motion.span>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint -- components/ui/celebration-check.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/celebration-check.tsx
git commit -m "feat(ui): add CelebrationCheck (palette-coherent, emerald default)"
```

---

### Task 7: Add OrderStatusBadge primitive

**Files:**
- Create: `components/ui/order-status-badge.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/ui/order-status-badge.tsx
//
// Tinted pill rendering the canonical meta for an order status.
// Reads from ORDER_STATUS_META via getOrderStatusMeta, falling back to
// a neutral capitalized label for unknown statuses. Opt-in celebrate
// prop fires a one-shot micro-anim on mount when the meta is terminal:"ok".

import { cn } from "@/lib/utils/formatters";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { StatusDot } from "./status-dot";
import { CelebrationCheck } from "./celebration-check";

type Size = "xs" | "sm" | "md";

type Props = {
  status: string;
  size?: Size;          // default "sm"
  showIcon?: boolean;   // default true — hide for ultra-dense rows
  celebrate?: boolean;  // default false — one-shot anim on mount for terminal:"ok"
  className?: string;
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "text-[10px] px-1.5 py-0 gap-1",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-[12px] px-2.5 py-1 gap-1.5",
};

const DOT_SIZE: Record<Size, number> = { xs: 4, sm: 6, md: 7 };
const CHECK_SIZE: Record<Size, number> = { xs: 10, sm: 12, md: 14 };

export function OrderStatusBadge({
  status,
  size = "sm",
  showIcon = true,
  celebrate = false,
  className,
}: Props) {
  const meta = getOrderStatusMeta(status);
  const style = {
    background: `var(--tone-${meta.tone}-bg)`,
    color: `var(--tone-${meta.tone}-fg)`,
    boxShadow: `inset 0 0 0 1px var(--tone-${meta.tone}-ring)`,
  } as React.CSSProperties;

  return (
    <span
      role="status"
      aria-label={`Stato: ${meta.label}`}
      data-tone={meta.tone}
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums tracking-tight whitespace-nowrap",
        SIZE_CLASSES[size],
        className,
      )}
      style={style}
    >
      {showIcon ? (
        <StatusDot
          tone={meta.tone}
          size={DOT_SIZE[size]}
          pulse={meta.pulse}
        />
      ) : null}
      {celebrate && meta.terminal === "ok" ? (
        <CelebrationCheck size={CHECK_SIZE[size]} tone="emerald" />
      ) : null}
      <span>{meta.label}</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint -- components/ui/order-status-badge.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/order-status-badge.tsx
git commit -m "feat(ui): add OrderStatusBadge primitive"
```

---

### Task 8: Add RelationshipStatusBadge primitive

**Files:**
- Create: `components/ui/relationship-status-badge.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/ui/relationship-status-badge.tsx
//
// Domain twin of OrderStatusBadge for supplier↔restaurant relationship
// states (active/paused/pending/rejected/archived). No pulse, no celebrate
// — relationship states are not live-animated.

import { cn } from "@/lib/utils/formatters";
import { getRelationshipStatusMeta } from "@/lib/relationships/status-meta";
import { StatusDot } from "./status-dot";

type Size = "xs" | "sm" | "md";

type Props = {
  status: string;
  size?: Size;
  showIcon?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "text-[10px] px-1.5 py-0 gap-1",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-[12px] px-2.5 py-1 gap-1.5",
};

const DOT_SIZE: Record<Size, number> = { xs: 4, sm: 6, md: 7 };

export function RelationshipStatusBadge({
  status,
  size = "sm",
  showIcon = true,
  className,
}: Props) {
  const meta = getRelationshipStatusMeta(status);
  const style = {
    background: `var(--tone-${meta.tone}-bg)`,
    color: `var(--tone-${meta.tone}-fg)`,
    boxShadow: `inset 0 0 0 1px var(--tone-${meta.tone}-ring)`,
  } as React.CSSProperties;

  return (
    <span
      role="status"
      aria-label={`Partnership: ${meta.label}`}
      data-tone={meta.tone}
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums tracking-tight whitespace-nowrap",
        SIZE_CLASSES[size],
        className,
      )}
      style={style}
    >
      {showIcon ? <StatusDot tone={meta.tone} size={DOT_SIZE[size]} /> : null}
      <span>{meta.label}</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint -- components/ui/relationship-status-badge.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/relationship-status-badge.tsx
git commit -m "feat(ui): add RelationshipStatusBadge primitive"
```

---

### Task 9: Wave 1 full build gate + visual smoke check

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: build completes with no type errors, no warnings introduced.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `npm run dev`
Open: `http://localhost:3000/ordini` and `http://localhost:3000/supplier/ordini`.
Expected: both look identical to pre-Wave-1. New tokens and primitives are not rendered anywhere yet — zero visual delta is the success criterion.

- [ ] **Step 3: Close dev server, mark Wave 1 done**

No commit at this step — Wave 1 foundation is complete.

---

## Wave 2 — Ordini core migration

This wave swaps the primitives into the most-visible order surfaces. Every task ends with `npm run lint` on the edited file and commit. After Task 15 the whole restaurant order flow uses the new system.

---

### Task 10: Bridge statusColorClass to meta (deprecate, no visible change yet)

**Files:**
- Modify: `app/(app)/ordini/_lib/bucketize.ts`

- [ ] **Step 1: Replace statusColorClass body to delegate to meta**

Replace the existing `statusColorClass` export at the bottom of `app/(app)/ordini/_lib/bucketize.ts` (around lines 66-88) with the version below. Keep all code above line 66 intact.

```ts
// Status → dot color — DEPRECATED: migrate call sites to read
// ORDER_STATUS_META.tone directly and render <StatusDot tone />.
// This wrapper returns a CSS-var-backed Tailwind arbitrary-value class
// so existing consumers keep working during Wave 2 migration.
/** @deprecated Use getOrderStatusMeta(status).tone + <StatusDot> */
export function statusColorClass(status: string): string {
  // Tone → arbitrary-value bg class reading the restaurant scope token.
  // After all call sites migrate, delete this function.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getOrderStatusMeta } = require("@/lib/orders/status-meta") as typeof import("@/lib/orders/status-meta");
  const tone = getOrderStatusMeta(status).tone;
  return `bg-[var(--tone-${tone}-fg)]`;
}
```

Note: the runtime `require` avoids a circular import risk in client bundles that pre-existed the migration. If lint blocks the eslint-disable, replace with a top-of-file import instead (and remove the comment + require).

Better alternative — use a static import at the top of the file:

```ts
// Add near the other imports at the top of bucketize.ts:
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
```

Then the function body becomes:

```ts
/** @deprecated Use getOrderStatusMeta(status).tone + <StatusDot> */
export function statusColorClass(status: string): string {
  const tone = getOrderStatusMeta(status).tone;
  return `bg-[var(--tone-${tone}-fg)]`;
}
```

Use the static-import form. The arbitrary Tailwind value is parsed at build time.

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/ordini/_lib/bucketize.ts`
Then: `npm run build`
Expected: no errors. The `bg-[var(--tone-${tone}-fg)]` class is preserved by Tailwind's JIT arbitrary-value scanner.

- [ ] **Step 3: Manual check — dev server**

Run: `npm run dev`, open `/ordini`. The row dots should still render but now pull color from `--tone-X-fg` CSS vars. Visually very similar to before (tones are saturated versions). Acceptable.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/ordini/_lib/bucketize.ts
git commit -m "refactor(ordini): bridge statusColorClass to ORDER_STATUS_META (deprecated)"
```

---

### Task 11: Migrate timeline-row dot to StatusDot

**Files:**
- Modify: `app/(app)/ordini/_components/timeline-row.tsx`

- [ ] **Step 1: Read the file first**

Run: `cat "app/(app)/ordini/_components/timeline-row.tsx"` (or open in editor) to confirm current structure. Expected: imports `ORDER_STATUS_LABELS` and `statusColorClass`, renders `<span className="h-2 w-2 rounded-full ${dot}">` around line 73.

- [ ] **Step 2: Replace imports + dot render**

At the top of the file, replace:

```tsx
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import { statusColorClass } from "../_lib/bucketize";
```

with:

```tsx
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { StatusDot } from "@/components/ui/status-dot";
```

Replace the status label + dot computation (around lines 46-47):

```tsx
const statusLabel = ORDER_STATUS_LABELS[row.status] ?? row.status;
const dot = statusColorClass(row.status);
```

with:

```tsx
const meta = getOrderStatusMeta(row.status);
const statusLabel = meta.label;
```

Replace the dot JSX around line 72-74 (whatever block renders `<span className="h-2 w-2 rounded-full ${dot}">`) with:

```tsx
<StatusDot tone={meta.tone} size={8} pulse={meta.pulse} />
```

Preserve every other className and wrapper element. Row height must not change — the dot is 8px square, matching the previous `h-2 w-2` (8px).

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/ordini/_components/timeline-row.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open `/ordini`. Timeline rows should render with StatusDot — identical size, saturated tone color. Shipping-state rows now pulse.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/ordini/_components/timeline-row.tsx
git commit -m "refactor(ordini): timeline-row dot → <StatusDot> (pulse on shipping)"
```

---

### Task 12: Migrate status-chips dot to StatusDot

**Files:**
- Modify: `app/(app)/ordini/_components/status-chips.tsx`

- [ ] **Step 1: Read the file first**

Expected current content: inline `<span className="h-2 w-2 shrink-0 rounded-full ${statusColorClass(status)}">` around line 67, imports `statusColorClass` from `../_lib/bucketize`.

- [ ] **Step 2: Replace import + dot**

At the top, add import (keep existing):

```tsx
import { StatusDot } from "@/components/ui/status-dot";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
```

Inside the `present.map(([status, count]) => { ... })` body, after `const active = selected.has(status);`, add:

```tsx
const tone = getOrderStatusMeta(status).tone;
```

Replace the inline dot `<span className="h-2 w-2 shrink-0 rounded-full ${statusColorClass(status)}" aria-hidden />` with:

```tsx
<StatusDot tone={tone} size={8} />
```

Leave the rest of the chip rendering (button, label, count, transitions, active state ring) untouched.

- [ ] **Step 3: Remove unused import**

Delete the `statusColorClass` import line from the top of the file if it is now unused (grep the file for remaining references first).

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/ordini/_components/status-chips.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/ordini/_components/status-chips.tsx
git commit -m "refactor(ordini): status-chips dot → <StatusDot>"
```

---

### Task 13: Migrate order-peek to OrderStatusBadge

**Files:**
- Modify: `app/(app)/ordini/_components/order-peek.tsx`

- [ ] **Step 1: Read the file**

Expected: renders a status block with `statusColorClass` dot + `ORDER_STATUS_LABELS` label around lines 60-68.

- [ ] **Step 2: Replace imports**

Remove:

```tsx
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import { statusColorClass } from "../_lib/bucketize";
```

Add:

```tsx
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
```

- [ ] **Step 3: Replace the status block**

Find the block that renders the inline pill (around lines 60-66). Typical shape:

```tsx
<div className="... flex items-center gap-2 ...">
  <span className={`h-2 w-2 rounded-full ${statusColorClass(row.status)}`} />
  <span>{statusLabel}</span>
</div>
```

Replace with:

```tsx
<OrderStatusBadge status={row.status} size="md" />
```

Remove now-unused `statusLabel` variable if it exists.

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/ordini/_components/order-peek.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/ordini/_components/order-peek.tsx
git commit -m "refactor(ordini): order-peek status → <OrderStatusBadge size=md>"
```

---

### Task 14: Migrate order detail page header + split cards

**Files:**
- Modify: `app/(app)/ordini/[id]/page.tsx`

- [ ] **Step 1: Read the file**

Expected: two `<Badge variant=...>` usages — one in header around line 128, one on split cards around line 227. Both use `ORDER_STATUS_LABELS`.

- [ ] **Step 2: Replace imports**

Remove (if only used for this):

```tsx
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
```

Add:

```tsx
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
```

Keep the existing `Badge` import if it is used elsewhere on the page.

- [ ] **Step 3: Replace header badge (around line 128)**

Find:

```tsx
<Badge variant={order.status === "delivered" ? "success" : "info"}>
  {ORDER_STATUS_LABELS[order.status] ?? order.status}
</Badge>
```

Replace with:

```tsx
<OrderStatusBadge
  status={order.status}
  size="md"
  celebrate={order.status === "delivered" || order.status === "completed"}
/>
```

- [ ] **Step 4: Replace split cards badge (around line 227)**

Find:

```tsx
<Badge variant="info">{ORDER_STATUS_LABELS[split.status] ?? split.status}</Badge>
```

Replace with:

```tsx
<OrderStatusBadge status={split.status} size="sm" />
```

- [ ] **Step 5: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/ordini/\\[id\\]/page.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`, navigate to a delivered order at `/ordini/<id>`. Header shows emerald pill with one-shot celebration check. Split cards show appropriate tones per split status. Refresh page — celebrate fires again (intended: fires on mount, not on updates).

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/ordini/\[id\]/page.tsx
git commit -m "refactor(ordini): detail page badges → <OrderStatusBadge> (celebrate on delivered)"
```

---

### Task 15: Migrate order confirm client

**Files:**
- Modify: `app/(app)/ordini/[id]/conferma/confirm-client.tsx`

- [ ] **Step 1: Read the file and locate status badge usages**

Run: `grep -n "ORDER_STATUS_LABELS\|Badge\|status" "app/(app)/ordini/[id]/conferma/confirm-client.tsx"` to find the status pill rendering.

- [ ] **Step 2: Replace imports**

Remove `ORDER_STATUS_LABELS` import if only used for status; add `OrderStatusBadge` import:

```tsx
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
```

- [ ] **Step 3: Replace each status pill**

For each `<Badge variant=...>{ORDER_STATUS_LABELS[x] ?? x}</Badge>`, replace with:

```tsx
<OrderStatusBadge status={x} size="sm" />
```

Size `"sm"` for in-flow badges, `"md"` for any hero-position badge.

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/ordini/\\[id\\]/conferma/confirm-client.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/ordini/\[id\]/conferma/confirm-client.tsx
git commit -m "refactor(ordini): confirm-client badges → <OrderStatusBadge>"
```

---

### Task 16: Wave 2 full build gate + visual check

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: no errors, no warnings added.

- [ ] **Step 2: Dev server manual pass**

Run: `npm run dev`. Check these pages:

1. `/ordini` (list + sidebar peek): chips have tone-tinted dots, timeline rows have StatusDot with pulse on shipping, peek uses `<OrderStatusBadge size="md">`.
2. `/ordini/<id>` delivered order: header emerald pill with celebration, split cards with proper tones.
3. `/ordini/<id>/conferma`: status pills coerenti.
4. `/supplier/ordini`: visually unchanged (screenshot-diff optional).

Expected: restaurant area badge story is visibly unified. Supplier area unchanged.

- [ ] **Step 3: Close dev, Wave 2 done**

No commit at this step.

---

## Wave 3 — Peripheral migration

---

### Task 17: Migrate analytics recent-orders-log dot

**Files:**
- Modify: `app/(app)/analytics/_components/recent-orders-log.tsx`

- [ ] **Step 1: Replace imports**

Remove:

```tsx
import { statusColorClass } from "@/app/(app)/ordini/_lib/bucketize";
```

Keep the existing `ORDER_STATUS_LABELS` import (the component uses raw labels inline, not a badge).

Add:

```tsx
import { StatusDot } from "@/components/ui/status-dot";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
```

- [ ] **Step 2: Replace dot computation + render**

Find (around line 82):

```tsx
const label = ORDER_STATUS_LABELS[row.status] ?? row.status;
const dot = statusColorClass(row.status);
```

Replace with:

```tsx
const meta = getOrderStatusMeta(row.status);
const label = meta.label;
```

Find (around line 101):

```tsx
<span
  className={`h-2 w-2 rounded-full ${dot}`}
  aria-hidden
/>
```

Replace with:

```tsx
<StatusDot tone={meta.tone} size={8} />
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/analytics/_components/recent-orders-log.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/analytics/_components/recent-orders-log.tsx
git commit -m "refactor(analytics): recent-orders-log dot → <StatusDot>"
```

---

### Task 18: Migrate carrello receipt-supplier-block

**Files:**
- Modify: `app/(app)/carrello/_components/receipt-supplier-block.tsx`

- [ ] **Step 1: Read the file**

Run: `grep -n "status\|Badge\|ORDER_STATUS" "app/(app)/carrello/_components/receipt-supplier-block.tsx"` to locate the status pill.

- [ ] **Step 2: Replace the status pill**

For each inline status pill (whether `<Badge variant=>` or ad-hoc `<span class>`), replace with:

```tsx
<OrderStatusBadge status={splitStatus} size="sm" />
```

Add the import:

```tsx
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
```

Remove `ORDER_STATUS_LABELS` / `statusColorClass` imports if they become unused.

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/carrello/_components/receipt-supplier-block.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/carrello/_components/receipt-supplier-block.tsx
git commit -m "refactor(carrello): receipt split status → <OrderStatusBadge>"
```

---

### Task 19: Migrate fornitori suppliers-client + supplier-row + detail-pane

**Files:**
- Modify: `app/(app)/fornitori/suppliers-client.tsx`
- Modify: `app/(app)/fornitori/_components/supplier-row.tsx`
- Modify: `app/(app)/fornitori/_components/supplier-detail-pane.tsx`

- [ ] **Step 1: Read each file to locate relationship status rendering**

Run: `grep -n "status\|Badge\|relationship" "app/(app)/fornitori/_components/supplier-row.tsx" "app/(app)/fornitori/_components/supplier-detail-pane.tsx" "app/(app)/fornitori/suppliers-client.tsx"`.

- [ ] **Step 2: Replace row pill**

In `supplier-row.tsx`, locate the inline relationship badge (typically an ad-hoc `<span>` or `<Badge variant=>` rendering `active`/`paused`/`pending`/etc). Replace with:

```tsx
<RelationshipStatusBadge status={relationship.status} size="xs" />
```

Add import:

```tsx
import { RelationshipStatusBadge } from "@/components/ui/relationship-status-badge";
```

- [ ] **Step 3: Replace detail-pane header badge**

In `supplier-detail-pane.tsx`, locate the header status pill. Replace with:

```tsx
<RelationshipStatusBadge status={relationship.status} size="md" />
```

Add import at the top.

- [ ] **Step 4: Replace suppliers-client filter/summary pill (if any)**

In `suppliers-client.tsx`, if a relationship status pill is rendered outside the row/pane, replace with `<RelationshipStatusBadge size="sm">`. Filter count chips (showing counts per status) stay as-is — they are a separate UI concern.

- [ ] **Step 5: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/fornitori/_components/supplier-row.tsx app/\\(app\\)/fornitori/_components/supplier-detail-pane.tsx app/\\(app\\)/fornitori/suppliers-client.tsx`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`, open `/fornitori`. Rows show relationship badges with correct tones (active=emerald, paused=neutral, pending=amber, rejected=rose). Select one → detail pane shows `size="md"` badge with same tone.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/fornitori/_components/supplier-row.tsx app/\(app\)/fornitori/_components/supplier-detail-pane.tsx app/\(app\)/fornitori/suppliers-client.tsx
git commit -m "refactor(fornitori): relationship status → <RelationshipStatusBadge>"
```

---

### Task 20: Wave 3 full build gate + visual check

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 2: Dev server manual pass**

Routes to check: `/analytics`, `/carrello` (with items from multiple suppliers), `/fornitori` (list + detail pane). Verify badges coerenti col resto dell'area ristoratore.

Supplier smoke: `/supplier/ordini` + `/supplier/dashboard` — no visual delta.

- [ ] **Step 3: Close dev, Wave 3 done**

---

## Wave 4 — Cleanup

---

### Task 21: Remove dead ORDER_STATUS_COLORS map

**Files:**
- Modify: `lib/utils/constants.ts`

- [ ] **Step 1: Verify zero runtime usage**

Run: `grep -rn "ORDER_STATUS_COLORS" "D:/Manum/GastroBridge" --include="*.ts" --include="*.tsx"`
Expected: only the definition line in `lib/utils/constants.ts:245`. No importers.

If any importer exists, migrate that file first (it should have been covered in Waves 2-3; if not, add the migration here before deleting).

- [ ] **Step 2: Delete the `ORDER_STATUS_COLORS` block**

Remove lines 245-253 from `lib/utils/constants.ts` (the entire `export const ORDER_STATUS_COLORS: Record<string, string> = { ... };` block).

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint -- lib/utils/constants.ts`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/utils/constants.ts
git commit -m "chore(cleanup): remove dead ORDER_STATUS_COLORS map"
```

---

### Task 22: Remove statusColorClass wrapper if unused

**Files:**
- Modify: `app/(app)/ordini/_lib/bucketize.ts`

- [ ] **Step 1: Verify zero external imports**

Run: `grep -rn "statusColorClass" "D:/Manum/GastroBridge/app" "D:/Manum/GastroBridge/components" "D:/Manum/GastroBridge/lib" --include="*.ts" --include="*.tsx"`
Expected: only the definition inside `bucketize.ts`. Zero external imports.

If any file still imports it, do not proceed — migrate that file's dot to `<StatusDot>` first.

- [ ] **Step 2: Remove the export**

Delete the `/** @deprecated */ export function statusColorClass(...)` block from `bucketize.ts` as well as the `import { getOrderStatusMeta } from "@/lib/orders/status-meta";` line if it was added only for this wrapper.

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint -- app/\\(app\\)/ordini/_lib/bucketize.ts`
Then: `npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/ordini/_lib/bucketize.ts
git commit -m "chore(cleanup): remove deprecated statusColorClass wrapper"
```

---

## Final verification

- [ ] **Step 1: Build + lint clean**

Run: `npm run build && npm run lint`
Expected: both pass. No new warnings.

- [ ] **Step 2: Full restaurant visual pass (light + dark)**

Run: `npm run dev`. Check in order, both in light and dark mode:

1. `/dashboard` — no status badges directly but verify overall feel unchanged
2. `/ordini` list — chip dots, row dots, timeline, peek
3. `/ordini/<id>` — one delivered order (celebration), one cancelled (rose), one shipping (pulse)
4. `/ordini/<id>/conferma`
5. `/carrello` with an active multi-supplier cart
6. `/fornitori` list + detail pane (each relationship status)
7. `/analytics` recent orders log

- [ ] **Step 3: Supplier regression check**

Check `/supplier/dashboard`, `/supplier/ordini` (list + kanban), `/supplier/magazzino`. Confirm zero visual delta vs pre-implementation.

- [ ] **Step 4: Reduced-motion check**

In OS settings enable "reduce motion" → revisit `/ordini` and `/ordini/<id>` for a delivered order. Pulse ring on shipping badges hidden (static dot remains). CelebrationCheck static filled circle (no bounce).

- [ ] **Step 5: Memory update**

Update `C:\Users\Manum\.claude\projects\D--Manum-GastroBridge\memory\MEMORY.md` + add a new project memory `project_restaurant_status_badges.md` describing the shipped system (tones, primitives, migration footprint, 2026-04-18).

---

## Self-review notes

- **Spec coverage:** every spec section maps to tasks — tone tokens (Task 2), meta modules (Tasks 3-4), primitives (Tasks 5-8), migration waves 2-3 (Tasks 10-19), cleanup (Tasks 21-22). A11y obligations live inside the primitive code (roles, aria-labels, motion-reduce). Manual verification covers them in Tasks 9/16/20/final.
- **Placeholder scan:** no "TBD"/"TODO"/"add error handling"/"similar to task N" entries. Every code step contains exact code to write.
- **Type consistency:** `StatusTone` defined once in Task 1 (`lib/ui/tones.ts`), imported by Tasks 3, 4, 5. `OrderStatusMeta` and `RelationshipStatusMeta` shapes consistent across their respective modules and their consumer primitives.
- **Ambiguity (intentional):** Task 11 and Task 13 describe "locate the block around line X" because the exact line may drift before execution; the text context makes the target unambiguous.
