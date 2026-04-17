# /cerca Awwwards Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `app/(app)/cerca/` with a Bloomberg/Linear terminal-dense split-view UI, client-side MiniSearch index, virtualized results, full facet sidebar, shareable URL state, and keyboard shortcuts — zero input lag up to 5k product groups.

**Architecture:** Split view (facet sidebar | results list | detail pane). Existing server fetch in `page.tsx` stays unchanged; `search-client.tsx` becomes a thin shell that owns tab + URL state. All compute (groups, ranking, facet filtering, search) is client-side memoized. Search uses a `MiniSearch` index built once per catalogs change; facet filtering is pure functions over the ranked `Group[]`. Virtual list via `@tanstack/react-virtual`. Typical-order logic preserved, reskinned, and now shares the MiniSearch index for inline add-by-search.

**Tech Stack:** Next.js 15 (App Router, RSC) · React 19 · Tailwind v4 · TypeScript · `minisearch` (new) · `@tanstack/react-virtual` (already installed) · existing `lib/scoring` + `lib/catalogs/normalize`.

**Spec:** `docs/superpowers/specs/2026-04-17-cerca-awwwards-redesign-design.md`

**Testing stance:** Project has no unit-test framework. Verification relies on:
- `npx tsc --noEmit` (types)
- `npm run lint`
- `npm run dev` + manual scenarios (listed at each task)

Add no tests unless a task explicitly calls for one.

---

## File structure (target)

```
app/(app)/cerca/
  page.tsx                                (unchanged)
  search-client.tsx                       (rewrite — shell + tab + URL sync)
  _components/
    search-bar.tsx
    results-list.tsx
    result-row.tsx
    sparkline.tsx
    facet-panel.tsx
    facet-group.tsx
    facet-range.tsx
    detail-pane.tsx
    best-offer-card.tsx
    offer-list.tsx
    score-breakdown-inline.tsx
    typical-order-panel.tsx
    typical-order-table.tsx
    typical-order-add.tsx
    import-wizard.tsx                     (extracted from old search-client + reskin)
    keyboard-hint.tsx
    cheatsheet-overlay.tsx
    mobile-drawer.tsx
  _lib/
    product-index.ts
    facets.ts
    url-state.ts
    types.ts                              (shared client types: Group, RankedOffer, etc.)
    use-keyboard.ts                       (hook for shortcut wiring)
lib/search/
  highlight.tsx
```

Every task below says exactly which file(s) it creates or modifies.

---

## Task 1: Install `minisearch`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install minisearch@^7.1.0
```

- [ ] **Step 2: Verify**

```bash
npm ls minisearch
```
Expected: `gastrobridge@0.1.0 -> minisearch@7.x.x`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS (no new errors).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add minisearch for /cerca client-side search"
```

---

## Task 2: Shared client types

**Files:**
- Create: `app/(app)/cerca/_lib/types.ts`

These types are lifted out of the existing `search-client.tsx` so every new component can import from one place.

- [ ] **Step 1: Create file**

```ts
// app/(app)/cerca/_lib/types.ts
import type { ScoredOffer } from "@/lib/scoring";

export type SupplierLite = {
  id: string;
  supplier_name: string;
  delivery_days: number | null;
  min_order_amount: number | null;
};

export type CatalogItemLite = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
  notes: string | null;
};

export type RankedOffer = {
  scored: ScoredOffer;
  supplier: SupplierLite;
  itemId: string;
  price: number;
};

export type Group = {
  key: string;
  productName: string;
  unit: string;
  offers: RankedOffer[];
  averagePrice: number;
};

export type OrderLine = {
  key: string;
  productName: string;
  unit: string;
  qty: number;
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_lib/types.ts
git commit -m "feat(cerca): extract shared client types"
```

---

## Task 3: `_lib/product-index.ts` — MiniSearch wrapper

**Files:**
- Create: `app/(app)/cerca/_lib/product-index.ts`

- [ ] **Step 1: Create file**

```ts
// app/(app)/cerca/_lib/product-index.ts
import MiniSearch from "minisearch";
import { normalizeName } from "@/lib/catalogs/normalize";
import type { Group } from "./types";

export type IndexedDoc = {
  id: string;            // Group.key
  productName: string;
  unit: string;
  supplierNames: string;
};

export type ProductIndex = MiniSearch<IndexedDoc>;

/**
 * Tokenizer: lowercase, strip diacritics, split on whitespace + punctuation.
 * Reuses `normalizeName` for consistency with catalog-item normalization.
 */
function tokenize(text: string): string[] {
  return normalizeName(text).split(/\s+/).filter(Boolean);
}

export function buildIndex(groups: Group[]): ProductIndex {
  const mini = new MiniSearch<IndexedDoc>({
    fields: ["productName", "unit", "supplierNames"],
    storeFields: ["id"],
    tokenize,
    processTerm: (term) => term.toLowerCase(),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { productName: 3, unit: 1 },
      combineWith: "AND",
    },
  });
  mini.addAll(
    groups.map((g) => ({
      id: g.key,
      productName: g.productName,
      unit: g.unit,
      supplierNames: g.offers.map((o) => o.supplier.supplier_name).join(" "),
    })),
  );
  return mini;
}

/**
 * Returns matching Group keys ordered by MiniSearch score (best first).
 * Empty query returns all group keys (preserving input order).
 */
export function searchGroups(
  index: ProductIndex,
  groups: Group[],
  query: string,
): string[] {
  const q = query.trim();
  if (!q) return groups.map((g) => g.key);
  const res = index.search(q);
  return res.map((r) => r.id as string);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_lib/product-index.ts
git commit -m "feat(cerca): add MiniSearch product index builder"
```

---

## Task 4: `_lib/facets.ts` — facet filter + live counts

**Files:**
- Create: `app/(app)/cerca/_lib/facets.ts`

- [ ] **Step 1: Create file**

```ts
// app/(app)/cerca/_lib/facets.ts
import type { Group, RankedOffer } from "./types";

export type FacetState = {
  units: Set<string>;
  supplierIds: Set<string>;
  categories: Set<string>;          // macroCategory from offers
  priceRange: [number, number] | null;
  minScore: number;                 // 0..100
  bioOnly: boolean;
  certs: Set<string>;
};

export const emptyFacets = (): FacetState => ({
  units: new Set(),
  supplierIds: new Set(),
  categories: new Set(),
  priceRange: null,
  minScore: 0,
  bioOnly: false,
  certs: new Set(),
});

export function hasActiveFacets(f: FacetState): boolean {
  return (
    f.units.size > 0 ||
    f.supplierIds.size > 0 ||
    f.categories.size > 0 ||
    f.priceRange !== null ||
    f.minScore > 0 ||
    f.bioOnly ||
    f.certs.size > 0
  );
}

// Facet predicates are keyed by facet name so we can exclude the current
// facet when computing its own counts (standard "or all" facet semantics).
type FacetKey = "units" | "suppliers" | "categories" | "price" | "score" | "bio" | "certs";

function matchOne(g: Group, f: FacetState, skip?: FacetKey): boolean {
  const best = g.offers[0];
  if (!best) return false;

  if (skip !== "units" && f.units.size > 0 && !f.units.has(g.unit)) return false;

  if (skip !== "suppliers" && f.supplierIds.size > 0) {
    const ok = g.offers.some((o) => f.supplierIds.has(o.supplier.id));
    if (!ok) return false;
  }

  if (skip !== "categories" && f.categories.size > 0) {
    const ok = g.offers.some((o) =>
      f.categories.has(o.scored.offer.macroCategory ?? "altro"),
    );
    if (!ok) return false;
  }

  if (skip !== "price" && f.priceRange) {
    const [min, max] = f.priceRange;
    if (best.price < min || best.price > max) return false;
  }

  if (skip !== "score" && f.minScore > 0) {
    if (best.scored.score < f.minScore) return false;
  }

  if (skip !== "bio" && f.bioOnly) {
    const ok = g.offers.some((o) => o.scored.offer.isBio);
    if (!ok) return false;
  }

  if (skip !== "certs" && f.certs.size > 0) {
    const ok = g.offers.some((o) =>
      (o.scored.offer.certifications ?? []).some((c: string) => f.certs.has(c)),
    );
    if (!ok) return false;
  }

  return true;
}

export function applyFacets(groups: Group[], f: FacetState): Group[] {
  return groups.filter((g) => matchOne(g, f));
}

export type FacetOption<V = string> = { value: V; count: number; label?: string };

export type FacetCounts = {
  units: FacetOption[];
  suppliers: FacetOption[];
  categories: FacetOption[];
  certs: FacetOption[];
  priceBounds: [number, number];   // min/max across all offers
};

export function computeFacetCounts(all: Group[], f: FacetState): FacetCounts {
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  const units = new Map<string, number>();
  const suppliers = new Map<string, number>();
  const supplierNames = new Map<string, string>();
  const categories = new Map<string, number>();
  const certs = new Map<string, number>();

  let pMin = Number.POSITIVE_INFINITY;
  let pMax = 0;

  for (const g of all) {
    if (matchOne(g, f, "units")) bump(units, g.unit);

    if (matchOne(g, f, "suppliers")) {
      const seen = new Set<string>();
      for (const o of g.offers) {
        if (seen.has(o.supplier.id)) continue;
        seen.add(o.supplier.id);
        bump(suppliers, o.supplier.id);
        supplierNames.set(o.supplier.id, o.supplier.supplier_name);
      }
    }

    if (matchOne(g, f, "categories")) {
      const seen = new Set<string>();
      for (const o of g.offers) {
        const c = o.scored.offer.macroCategory ?? "altro";
        if (seen.has(c)) continue;
        seen.add(c);
        bump(categories, c);
      }
    }

    if (matchOne(g, f, "certs")) {
      const seen = new Set<string>();
      for (const o of g.offers) {
        for (const c of o.scored.offer.certifications ?? []) {
          if (seen.has(c)) continue;
          seen.add(c);
          bump(certs, c);
        }
      }
    }

    const best = g.offers[0];
    if (best) {
      if (best.price < pMin) pMin = best.price;
      if (best.price > pMax) pMax = best.price;
    }
  }

  const toSortedCounts = (m: Map<string, number>): FacetOption[] =>
    Array.from(m, ([value, count]) => ({ value, count })).sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value, "it"),
    );

  return {
    units: toSortedCounts(units),
    suppliers: Array.from(suppliers, ([value, count]) => ({
      value,
      count,
      label: supplierNames.get(value) ?? value,
    })).sort((a, b) => b.count - a.count),
    categories: toSortedCounts(categories),
    certs: toSortedCounts(certs),
    priceBounds: [Number.isFinite(pMin) ? pMin : 0, pMax || 0],
  };
}

export function mergeSearchAndFacets(
  groups: Group[],
  rankedIds: string[],
  facets: FacetState,
): Group[] {
  const idOrder = new Map(rankedIds.map((id, i) => [id, i]));
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const matched: Group[] = [];
  for (const id of rankedIds) {
    const g = byKey.get(id);
    if (g) matched.push(g);
  }
  void idOrder;
  return applyFacets(matched, facets);
}

// Helper for RankedOffer type consumers (avoids unused-import warnings).
export type { Group, RankedOffer };
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS. If `ScoredOffer.offer.macroCategory` / `certifications` / `isBio` typings fail, inspect `lib/scoring/types.ts` and adjust access paths — they exist in the current `Offer` type used by `search-client.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_lib/facets.ts
git commit -m "feat(cerca): add facet filter + live counts logic"
```

---

## Task 5: `_lib/url-state.ts` — URL params ⇄ state

**Files:**
- Create: `app/(app)/cerca/_lib/url-state.ts`

- [ ] **Step 1: Create file**

```ts
// app/(app)/cerca/_lib/url-state.ts
import type { FacetState } from "./facets";

export type Tab = "ricerca" | "ordine";

export type UrlState = {
  tab: Tab;
  query: string;
  facets: FacetState;
  selectedKey: string | null;
};

const parseSet = (s: string | null): Set<string> => {
  if (!s) return new Set();
  return new Set(s.split(",").map((v) => decodeURIComponent(v)).filter(Boolean));
};

const encodeSet = (s: Set<string>): string =>
  Array.from(s).map(encodeURIComponent).join(",");

export function readUrlState(sp: URLSearchParams): UrlState {
  const tabRaw = sp.get("tab");
  const tab: Tab = tabRaw === "ordine" ? "ordine" : "ricerca";

  const minN = Number(sp.get("min"));
  const maxN = Number(sp.get("max"));
  const priceRange: [number, number] | null =
    Number.isFinite(minN) && Number.isFinite(maxN) && maxN > 0
      ? [minN, maxN]
      : null;

  const scoreN = Number(sp.get("score"));
  const minScore = Number.isFinite(scoreN) ? Math.max(0, Math.min(100, scoreN)) : 0;

  return {
    tab,
    query: sp.get("q") ?? "",
    selectedKey: sp.get("sel"),
    facets: {
      units: parseSet(sp.get("units")),
      supplierIds: parseSet(sp.get("suppliers")),
      categories: parseSet(sp.get("cats")),
      priceRange,
      minScore,
      bioOnly: sp.get("bio") === "1",
      certs: parseSet(sp.get("certs")),
    },
  };
}

export function writeUrlState(state: UrlState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.tab !== "ricerca") sp.set("tab", state.tab);
  if (state.query) sp.set("q", state.query);
  if (state.facets.units.size) sp.set("units", encodeSet(state.facets.units));
  if (state.facets.supplierIds.size) sp.set("suppliers", encodeSet(state.facets.supplierIds));
  if (state.facets.categories.size) sp.set("cats", encodeSet(state.facets.categories));
  if (state.facets.priceRange) {
    sp.set("min", String(state.facets.priceRange[0]));
    sp.set("max", String(state.facets.priceRange[1]));
  }
  if (state.facets.minScore > 0) sp.set("score", String(state.facets.minScore));
  if (state.facets.bioOnly) sp.set("bio", "1");
  if (state.facets.certs.size) sp.set("certs", encodeSet(state.facets.certs));
  if (state.selectedKey) sp.set("sel", state.selectedKey);
  return sp;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_lib/url-state.ts
git commit -m "feat(cerca): add URL state serializer"
```

---

## Task 6: `lib/search/highlight.tsx` — match highlighter

**Files:**
- Create: `lib/search/highlight.tsx`

- [ ] **Step 1: Create file**

```tsx
// lib/search/highlight.tsx
import type { ReactNode } from "react";
import { normalizeName } from "@/lib/catalogs/normalize";

/**
 * Highlight every token from `query` inside `text` with <mark>.
 * Matching is accent-insensitive + case-insensitive by normalizing both sides.
 */
export function highlight(text: string, query: string): ReactNode {
  const q = normalizeName(query);
  if (!q) return text;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  const normText = normalizeName(text);
  // Map normalized positions back to raw text. Because normalizeName only
  // removes diacritics and punctuation (one-char-per-char or drop), we can
  // scan raw text char-by-char and keep a parallel index into the normalized
  // string.
  const marks: Array<[number, number]> = []; // [startRaw, endRaw)

  for (const t of tokens) {
    let from = 0;
    while (from <= normText.length - t.length) {
      const idx = normText.indexOf(t, from);
      if (idx < 0) break;
      marks.push(mapNormRangeToRaw(text, idx, idx + t.length));
      from = idx + t.length;
    }
  }
  if (marks.length === 0) return text;

  marks.sort((a, b) => a[0] - b[0]);
  // Merge overlaps
  const merged: Array<[number, number]> = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([m[0], m[1]]);
  }

  const out: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e], i) => {
    if (s > cursor) out.push(text.slice(cursor, s));
    out.push(
      <mark
        key={i}
        className="rounded-sm bg-yellow-500/20 text-text-primary px-0.5"
      >
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

function mapNormRangeToRaw(
  raw: string,
  normStart: number,
  normEnd: number,
): [number, number] {
  let ni = 0;
  let rawStart = 0;
  let rawEnd = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    const normChunk = normalizeName(ch);
    if (ni === normStart) rawStart = i;
    ni += normChunk.length;
    if (ni >= normEnd) {
      rawEnd = i + 1;
      break;
    }
  }
  return [rawStart, rawEnd];
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/search/highlight.tsx
git commit -m "feat(search): add accent-insensitive highlight helper"
```

---

## Task 7: `_components/keyboard-hint.tsx` primitive

**Files:**
- Create: `app/(app)/cerca/_components/keyboard-hint.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/keyboard-hint.tsx
import { cn } from "@/lib/utils/cn";

export function KeyboardHint({
  keys,
  className,
}: {
  keys: string[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="rounded border border-border-subtle bg-surface-base px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-text-tertiary shadow-[inset_0_-1px_0_0] shadow-border-subtle"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Verify `cn` helper exists**

```bash
test -f "lib/utils/cn.ts" && echo OK || echo MISSING
```
If MISSING, inline a local `cn`:

```ts
function cn(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(" "); }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/(app)/cerca/_components/keyboard-hint.tsx
git commit -m "feat(cerca): add KeyboardHint primitive"
```

---

## Task 8: `_components/sparkline.tsx` — inline SVG offer sparkbar

**Files:**
- Create: `app/(app)/cerca/_components/sparkline.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/sparkline.tsx
import type { RankedOffer } from "../_lib/types";

/**
 * Micro bar chart: one bar per offer, height inversely proportional to
 * price (cheapest = tallest), color derived from score.
 * 48×16 fixed box, renders inline SVG — zero runtime deps.
 */
export function Sparkline({ offers, max = 8 }: { offers: RankedOffer[]; max?: number }) {
  const slice = offers.slice(0, max);
  if (slice.length === 0) return null;

  const prices = slice.map((o) => o.price);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const range = Math.max(pMax - pMin, 0.0001);
  const w = 48;
  const h = 16;
  const barW = Math.max(2, Math.floor(w / slice.length) - 1);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      aria-hidden
    >
      {slice.map((o, i) => {
        const norm = 1 - (o.price - pMin) / range; // cheaper = taller
        const barH = Math.max(2, Math.round(norm * (h - 2)));
        const y = h - barH;
        const x = i * (barW + 1);
        const fill =
          o.scored.score >= 80
            ? "var(--color-accent-green, #10b981)"
            : o.scored.score >= 50
            ? "#eab308"
            : o.scored.score >= 20
            ? "#f97316"
            : "#dc2626";
        return <rect key={i} x={x} y={y} width={barW} height={barH} fill={fill} rx={0.5} />;
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/sparkline.tsx
git commit -m "feat(cerca): add Sparkline offer-price micro-chart"
```

---

## Task 9: `_components/facet-group.tsx` — collapsible facet group

**Files:**
- Create: `app/(app)/cerca/_components/facet-group.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/facet-group.tsx
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function FacetGroup({
  label,
  children,
  defaultOpen = true,
  activeCount = 0,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  activeCount?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          {label}
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-accent-green/15 px-1 font-mono text-[9px] text-accent-green">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-tertiary transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </section>
  );
}

export function FacetCheckboxRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1 text-[13px] hover:bg-surface-hover">
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-accent-green)]"
        />
        <span className={`truncate ${checked ? "text-text-primary" : "text-text-secondary"}`}>
          {label}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-tertiary">
        {count}
      </span>
    </label>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/facet-group.tsx
git commit -m "feat(cerca): add FacetGroup + FacetCheckboxRow"
```

---

## Task 10: `_components/facet-range.tsx` — dual-handle price + score slider

**Files:**
- Create: `app/(app)/cerca/_components/facet-range.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/facet-range.tsx
"use client";

import { useId } from "react";

/** Dual-handle range slider built from two native inputs stacked (no libs). */
export function PriceRange({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number] | null;
  onChange: (next: [number, number] | null) => void;
}) {
  const id = useId();
  const lo = value?.[0] ?? min;
  const hi = value?.[1] ?? max;

  const span = Math.max(max - min, 0.01);
  const leftPct = ((lo - min) / span) * 100;
  const rightPct = ((hi - min) / span) * 100;

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-text-secondary">
        <span>€ {lo.toFixed(2)}</span>
        <span>€ {hi.toFixed(2)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-surface-hover">
        <div
          className="absolute top-0 h-full rounded-full bg-accent-green/50"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          id={`${id}-lo`}
          type="range"
          min={min}
          max={max}
          step={0.05}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi);
            onChange([v, hi]);
          }}
          className="absolute inset-0 h-full w-full appearance-none bg-transparent"
        />
        <input
          id={`${id}-hi`}
          type="range"
          min={min}
          max={max}
          step={0.05}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo);
            onChange([lo, v]);
          }}
          className="absolute inset-0 h-full w-full appearance-none bg-transparent"
        />
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="mt-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary"
        >
          reset
        </button>
      )}
    </div>
  );
}

export function ScoreSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-text-secondary">
        <span>score ≥ {value}</span>
        {value > 0 && (
          <button
            onClick={() => onChange(0)}
            className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary"
          >
            reset
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full appearance-none rounded-full bg-surface-hover accent-[var(--color-accent-green)]"
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/facet-range.tsx
git commit -m "feat(cerca): add PriceRange + ScoreSlider facet controls"
```

---

## Task 11: `_components/facet-panel.tsx` — assembled sidebar

**Files:**
- Create: `app/(app)/cerca/_components/facet-panel.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/facet-panel.tsx
"use client";

import { X } from "lucide-react";
import { FacetGroup, FacetCheckboxRow } from "./facet-group";
import { PriceRange, ScoreSlider } from "./facet-range";
import type { FacetState, FacetCounts } from "../_lib/facets";
import { hasActiveFacets, emptyFacets } from "../_lib/facets";

const CATEGORY_LABELS: Record<string, string> = {
  carne: "Carne",
  pesce: "Pesce",
  latticini: "Latticini",
  ortofrutta: "Ortofrutta",
  farine_cereali: "Farine e cereali",
  bevande: "Bevande",
  secco: "Secco",
  surgelati: "Surgelati",
  altro: "Altro",
};

export function FacetPanel({
  facets,
  counts,
  onChange,
}: {
  facets: FacetState;
  counts: FacetCounts;
  onChange: (next: FacetState) => void;
}) {
  const toggleSet = (key: keyof FacetState & ("units" | "supplierIds" | "categories" | "certs"), v: string) => {
    const next = new Set(facets[key] as Set<string>);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange({ ...facets, [key]: next });
  };

  const active = hasActiveFacets(facets);

  return (
    <aside className="flex h-full flex-col border-r border-border-subtle bg-surface-card">
      <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          Filtri
        </h2>
        {active && (
          <button
            onClick={() => onChange(emptyFacets())}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary"
          >
            <X className="h-3 w-3" /> clear all
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FacetGroup label="Unità" activeCount={facets.units.size}>
          {counts.units.length === 0 && (
            <p className="px-3 py-1 text-[12px] text-text-tertiary">—</p>
          )}
          {counts.units.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={o.value}
              count={o.count}
              checked={facets.units.has(o.value)}
              onToggle={() => toggleSet("units", o.value)}
            />
          ))}
        </FacetGroup>

        <FacetGroup label="Fornitori" activeCount={facets.supplierIds.size}>
          {counts.suppliers.length === 0 && (
            <p className="px-3 py-1 text-[12px] text-text-tertiary">—</p>
          )}
          {counts.suppliers.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={o.label ?? o.value}
              count={o.count}
              checked={facets.supplierIds.has(o.value)}
              onToggle={() => toggleSet("supplierIds", o.value)}
            />
          ))}
        </FacetGroup>

        <FacetGroup label="Categoria" activeCount={facets.categories.size}>
          {counts.categories.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={CATEGORY_LABELS[o.value] ?? o.value}
              count={o.count}
              checked={facets.categories.has(o.value)}
              onToggle={() => toggleSet("categories", o.value)}
            />
          ))}
        </FacetGroup>

        <FacetGroup label="Prezzo" activeCount={facets.priceRange ? 1 : 0}>
          <PriceRange
            min={counts.priceBounds[0]}
            max={counts.priceBounds[1]}
            value={facets.priceRange}
            onChange={(next) => onChange({ ...facets, priceRange: next })}
          />
        </FacetGroup>

        <FacetGroup label="Score minimo" activeCount={facets.minScore > 0 ? 1 : 0}>
          <ScoreSlider
            value={facets.minScore}
            onChange={(n) => onChange({ ...facets, minScore: n })}
          />
        </FacetGroup>

        <FacetGroup label="Etichette" activeCount={(facets.bioOnly ? 1 : 0) + facets.certs.size}>
          <FacetCheckboxRow
            label="Solo Bio"
            count={0}
            checked={facets.bioOnly}
            onToggle={() => onChange({ ...facets, bioOnly: !facets.bioOnly })}
          />
          {counts.certs.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={o.value}
              count={o.count}
              checked={facets.certs.has(o.value)}
              onToggle={() => toggleSet("certs", o.value)}
            />
          ))}
        </FacetGroup>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/facet-panel.tsx
git commit -m "feat(cerca): assemble FacetPanel sidebar"
```

---

## Task 12: `_components/search-bar.tsx` — hero input + count

**Files:**
- Create: `app/(app)/cerca/_components/search-bar.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/search-bar.tsx
"use client";

import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { KeyboardHint } from "./keyboard-hint";

type Props = {
  value: string;
  onChange: (v: string) => void;
  count: number;
  total: number;
  isDeferring: boolean;
};

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, count, total, isDeferring },
  ref,
) {
  return (
    <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface-base/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            ref={ref}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Cerca tra i tuoi prodotti…"
            className="w-full rounded-lg border border-border-subtle bg-surface-card py-2.5 pl-9 pr-20 text-[14px] text-text-primary placeholder:text-text-tertiary focus-ring"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={value.length > 0}
            aria-autocomplete="list"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {value && (
              <button
                onClick={() => onChange("")}
                className="text-text-tertiary hover:text-text-primary"
                aria-label="Pulisci ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {!value && <KeyboardHint keys={["⌘", "K"]} />}
          </div>
        </div>
        <div
          className="shrink-0 font-mono text-[11px] tabular-nums text-text-tertiary"
          aria-live="polite"
        >
          <span className={isDeferring ? "opacity-50 transition-opacity" : "transition-opacity"}>
            {count}
          </span>
          <span className="mx-1">/</span>
          <span>{total}</span>
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/search-bar.tsx
git commit -m "feat(cerca): add sticky SearchBar with live count"
```

---

## Task 13: `_components/result-row.tsx` — 56px dense row

**Files:**
- Create: `app/(app)/cerca/_components/result-row.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/result-row.tsx
"use client";

import { ChevronRight } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import { highlight } from "@/lib/search/highlight";
import { Sparkline } from "./sparkline";
import type { Group } from "../_lib/types";

export function ResultRow({
  group,
  query,
  selected,
  onSelect,
  index,
}: {
  group: Group;
  query: string;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const best = group.offers[0];
  const score = best?.scored.score ?? 0;
  const priceCls = scoreColorClass(score);

  return (
    <button
      type="button"
      onClick={onSelect}
      id={`result-row-${index}`}
      data-selected={selected ? "true" : undefined}
      className={`flex h-14 w-full items-center gap-3 border-l-2 px-4 text-left transition-colors duration-75 ${
        selected
          ? "border-accent-green bg-accent-green/[0.06]"
          : "border-transparent hover:bg-surface-hover"
      }`}
      aria-selected={selected}
      role="option"
    >
      <span
        className={`block h-6 w-0.5 shrink-0 rounded-sm ${priceCls.replace("text-", "bg-")}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">
        {highlight(group.productName, query)}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-text-tertiary">
        / {group.unit}
      </span>
      <span className={`shrink-0 font-mono text-[14px] font-medium tabular-nums ${priceCls}`}>
        {best ? `€ ${best.price.toFixed(2)}` : "—"}
      </span>
      <Sparkline offers={group.offers} />
      <span className="w-6 shrink-0 text-right font-mono text-[11px] text-text-tertiary">
        {group.offers.length}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/result-row.tsx
git commit -m "feat(cerca): add dense ResultRow (56px) with sparkline"
```

---

## Task 14: `_components/results-list.tsx` — virtual list + sort

**Files:**
- Create: `app/(app)/cerca/_components/results-list.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/results-list.tsx
"use client";

import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ResultRow } from "./result-row";
import type { Group } from "../_lib/types";

export type SortMode = "relevance" | "price" | "name";

export function ResultsList({
  groups,
  query,
  selectedKey,
  onSelect,
  sort,
  onSortChange,
  isSearching,
}: {
  groups: Group[];
  query: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
  isSearching: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    if (sort === "relevance") return groups;
    if (sort === "price") {
      return [...groups].sort(
        (a, b) => (a.offers[0]?.price ?? Infinity) - (b.offers[0]?.price ?? Infinity),
      );
    }
    return [...groups].sort((a, b) => a.productName.localeCompare(b.productName, "it"));
  }, [groups, sort]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
    getItemKey: (i) => sorted[i]?.key ?? i,
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="space-y-2 font-mono text-[12px] text-text-tertiary">
          <p className="uppercase tracking-[0.1em]">no matches</p>
          {query && (
            <p>
              per &quot;<span className="text-text-secondary">{query}</span>&quot;
            </p>
          )}
          <p className="text-[11px]">try: clear filters · broader query</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span>{sorted.length} prodotti</span>
        <div className="flex items-center gap-2">
          <span>sort</span>
          {(["relevance", "price", "name"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onSortChange(m)}
              className={`rounded px-1.5 py-0.5 ${
                sort === m
                  ? "bg-accent-green/10 text-accent-green"
                  : "hover:text-text-primary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={parentRef}
        className={`min-h-0 flex-1 overflow-y-auto transition-opacity duration-150 ${
          isSearching ? "opacity-60" : "opacity-100"
        }`}
        role="listbox"
        aria-label="Risultati ricerca prodotti"
      >
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((v) => {
            const g = sorted[v.index]!;
            return (
              <div
                key={v.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${v.start}px)`,
                }}
              >
                <ResultRow
                  group={g}
                  query={query}
                  selected={g.key === selectedKey}
                  onSelect={() => onSelect(g.key)}
                  index={v.index}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/results-list.tsx
git commit -m "feat(cerca): add virtualized ResultsList with sort"
```

---

## Task 15: `_components/score-breakdown-inline.tsx` — bar breakdown

**Files:**
- Create: `app/(app)/cerca/_components/score-breakdown-inline.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/score-breakdown-inline.tsx
import type { ScoreBreakdown } from "@/lib/scoring";

export function ScoreBreakdownInline({ breakdown }: { breakdown: ScoreBreakdown }) {
  const rows: Array<{ label: string; value: number; weight: number }> = [
    { label: "Prezzo", value: breakdown.price, weight: Math.round(breakdown.weights.price * 100) },
    { label: "Qualità", value: breakdown.quality, weight: Math.round(breakdown.weights.quality * 100) },
    { label: "Consegna", value: breakdown.delivery, weight: Math.round(breakdown.weights.delivery * 100) },
  ];
  const total = breakdown.weights.price * breakdown.price
    + breakdown.weights.quality * breakdown.quality
    + breakdown.weights.delivery * breakdown.delivery
    + breakdown.bioBonus + breakdown.km0Bonus;

  return (
    <div className="space-y-2 px-4 py-4 border-t border-border-subtle">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Breakdown
      </h4>
      <ul className="space-y-1.5 text-[12px]">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[80px_1fr_40px] items-center gap-2">
            <span className="text-text-secondary">
              {r.label} <span className="text-[10px] text-text-tertiary">({r.weight}%)</span>
            </span>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-surface-hover">
              <span
                className="absolute inset-y-0 left-0 bg-accent-green/70 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, r.value))}%` }}
              />
            </span>
            <span className="text-right font-mono tabular-nums text-text-primary">
              {Math.round(r.value)}
            </span>
          </li>
        ))}
        {breakdown.bioBonus > 0 && (
          <li className="grid grid-cols-[80px_1fr_40px] gap-2 text-accent-green">
            <span>+ Bio</span>
            <span />
            <span className="text-right font-mono tabular-nums">+{breakdown.bioBonus}</span>
          </li>
        )}
        {breakdown.km0Bonus > 0 && (
          <li className="grid grid-cols-[80px_1fr_40px] gap-2 text-accent-green">
            <span>+ km0</span>
            <span />
            <span className="text-right font-mono tabular-nums">+{breakdown.km0Bonus}</span>
          </li>
        )}
      </ul>
      <div className="flex items-baseline justify-between border-t border-border-subtle pt-2 font-mono text-[12px]">
        <span className="uppercase tracking-wide text-text-tertiary">totale</span>
        <span className="tabular-nums text-text-primary text-[14px] font-semibold">
          {Math.round(total)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/score-breakdown-inline.tsx
git commit -m "feat(cerca): add inline score breakdown"
```

---

## Task 16: `_components/best-offer-card.tsx` + `_components/offer-list.tsx`

**Files:**
- Create: `app/(app)/cerca/_components/best-offer-card.tsx`
- Create: `app/(app)/cerca/_components/offer-list.tsx`

- [ ] **Step 1: BestOfferCard**

```tsx
// app/(app)/cerca/_components/best-offer-card.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import type { Group } from "../_lib/types";

export function BestOfferCard({
  group,
  onAddToTypical,
}: {
  group: Group;
  onAddToTypical: () => void;
}) {
  const best = group.offers[0];
  if (!best) return null;
  const scoreCls = scoreColorClass(best.scored.score);

  return (
    <section className="space-y-2 border-b border-border-subtle px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Best offer
      </p>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-mono text-[28px] font-semibold tabular-nums ${scoreCls}`}>
          € {best.price.toFixed(2)}
        </span>
        <span className={`font-mono text-[12px] tabular-nums ${scoreCls}`}>
          score {best.scored.score}
        </span>
      </div>
      <p className="text-[13px] text-text-secondary">
        da{" "}
        <Link
          href={`/cataloghi/${best.supplier.id}`}
          className="font-medium text-text-primary hover:underline"
        >
          {best.supplier.supplier_name}
        </Link>
      </p>
      <p className="font-mono text-[11px] text-text-tertiary">
        lead {best.supplier.delivery_days ?? 2}g
        {best.supplier.min_order_amount
          ? ` · min € ${best.supplier.min_order_amount.toFixed(0)}`
          : ""}
      </p>
      <button
        onClick={onAddToTypical}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-green px-3 py-2 text-[13px] font-medium text-surface-base hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Aggiungi a ordine tipico
      </button>
    </section>
  );
}
```

- [ ] **Step 2: OfferList**

```tsx
// app/(app)/cerca/_components/offer-list.tsx
"use client";

import Link from "next/link";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import type { Group, RankedOffer } from "../_lib/types";

export function OfferList({
  group,
  selectedOfferId,
  onSelectOffer,
}: {
  group: Group;
  selectedOfferId: string | null;
  onSelectOffer: (offer: RankedOffer) => void;
}) {
  const prices = group.offers.map((o) => o.price);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const span = Math.max(pMax - pMin, 0.0001);

  return (
    <section className="space-y-1.5 px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Tutte le offerte
      </p>
      <ul className="space-y-0.5">
        {group.offers.map((o) => {
          const pct = 1 - (o.price - pMin) / span;
          const sel = o.itemId === selectedOfferId;
          const cls = scoreColorClass(o.scored.score);
          return (
            <li key={o.itemId}>
              <button
                onClick={() => onSelectOffer(o)}
                className={`relative grid w-full grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-left text-[12px] ${
                  sel ? "bg-accent-green/10" : "hover:bg-surface-hover"
                }`}
              >
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 bg-accent-green/5 transition-[width] duration-300"
                  style={{ width: `${Math.max(4, Math.round(pct * 100))}%` }}
                  aria-hidden
                />
                <Link
                  href={`/cataloghi/${o.supplier.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="relative truncate text-text-primary hover:underline"
                >
                  {o.supplier.supplier_name}
                </Link>
                <span className={`relative font-mono tabular-nums ${cls}`}>
                  € {o.price.toFixed(2)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/(app)/cerca/_components/best-offer-card.tsx app/(app)/cerca/_components/offer-list.tsx
git commit -m "feat(cerca): add BestOfferCard + OfferList for detail pane"
```

---

## Task 17: `_components/detail-pane.tsx` — assembled detail

**Files:**
- Create: `app/(app)/cerca/_components/detail-pane.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/detail-pane.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BestOfferCard } from "./best-offer-card";
import { OfferList } from "./offer-list";
import { ScoreBreakdownInline } from "./score-breakdown-inline";
import type { Group, OrderLine, RankedOffer } from "../_lib/types";

export function DetailPane({
  group,
  onClose,
  onAddToTypical,
}: {
  group: Group | null;
  onClose: () => void;
  onAddToTypical: (line: OrderLine) => void;
}) {
  const [selectedOffer, setSelectedOffer] = useState<RankedOffer | null>(null);

  useEffect(() => {
    setSelectedOffer(group?.offers[0] ?? null);
  }, [group?.key]);

  if (!group) {
    return (
      <aside
        className="hidden h-full border-l border-border-subtle bg-surface-card lg:block"
        role="region"
        aria-label="Dettagli prodotto"
      >
        <div className="flex h-full items-center justify-center p-10 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          ← seleziona un prodotto dalla lista
        </div>
      </aside>
    );
  }

  const add = () => {
    onAddToTypical({
      key: group.key,
      productName: group.productName,
      unit: group.unit,
      qty: 1,
    });
  };

  return (
    <aside
      className="flex h-full flex-col border-l border-border-subtle bg-surface-card"
      role="region"
      aria-label={`Dettagli ${group.productName}`}
    >
      <header className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border-subtle">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[18px] font-semibold text-text-primary">
            {group.productName}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-text-tertiary">
            {group.unit} · {group.offers.length} offerte · media € {group.averagePrice.toFixed(2)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
          aria-label="Chiudi dettagli"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <BestOfferCard group={group} onAddToTypical={add} />
        <OfferList
          group={group}
          selectedOfferId={selectedOffer?.itemId ?? null}
          onSelectOffer={setSelectedOffer}
        />
        {selectedOffer && <ScoreBreakdownInline breakdown={selectedOffer.scored.breakdown} />}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/detail-pane.tsx
git commit -m "feat(cerca): assemble DetailPane"
```

---

## Task 18: `_lib/use-keyboard.ts` — global shortcut hook

**Files:**
- Create: `app/(app)/cerca/_lib/use-keyboard.ts`

- [ ] **Step 1: Create file**

```ts
// app/(app)/cerca/_lib/use-keyboard.ts
"use client";

import { useEffect } from "react";

export type KeyHandlers = {
  onFocusSearch?: () => void;
  onArrow?: (dir: 1 | -1) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onAdd?: () => void;
  onToggleFacets?: () => void;
  onShowHelp?: () => void;
};

export function useSearchKeyboard(h: KeyHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // ⌘K / Ctrl+K → focus search (always)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        h.onFocusSearch?.();
        return;
      }

      // `/` → focus search (only when not typing)
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        h.onFocusSearch?.();
        return;
      }

      // Arrow keys — navigate results when not typing inside text input (except search)
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const isSearch = target instanceof HTMLInputElement && target.type === "search";
        if (!isTyping || isSearch) {
          e.preventDefault();
          h.onArrow?.(e.key === "ArrowDown" ? 1 : -1);
        }
        return;
      }

      if (e.key === "Enter") {
        const isSearch = target instanceof HTMLInputElement && target.type === "search";
        if (isSearch || !isTyping) {
          h.onEnter?.();
        }
        return;
      }

      if (e.key === "Escape") {
        h.onEscape?.();
        return;
      }

      if (!isTyping) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          h.onAdd?.();
          return;
        }
        if (e.key.toLowerCase() === "f") {
          h.onToggleFacets?.();
          return;
        }
        if (e.key === "?") {
          h.onShowHelp?.();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, h.onFocusSearch, h.onArrow, h.onEnter, h.onEscape, h.onAdd, h.onToggleFacets, h.onShowHelp]);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_lib/use-keyboard.ts
git commit -m "feat(cerca): add useSearchKeyboard hook"
```

---

## Task 19: `_components/cheatsheet-overlay.tsx`

**Files:**
- Create: `app/(app)/cerca/_components/cheatsheet-overlay.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/cheatsheet-overlay.tsx
"use client";

import { X } from "lucide-react";
import { KeyboardHint } from "./keyboard-hint";

const ROWS: Array<{ keys: string[]; label: string }> = [
  { keys: ["⌘", "K"], label: "Focus ricerca" },
  { keys: ["/"], label: "Focus ricerca" },
  { keys: ["↓"], label: "Prossimo risultato" },
  { keys: ["↑"], label: "Precedente risultato" },
  { keys: ["Enter"], label: "Apri dettagli" },
  { keys: ["Esc"], label: "Chiudi dettagli / pulisci" },
  { keys: ["⌘", "A"], label: "Aggiungi a ordine tipico" },
  { keys: ["F"], label: "Filtri (mobile)" },
  { keys: ["?"], label: "Questo aiuto" },
];

export function CheatsheetOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border-subtle bg-surface-card p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            Scorciatoie
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {ROWS.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
              <KeyboardHint keys={r.keys} />
              <span className="text-text-secondary">{r.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/cheatsheet-overlay.tsx
git commit -m "feat(cerca): add keyboard cheatsheet overlay"
```

---

## Task 20: `_components/mobile-drawer.tsx` — facet drawer for mobile

**Files:**
- Create: `app/(app)/cerca/_components/mobile-drawer.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/mobile-drawer.tsx
"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";

export function MobileDrawer({
  open,
  onClose,
  side = "left",
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} flex w-[86vw] max-w-[380px] flex-col bg-surface-card shadow-2xl`}
      >
        <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            {title}
          </h2>
          <button onClick={onClose} className="text-text-tertiary" aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/mobile-drawer.tsx
git commit -m "feat(cerca): add MobileDrawer primitive"
```

---

## Task 21: Extract import wizard

**Files:**
- Create: `app/(app)/cerca/_components/import-wizard.tsx`

Copy the entire `TypicalOrderImportWizard` component (lines 641–954) from the existing `app/(app)/cerca/search-client.tsx` into `import-wizard.tsx` as an exported named component. Keep all internal logic. Only change:
1. Rename export to `ImportWizard`
2. Update imports to use `../_lib/types` (`OrderLine`, `Group`)
3. Apply terminal skin: section labels become `font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary`, step indicator becomes `1 / 3 UPLOAD` etc.

- [ ] **Step 1: Create component**

Full content (adapted skin shown where changed — rest identical to current `TypicalOrderImportWizard`):

```tsx
// app/(app)/cerca/_components/import-wizard.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Download, Upload, UploadCloud } from "lucide-react";
import { parseCsv, parseXlsx, suggestMapping, type ParsedSheet } from "@/lib/catalogs/parse-file";
import { normalizeName, normalizeUnit } from "@/lib/catalogs/normalize";
import type { Group, OrderLine } from "../_lib/types";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

type WizardStep = "upload" | "map" | "preview";
type Mapping = { name: string; unit: string; qty: string };
type ValidatedRow =
  | { ok: true; matchType: "exact" | "name" | "none"; matchedKey: string | null; productName: string; unit: string; qty: number; rawName: string; rawUnit: string }
  | { ok: false; reason: string; raw: { name: string; unit: string; qty: string } };

export function ImportWizard({
  open,
  onClose,
  groups,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  onImported: (lines: OrderLine[], mode: "append" | "replace") => void;
}) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [hasHeader, setHasHeader] = useState(true);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ name: "", unit: "", qty: "" });
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("upload");
    setSheet(null);
    setMapping({ name: "", unit: "", qty: "" });
    setError(null);
  };
  const closeAll = () => { reset(); onClose(); };

  const groupByNormKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(`${normalizeName(g.productName)}::${normalizeUnit(g.unit)}`, g);
    return m;
  }, [groups]);

  const groupsByName = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) {
      const nk = normalizeName(g.productName);
      if (!m.has(nk)) m.set(nk, g);
    }
    return m;
  }, [groups]);

  const validated: ValidatedRow[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((r) => {
      const name = (r[mapping.name] ?? "").trim();
      const unit = (r[mapping.unit] ?? "").trim();
      const qtyRaw = (r[mapping.qty] ?? "").trim();

      if (!name) return { ok: false, reason: "Nome vuoto", raw: { name, unit, qty: qtyRaw } };
      const qtyNum = Number(qtyRaw.replace(",", "."));
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return { ok: false, reason: "Quantità non valida", raw: { name, unit, qty: qtyRaw } };
      }

      const nameNorm = normalizeName(name);
      const unitNorm = unit ? normalizeUnit(unit) : "";

      let matched: Group | undefined;
      let matchType: "exact" | "name" | "none" = "none";
      if (unit) {
        matched = groupByNormKey.get(`${nameNorm}::${unitNorm}`);
        if (matched) matchType = "exact";
      }
      if (!matched) {
        matched = groupsByName.get(nameNorm);
        if (matched) matchType = "name";
      }

      return {
        ok: true,
        matchType,
        matchedKey: matched ? matched.key : null,
        productName: matched?.productName ?? name,
        unit:        matched?.unit ?? (unit || "—"),
        qty:         qtyNum,
        rawName:     name,
        rawUnit:     unit,
      };
    });
  }, [sheet, mapping, groupByNormKey, groupsByName]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) { setError("File troppo grande (max 2MB)"); return; }
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let parsed: ParsedSheet;
      if (ext === "csv") parsed = await parseCsv(file, hasHeader);
      else if (ext === "xlsx" || ext === "xls") parsed = await parseXlsx(file, hasHeader);
      else { setError("Formato non supportato"); return; }

      if (parsed.rows.length === 0) { setError("Nessuna riga di dati nel file"); return; }
      if (parsed.rows.length > MAX_ROWS) { setError(`Troppe righe (max ${MAX_ROWS})`); return; }

      setSheet(parsed);
      const suggested = suggestMapping(parsed.headers);
      const qtyHeader = parsed.headers.find((h) => /quant|q.tà|qta|qty/i.test(h));
      setMapping({
        name: suggested.name ?? parsed.headers[0] ?? "",
        unit: suggested.unit ?? parsed.headers[1] ?? "",
        qty:  qtyHeader ?? parsed.headers[2] ?? "",
      });
      setStep("map");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore lettura file");
    }
  };

  const validRows = validated.filter((v): v is Extract<ValidatedRow, { ok: true }> => v.ok);
  const invalidCount = validated.length - validRows.length;
  const exactCount = validRows.filter((v) => v.matchType === "exact").length;
  const fuzzyCount = validRows.filter((v) => v.matchType === "name").length;
  const unmatchedCount = validRows.filter((v) => v.matchType === "none").length;

  const confirmImport = () => {
    if (validRows.length === 0) return;
    const lines: OrderLine[] = validRows.map((v) => ({
      key: v.matchedKey ?? `${normalizeName(v.productName)}::${normalizeUnit(v.unit)}`,
      productName: v.productName,
      unit: v.unit,
      qty: v.qty,
    }));
    onImported(lines, mode);
    closeAll();
  };

  const stepLabel =
    step === "upload" ? "1 / 3 UPLOAD" : step === "map" ? "2 / 3 MAP" : "3 / 3 PREVIEW";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeAll}>
      <div
        className="w-full max-w-3xl space-y-5 overflow-y-auto rounded-xl border border-border-subtle bg-surface-card p-6 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-text-primary">
            Importa ordine tipico
          </h2>
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            {stepLabel}
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              Il file ha un&apos;intestazione sulla prima riga
            </label>
            <label className="block rounded-xl border-2 border-dashed border-border-subtle p-12 text-center cursor-pointer hover:border-accent-green/40">
              <UploadCloud className="mx-auto h-8 w-8 text-text-tertiary" />
              <p className="mt-3 text-text-primary">Clicca per scegliere un file</p>
              <p className="mt-1 text-xs text-text-tertiary">CSV, XLS, XLSX · max 2MB · max 5000 righe</p>
              <p className="mt-1 text-xs text-text-tertiary">Colonne attese: nome, quantità (unità opzionale)</p>
              <input
                type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
            <a
              href="data:text/csv;charset=utf-8,nome;quantita%0AFarina%2000;10%0AOlio%20EVO;5%0APomodoro%20pelato;8%0AAceto%20Balsamico%20di%20Modena%20IGP;2"
              download="template-ordine-tipico.csv"
              className="inline-flex items-center gap-1 text-sm text-accent-green hover:underline"
            >
              <Download className="h-4 w-4" /> Scarica template CSV
            </a>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["name", "unit", "qty"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="text-sm text-text-secondary">
                    {field === "name" ? "Nome prodotto *" : field === "unit" ? "Unità (opzionale)" : "Quantità *"}
                  </span>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary"
                  >
                    <option value="">—</option>
                    {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-text-tertiary">
                  <tr>{sheet.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      {sheet.headers.map((h) => <td key={h} className="px-2 py-1 text-text-secondary">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep("upload")} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={() => setStep("preview")}
                disabled={!mapping.name || !mapping.qty}
                className="rounded-lg bg-accent-green px-4 py-2 font-medium text-surface-base disabled:opacity-50"
              >
                Continua
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-accent-green">
                <Check className="h-4 w-4" /> {exactCount} match esatti
              </span>
              {fuzzyCount > 0 && (
                <span className="text-accent-green">{fuzzyCount} match per nome</span>
              )}
              {unmatchedCount > 0 && (
                <span className="text-yellow-400">{unmatchedCount} non in catalogo</span>
              )}
              {invalidCount > 0 && <span className="text-red-400">{invalidCount} scartate</span>}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-surface-base text-text-tertiary">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Stato</th>
                    <th className="px-2 py-1 text-left font-medium">Nome</th>
                    <th className="px-2 py-1 text-left font-medium">Unità</th>
                    <th className="px-2 py-1 text-right font-medium">Q.tà</th>
                    <th className="px-2 py-1 text-left font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((v, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      {v.ok ? (
                        <>
                          <td className="px-2 py-1">
                            {v.matchType === "exact" && <span className="text-accent-green">OK</span>}
                            {v.matchType === "name" && <span className="text-accent-green">~</span>}
                            {v.matchType === "none" && <span className="text-yellow-400">?</span>}
                          </td>
                          <td className="px-2 py-1 text-text-primary">{v.productName}</td>
                          <td className="px-2 py-1 text-text-secondary">{v.unit}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-text-primary">{v.qty}</td>
                          <td className="px-2 py-1 text-xs text-text-tertiary">
                            {v.matchType === "exact" && "Match esatto nei cataloghi"}
                            {v.matchType === "name" && (
                              <>Match per nome{v.rawUnit ? <> (unità &quot;{v.rawUnit}&quot; → &quot;{v.unit}&quot;)</> : null}</>
                            )}
                            {v.matchType === "none" && "Non presente nei cataloghi"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-red-400">✗</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.name || "—"}</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.unit || "—"}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-text-tertiary">{v.raw.qty || "—"}</td>
                          <td className="px-2 py-1 text-xs text-red-400">{v.reason}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <fieldset className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> Aggiungi all&apos;ordine
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Sostituisci ordine
              </label>
            </fieldset>

            <div className="flex justify-between">
              <button onClick={() => setStep("map")} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={confirmImport}
                disabled={validRows.length === 0}
                className="rounded-lg bg-accent-green px-4 py-2 font-medium text-surface-base disabled:opacity-50"
              >
                Conferma ({validRows.length} righe)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { Upload }; // re-export for button icon in parent
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/import-wizard.tsx
git commit -m "feat(cerca): extract + reskin import wizard"
```

---

## Task 22: `_components/typical-order-add.tsx` — inline search-to-add

**Files:**
- Create: `app/(app)/cerca/_components/typical-order-add.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/typical-order-add.tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, Search } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import { searchGroups, type ProductIndex } from "../_lib/product-index";
import type { Group, OrderLine } from "../_lib/types";

const MAX_SUGGESTIONS = 8;

export function TypicalOrderAdd({
  groups,
  index,
  onAdd,
}: {
  groups: Group[];
  index: ProductIndex;
  onAdd: (line: OrderLine) => void;
}) {
  const [q, setQ] = useState("");
  const [qty, setQty] = useState("1");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions: Group[] = useMemo(() => {
    if (!q.trim()) return [];
    const ids = searchGroups(index, groups, q).slice(0, MAX_SUGGESTIONS);
    const byKey = new Map(groups.map((g) => [g.key, g]));
    return ids.map((id) => byKey.get(id)!).filter(Boolean);
  }, [q, index, groups]);

  useEffect(() => setHighlighted(0), [q]);

  const commit = (g: Group | undefined) => {
    const chosen = g ?? suggestions[highlighted];
    if (!chosen) return;
    const nQty = Number(qty.replace(",", "."));
    if (!Number.isFinite(nQty) || nQty <= 0) return;
    onAdd({ key: chosen.key, productName: chosen.productName, unit: chosen.unit, qty: nQty });
    setQ("");
    setQty("1");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 focus-within:ring-2 focus-within:ring-accent-green/40">
        <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(suggestions.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit(undefined);
            }
          }}
          placeholder="Cerca prodotto da aggiungere…"
          className="flex-1 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-tertiary"
          autoComplete="off"
        />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
          qty
        </span>
        <input
          type="number"
          min={0}
          step="0.1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(undefined);
            }
          }}
          className="w-16 rounded border border-border-subtle bg-surface-base px-2 py-1 text-right font-mono tabular-nums text-text-primary"
        />
        <button
          onClick={() => commit(undefined)}
          disabled={suggestions.length === 0}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent-green px-3 py-1.5 text-[13px] font-medium text-surface-base disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> add
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-lg">
          {suggestions.map((g, i) => {
            const best = g.offers[0];
            const cls = best ? scoreColorClass(best.scored.score) : "";
            return (
              <li key={g.key}>
                <button
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => commit(g)}
                  className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-[13px] ${
                    i === highlighted ? "bg-surface-hover" : ""
                  }`}
                >
                  <span className="flex-1 truncate text-text-primary">{g.productName}</span>
                  <span className="font-mono text-[11px] text-text-tertiary">/ {g.unit}</span>
                  {best && (
                    <span className={`font-mono tabular-nums ${cls}`}>
                      € {best.price.toFixed(2)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/typical-order-add.tsx
git commit -m "feat(cerca): add inline search-to-add for typical order"
```

---

## Task 23: `_components/typical-order-table.tsx`

**Files:**
- Create: `app/(app)/cerca/_components/typical-order-table.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/typical-order-table.tsx
"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import type { Group, OrderLine, SupplierLite } from "../_lib/types";

type Computed = {
  line: OrderLine;
  available: boolean;
  bestPrice: number | null;
  bestSupplier: SupplierLite | null;
  bestLineTotal: number;
  bestScore: number;
};

export function TypicalOrderTable({
  lines,
  groupByKey,
  onUpdateQty,
  onRemove,
}: {
  lines: OrderLine[];
  groupByKey: Map<string, Group>;
  onUpdateQty: (key: string, raw: string) => void;
  onRemove: (key: string) => void;
}) {
  const computed: Computed[] = lines.map((line) => {
    const g = groupByKey.get(line.key);
    if (!g || g.offers.length === 0) {
      return { line, available: false, bestPrice: null, bestSupplier: null, bestLineTotal: 0, bestScore: 0 };
    }
    const top = g.offers[0]!;
    return {
      line,
      available: true,
      bestPrice: top.price,
      bestSupplier: top.supplier,
      bestLineTotal: top.price * line.qty,
      bestScore: top.scored.score,
    };
  });

  const basketOptimal = computed.reduce((s, c) => s + c.bestLineTotal, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="min-w-full text-[13px]">
        <thead className="bg-surface-card font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          <tr>
            <th className="px-3 py-2 text-left font-medium w-8">#</th>
            <th className="px-3 py-2 text-left font-medium">Prodotto</th>
            <th className="px-3 py-2 text-right font-medium">Q.tà</th>
            <th className="px-3 py-2 text-left font-medium">Unità</th>
            <th className="px-3 py-2 text-right font-medium">Best</th>
            <th className="px-3 py-2 text-left font-medium">Fornitore</th>
            <th className="px-3 py-2 text-right font-medium">Totale</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {computed.map(({ line, available, bestPrice, bestSupplier, bestLineTotal, bestScore }, i) => {
            const cls = available ? scoreColorClass(bestScore) : "text-text-tertiary";
            return (
              <tr
                key={line.key}
                className="border-t border-border-subtle odd:bg-surface-base/30"
              >
                <td className="px-3 py-2 text-right font-mono text-[10px] text-text-tertiary tabular-nums">
                  {i + 1}
                </td>
                <td className="px-3 py-2 text-text-primary">{line.productName}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number" min={0} step="0.1"
                    value={line.qty}
                    onChange={(e) => onUpdateQty(line.key, e.target.value)}
                    className="w-20 rounded border border-border-subtle bg-surface-base px-2 py-1 text-right font-mono text-text-primary tabular-nums"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-text-tertiary">{line.unit}</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${cls}`}>
                  {available ? `€ ${bestPrice!.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2">
                  {available && bestSupplier ? (
                    <Link href={`/cataloghi/${bestSupplier.id}`} className="text-accent-green hover:underline">
                      {bestSupplier.supplier_name}
                    </Link>
                  ) : (
                    <span className="text-xs text-text-tertiary">non disponibile</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary tabular-nums">
                  {available ? `€ ${bestLineTotal.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onRemove(line.key)}
                    className="rounded p-1.5 text-red-400 opacity-40 hover:bg-red-500/10 hover:opacity-100"
                    title="Rimuovi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-surface-card">
          <tr className="border-t border-border-subtle">
            <td colSpan={6} className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
              split ottimale
            </td>
            <td className="px-3 py-2 text-right font-mono text-[14px] font-semibold tabular-nums text-accent-green">
              € {basketOptimal.toFixed(2)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/typical-order-table.tsx
git commit -m "feat(cerca): add TypicalOrderTable (terminal skin)"
```

---

## Task 24: `_components/typical-order-panel.tsx` — whole tab

**Files:**
- Create: `app/(app)/cerca/_components/typical-order-panel.tsx`

- [ ] **Step 1: Create file**

```tsx
// app/(app)/cerca/_components/typical-order-panel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBasket, Upload, Download } from "lucide-react";
import { TypicalOrderAdd } from "./typical-order-add";
import { TypicalOrderTable } from "./typical-order-table";
import { ImportWizard } from "./import-wizard";
import type { Group, OrderLine } from "../_lib/types";
import type { ProductIndex } from "../_lib/product-index";

const STORAGE_KEY = "gb.typical-order";

export function TypicalOrderPanel({
  groups,
  index,
  pendingAdd,
  onConsumedAdd,
}: {
  groups: Group[];
  index: ProductIndex;
  pendingAdd: OrderLine | null;           // when user adds from detail pane
  onConsumedAdd: () => void;
}) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderLine[];
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  useEffect(() => {
    if (!pendingAdd) return;
    addLine(pendingAdd);
    onConsumedAdd();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAdd]);

  const groupByKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(g.key, g);
    return m;
  }, [groups]);

  const addLine = (line: OrderLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        return prev.map((l) => (l.key === line.key ? { ...l, qty: l.qty + line.qty } : l));
      }
      return [...prev, line];
    });
  };

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const updateQty = (key: string, raw: string) => {
    const q = Number(raw.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) return;
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: q } : l)));
  };

  const onImported = (incoming: OrderLine[], mode: "append" | "replace") => {
    setLines((prev) => {
      const base = mode === "replace" ? [] : prev;
      const merged = [...base];
      for (const line of incoming) {
        const existing = merged.find((l) => l.key === line.key);
        if (existing) existing.qty += line.qty;
        else merged.push(line);
      }
      return merged;
    });
  };

  const basketOptimal = useMemo(() => {
    let s = 0;
    for (const line of lines) {
      const g = groupByKey.get(line.key);
      if (!g || g.offers.length === 0) continue;
      s += g.offers[0]!.price * line.qty;
    }
    return s;
  }, [lines, groupByKey]);

  const perSupplier = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) for (const o of g.offers) ids.add(o.supplier.id);
    return Array.from(ids)
      .map((sid) => {
        const g0 = groups.find((g) => g.offers.some((o) => o.supplier.id === sid));
        const name = g0?.offers.find((o) => o.supplier.id === sid)?.supplier.supplier_name ?? "";
        let total = 0;
        let coveredItems = 0;
        for (const line of lines) {
          const g = groupByKey.get(line.key);
          const offer = g?.offers.find((o) => o.supplier.id === sid);
          if (offer) {
            total += offer.price * line.qty;
            coveredItems += 1;
          }
        }
        return { id: sid, name, total, coveredItems };
      })
      .filter((s) => s.coveredItems > 0)
      .sort((a, b) =>
        a.coveredItems !== b.coveredItems ? b.coveredItems - a.coveredItems : a.total - b.total,
      );
  }, [groups, lines, groupByKey]);

  const exportCsv = () => {
    if (lines.length === 0) return;
    const header = "nome;unita;quantita";
    const rows = lines.map((l) => `${l.productName};${l.unit};${l.qty}`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ordine-tipico.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Ordine tipico · {lines.length} righe
          </p>
          <p className="font-mono text-[18px] tabular-nums text-text-primary">
            basket ottimale <span className="text-accent-green">€ {basketOptimal.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[13px] hover:bg-surface-hover"
          >
            <Upload className="h-3.5 w-3.5" /> importa
          </button>
          <button
            onClick={exportCsv}
            disabled={lines.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[13px] hover:bg-surface-hover disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> export
          </button>
          {lines.length > 0 && (
            <button
              onClick={() => setLines([])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[13px] text-red-400 hover:bg-red-500/10"
            >
              svuota
            </button>
          )}
        </div>
      </header>

      <TypicalOrderAdd groups={groups} index={index} onAdd={addLine} />

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        groups={groups}
        onImported={onImported}
      />

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle py-10 text-center text-[13px] text-text-tertiary">
          Nessun prodotto. Cerca qui sopra o importa un file.
        </p>
      ) : (
        <>
          <TypicalOrderTable
            lines={lines}
            groupByKey={groupByKey}
            onUpdateQty={updateQty}
            onRemove={removeLine}
          />

          {perSupplier.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Se comprassi tutto da un solo fornitore
              </h3>
              <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
                {perSupplier.map((s) => {
                  const isFull = s.coveredItems === lines.length;
                  const delta = s.total - basketOptimal;
                  return (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span className="text-text-secondary">
                        <Link href={`/cataloghi/${s.id}`} className="text-text-primary hover:underline">
                          {s.name}
                        </Link>
                        {!isFull && (
                          <span className="ml-2 font-mono text-[11px] text-text-tertiary">
                            (copre {s.coveredItems}/{lines.length})
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums text-text-primary">
                        € {s.total.toFixed(2)}
                        {isFull && delta > 0 && (
                          <span className="ml-2 text-[11px] text-text-tertiary">
                            (+€ {delta.toFixed(2)})
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Link
              href="/cerca/ordine"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-green px-4 py-2.5 text-[13px] font-medium text-surface-base"
            >
              <ShoppingBasket className="h-4 w-4" /> Carrello ottimale
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cerca/_components/typical-order-panel.tsx
git commit -m "feat(cerca): assemble TypicalOrderPanel (tab content)"
```

---

## Task 25: Rewrite `search-client.tsx` — shell + URL sync + assembly

**Files:**
- Modify (rewrite): `app/(app)/cerca/search-client.tsx`

Delete old content. Replace with the shell that wires everything together.

- [ ] **Step 1: Rewrite file**

```tsx
// app/(app)/cerca/search-client.tsx
"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookMarked, Filter, Keyboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  rankOffers,
  defaultPrefs,
  type Offer,
  type Preferences,
} from "@/lib/scoring";
import { ActiveFiltersBar } from "@/components/shared/scoring/active-filters-bar";
import { ExclusionList, type ExcludedItem } from "@/components/shared/scoring/exclusion-list";
import { toast } from "sonner";

import type { CatalogItemLite, Group, OrderLine, SupplierLite } from "./_lib/types";
import { buildIndex, searchGroups } from "./_lib/product-index";
import {
  applyFacets,
  computeFacetCounts,
  emptyFacets,
  hasActiveFacets,
} from "./_lib/facets";
import { readUrlState, writeUrlState, type Tab } from "./_lib/url-state";
import { useSearchKeyboard } from "./_lib/use-keyboard";

import { FacetPanel } from "./_components/facet-panel";
import { SearchBar } from "./_components/search-bar";
import { ResultsList, type SortMode } from "./_components/results-list";
import { DetailPane } from "./_components/detail-pane";
import { TypicalOrderPanel } from "./_components/typical-order-panel";
import { MobileDrawer } from "./_components/mobile-drawer";
import { CheatsheetOverlay } from "./_components/cheatsheet-overlay";

export type { SupplierLite, CatalogItemLite };

function buildOffer(item: CatalogItemLite, supplier: SupplierLite): Offer {
  return {
    id: item.id,
    supplierId: supplier.id,
    productName: item.product_name,
    unit: item.unit,
    price: item.price,
    qualityTier: "standard",
    isBio: false,
    leadTimeDays: supplier.delivery_days ?? 2,
    certifications: [],
    macroCategory: "altro",
    supplierMinOrder: supplier.min_order_amount ?? undefined,
  };
}

export function SearchPageClient({
  suppliers,
  items,
  preferences,
}: {
  suppliers: SupplierLite[];
  items: CatalogItemLite[];
  preferences: Preferences | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const prefs = preferences ?? defaultPrefs;

  const initial = useMemo(() => readUrlState(new URLSearchParams(sp.toString())), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [query, setQuery] = useState(initial.query);
  const [facets, setFacets] = useState(initial.facets);
  const [selectedKey, setSelectedKey] = useState<string | null>(initial.selectedKey);
  const [sort, setSort] = useState<SortMode>("relevance");
  const [facetsOpen, setFacetsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingAdd, setPendingAdd] = useState<OrderLine | null>(null);

  const deferredQuery = useDeferredValue(query);
  const isDeferring = query !== deferredQuery || isPending;

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build ranked Group[] + globalExcluded (same logic as legacy client).
  const { groups, globalExcluded } = useMemo<{
    groups: Group[];
    globalExcluded: ExcludedItem[];
  }>(() => {
    const supplierById = new Map<string, SupplierLite>();
    for (const s of suppliers) supplierById.set(s.id, s);

    type RawBucket = {
      key: string;
      productName: string;
      unit: string;
      entries: { item: CatalogItemLite; supplier: SupplierLite }[];
    };
    const buckets = new Map<string, RawBucket>();
    for (const it of items) {
      const supplier = supplierById.get(it.catalog_id);
      if (!supplier) continue;
      const key = `${it.product_name_normalized}::${it.unit}`;
      let b = buckets.get(key);
      if (!b) {
        b = { key, productName: it.product_name, unit: it.unit, entries: [] };
        buckets.set(key, b);
      }
      b.entries.push({ item: it, supplier });
    }

    const excludedAll: ExcludedItem[] = [];
    const built: Group[] = [];

    for (const b of buckets.values()) {
      const offers: Offer[] = b.entries.map(({ item, supplier }) => buildOffer(item, supplier));
      const result = rankOffers(offers, prefs);

      const byId = new Map<string, { item: CatalogItemLite; supplier: SupplierLite }>();
      for (const e of b.entries) byId.set(e.item.id, e);

      const ranked = [];
      for (const s of result.included) {
        const pair = byId.get(s.offer.id);
        if (!pair) continue;
        ranked.push({
          scored: s,
          supplier: pair.supplier,
          itemId: pair.item.id,
          price: s.offer.price,
        });
      }

      for (const e of result.excluded) {
        const pair = byId.get(e.offer.id);
        excludedAll.push({
          offer: e.offer,
          reasons: e.reasons,
          supplierName: pair?.supplier.supplier_name,
        });
      }

      if (ranked.length === 0) continue;

      built.push({
        key: b.key,
        productName: b.productName,
        unit: b.unit,
        offers: ranked,
        averagePrice: result.averagePrice,
      });
    }

    built.sort((a, b) => a.productName.localeCompare(b.productName, "it"));
    return { groups: built, globalExcluded: excludedAll };
  }, [items, suppliers, prefs]);

  const index = useMemo(() => buildIndex(groups), [groups]);

  // Search → ids → facet-filter → Group[]
  const searched = useMemo(() => {
    const ids = searchGroups(index, groups, deferredQuery);
    const byKey = new Map(groups.map((g) => [g.key, g]));
    const ordered: Group[] = [];
    for (const id of ids) {
      const g = byKey.get(id);
      if (g) ordered.push(g);
    }
    return ordered;
  }, [index, groups, deferredQuery]);

  const filtered = useMemo(() => applyFacets(searched, facets), [searched, facets]);
  const counts = useMemo(() => computeFacetCounts(searched, facets), [searched, facets]);
  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === selectedKey) ?? null,
    [groups, selectedKey],
  );

  // Selection clamping when filtered changes
  useEffect(() => {
    if (!selectedKey) return;
    if (!filtered.some((g) => g.key === selectedKey)) {
      // keep selection if it's still in unfiltered groups (user filtered it out);
      // only clear if completely gone from dataset
      if (!groups.some((g) => g.key === selectedKey)) setSelectedKey(null);
    }
  }, [filtered, groups, selectedKey]);

  // URL sync (debounced 300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = writeUrlState({ tab, query, facets, selectedKey });
      const qs = params.toString();
      router.replace(qs ? `/cerca?${qs}` : "/cerca", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [tab, query, facets, selectedKey, router]);

  // Keyboard wiring
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);
  const move = useCallback(
    (dir: 1 | -1) => {
      const list = filtered;
      if (list.length === 0) return;
      const idx = selectedKey ? list.findIndex((g) => g.key === selectedKey) : -1;
      const next = list[Math.max(0, Math.min(list.length - 1, idx + dir))];
      if (next) {
        setSelectedKey(next.key);
        document.getElementById(`result-row-${list.indexOf(next)}`)?.scrollIntoView({
          block: "nearest",
        });
      }
    },
    [filtered, selectedKey],
  );
  const enter = useCallback(() => {
    if (!selectedKey && filtered[0]) setSelectedKey(filtered[0].key);
  }, [selectedKey, filtered]);
  const escape = useCallback(() => {
    if (selectedKey) setSelectedKey(null);
    else if (query) setQuery("");
  }, [selectedKey, query]);
  const addSelected = useCallback(() => {
    if (!selectedGroup) return;
    setPendingAdd({
      key: selectedGroup.key,
      productName: selectedGroup.productName,
      unit: selectedGroup.unit,
      qty: 1,
    });
    toast.success(`"${selectedGroup.productName}" aggiunto all'ordine tipico`);
  }, [selectedGroup]);

  useSearchKeyboard(
    {
      onFocusSearch: focusSearch,
      onArrow: move,
      onEnter: enter,
      onEscape: escape,
      onAdd: addSelected,
      onToggleFacets: () => setFacetsOpen((v) => !v),
      onShowHelp: () => setHelpOpen(true),
    },
    tab === "ricerca",
  );

  const handleSetQuery = (next: string) => {
    startTransition(() => {
      setQuery(next);
    });
    // Also set synchronously so input stays responsive
    setQuery(next);
  };

  if (suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cerca prodotti"
          subtitle="Confronta prezzi tra i tuoi cataloghi fornitore."
        />
        <EmptyState
          title="Nessun catalogo ancora"
          description="Crea il primo catalogo per iniziare."
          icon={BookMarked}
          context="page"
          action={
            <Link
              href="/cataloghi"
              className="inline-flex rounded-lg bg-brand-primary px-4 py-2 font-medium text-brand-on-primary transition-colors hover:bg-brand-primary-hover"
            >
              Vai ai cataloghi
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--chrome-top,64px))] flex-col">
      {/* Header row: title + tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <PageHeader
          title="Cerca prodotti"
          subtitle={`${suppliers.length} cataloghi`}
        />
        <div className="flex items-center gap-2">
          <TabSwitch tab={tab} onChange={setTab} />
          <button
            onClick={() => setHelpOpen(true)}
            className="hidden items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:bg-surface-hover md:inline-flex"
            title="Scorciatoie"
          >
            <Keyboard className="h-3.5 w-3.5" /> ?
          </button>
        </div>
      </div>

      <ActiveFiltersBar prefs={prefs} />

      {tab === "ricerca" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_420px]">
          {/* Facet panel: desktop */}
          <div className="hidden lg:block">
            <FacetPanel facets={facets} counts={counts} onChange={setFacets} />
          </div>

          {/* Middle column */}
          <div className="flex min-h-0 flex-col">
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChange={handleSetQuery}
              count={filtered.length}
              total={groups.length}
              isDeferring={isDeferring}
            />

            {/* Mobile filter trigger */}
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 lg:hidden">
              <button
                onClick={() => setFacetsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-[12px] text-text-secondary"
              >
                <Filter className="h-3.5 w-3.5" /> Filtri
                {hasActiveFacets(facets) && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-accent-green/15 px-1 font-mono text-[9px] text-accent-green">
                    ●
                  </span>
                )}
              </button>
            </div>

            <ResultsList
              groups={filtered}
              query={deferredQuery}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              sort={sort}
              onSortChange={setSort}
              isSearching={isDeferring}
            />

            {globalExcluded.length > 0 && (
              <div className="border-t border-border-subtle p-4">
                <ExclusionList excluded={globalExcluded} />
              </div>
            )}
          </div>

          {/* Detail: desktop */}
          <div className="hidden lg:block">
            <DetailPane
              group={selectedGroup}
              onClose={() => setSelectedKey(null)}
              onAddToTypical={(line) => {
                setPendingAdd(line);
                toast.success(`"${line.productName}" aggiunto all'ordine tipico`);
              }}
            />
          </div>

          {/* Facet drawer: mobile */}
          <MobileDrawer
            open={facetsOpen}
            onClose={() => setFacetsOpen(false)}
            side="left"
            title="Filtri"
          >
            <FacetPanel facets={facets} counts={counts} onChange={setFacets} />
          </MobileDrawer>

          {/* Detail sheet: mobile (md and below) */}
          {selectedGroup && (
            <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSelectedKey(null)}>
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 right-0 w-full max-w-md bg-surface-card shadow-2xl"
              >
                <DetailPane
                  group={selectedGroup}
                  onClose={() => setSelectedKey(null)}
                  onAddToTypical={(line) => {
                    setPendingAdd(line);
                    toast.success(`"${line.productName}" aggiunto all'ordine tipico`);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TypicalOrderPanel
            groups={groups}
            index={index}
            pendingAdd={pendingAdd}
            onConsumedAdd={() => setPendingAdd(null)}
          />
        </div>
      )}

      <CheatsheetOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function TabSwitch({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border-subtle bg-surface-card p-0.5">
      {(["ricerca", "ordine"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
            tab === t
              ? "bg-accent-green/15 text-accent-green"
              : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          {t === "ricerca" ? "Ricerca" : "Ordine tipico"}
        </button>
      ))}
    </div>
  );
}
```

**IMPORTANT NOTE:** The `handleSetQuery` above calls `setQuery` twice — once inside and once outside `startTransition`. Remove the duplicate: keep only the non-transition call for responsiveness and let `useDeferredValue` handle deferral. Replace the function body with:

```tsx
const handleSetQuery = (next: string) => setQuery(next);
```

Also remove the now-unused `startTransition` / `isPending` wiring if it adds no value; keep `useDeferredValue` path only. Adjust `isDeferring` to `query !== deferredQuery`.

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: PASS.

- [ ] **Step 3: Dev smoke test**

```bash
npm run dev
```
Open http://localhost:3000/cerca (log in if required). Verify:
- Page renders, facets left, search middle, detail empty state right.
- Typing filters the middle list with no visible lag.
- Clicking a row populates the detail pane.
- "Aggiungi a ordine tipico" triggers a toast and adds a row in the "Ordine tipico" tab.
- Tab toggle switches between Ricerca and Ordine tipico.
- Facet checkbox changes update counts live.
- ⌘K / `/` focuses the search; `↓`/`↑` navigate rows; `Enter` opens detail; `Esc` closes detail.
- URL reflects `?q=…&units=…` etc. after 300ms.

Fix any runtime errors surfaced before committing.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/cerca/search-client.tsx
git commit -m "feat(cerca): awwwards-grade split view, URL state, keyboard shortcuts"
```

---

## Task 26: Accessibility + final QA pass

**Files:** No new files; audit-only + small fixes.

- [ ] **Step 1: Tab-through audit**

With DevTools, tab through `/cerca` from top. Verify:
- Every interactive element receives a visible focus ring (2px accent-green/40).
- No focus trap (except inside `CheatsheetOverlay` and `ImportWizard` modals — acceptable).
- Skip any overlay element's tab chain when closed.

Fix any missing `focus-visible` classes or misused `tabindex` in the touched files.

- [ ] **Step 2: Screen reader smoke**

With VoiceOver / NVDA:
- Search input announces "combobox".
- Result count announced after typing (aria-live polite on the `count/total` span in `SearchBar` — confirm it's `role="status" aria-live="polite"` if reader is silent; wrap the count span if needed).
- Detail pane announces its label when it becomes visible.

- [ ] **Step 3: Touch target audit (375px viewport)**

Open Chrome DevTools mobile emulator (iPhone SE). Verify:
- All buttons/chips ≥ 44×44px tap area (outer padding counts).
- No horizontal scroll on the page.
- Mobile facet drawer slides in and scrolls independently.
- Detail sheet slides in from right, close button reachable.

- [ ] **Step 4: Lighthouse**

```bash
# while dev server running
npx lighthouse http://localhost:3000/cerca --only-categories=accessibility --quiet --chrome-flags="--headless"
```
Target accessibility ≥ 95. Fix any flagged issues inline.

- [ ] **Step 5: Final type-check + lint + build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```
Expected: all PASS. Fix any failures.

- [ ] **Step 6: Commit a11y fixes (only if changes made)**

```bash
git add -A
git commit -m "chore(cerca): a11y polish — focus rings, aria-live, touch targets"
```

- [ ] **Step 7: Perf smoke (optional but recommended)**

With dev server running and 500+ fake groups (or real data), open Chrome DevTools → Performance tab, record typing "pomodoro" letter-by-letter. Check that no frame exceeds 16 ms during typing. If it does, re-check `useDeferredValue` wiring and that `buildIndex` is not being rebuilt per keystroke.

---

## Task 27: Update memory snapshot

**Files:**
- Modify: `C:\Users\Manum\.claude\projects\D--Manum-GastroBridge\memory\MEMORY.md`
- Create: `C:\Users\Manum\.claude\projects\D--Manum-GastroBridge\memory\project_cerca_redesign.md`

- [ ] **Step 1: Write memory entry**

```markdown
---
name: project_cerca_redesign
description: /cerca awwwards-grade redesign (2026-04-17) — split view, MiniSearch, virtualized list, facets, URL state, keyboard
type: project
---

/cerca rewritten 2026-04-17 to terminal-dense split view.

**Architecture:**
- Server fetch in `app/(app)/cerca/page.tsx` unchanged.
- `search-client.tsx` is the shell: tab state (`ricerca` | `ordine`), URL sync (`?q=…&units=…&suppliers=…&min=…&max=…&score=…&bio=1&certs=…&sel=…&tab=ordine`).
- Client-side `MiniSearch` index over product groups, built once per `groups` identity (`_lib/product-index.ts`).
- Facet filter + live counts are pure functions in `_lib/facets.ts`.
- Virtualized results via `@tanstack/react-virtual` (56px rows).
- Detail pane sticky right, mobile slide-sheet.
- Typical-order tab (`_components/typical-order-panel.tsx`) reuses the same MiniSearch index for inline search-to-add; preserves old import-wizard logic (reskinned).

**Why:** Previous `/cerca` used linear filter + flat list; spec asked for awwwards-level polish + zero lag at 5k items + full facet control.

**How to apply:** When adding features here, keep compute pure in `_lib/`, keep components <300 lines, reuse `scoreColorClass` semantics (rosso/arancione/giallo/verde).
```

- [ ] **Step 2: Append to MEMORY.md**

Add at end:
```
- [project_cerca_redesign.md](project_cerca_redesign.md) — /cerca awwwards split view + MiniSearch + virtual + URL state (2026-04-17)
```

- [ ] **Step 3: No commit** (memory files outside repo)

---

## Self-review checklist (done inline above)

- [x] Spec coverage: every section of `docs/superpowers/specs/2026-04-17-cerca-awwwards-redesign-design.md` maps to at least one task (layout → Task 25; index → Task 3; facets → Tasks 4, 9–11; URL state → Task 5; results list → Tasks 13–14; detail → Tasks 15–17; typical-order → Tasks 21–24; keyboard → Task 18; mobile → Task 20; a11y → Task 26).
- [x] No placeholders / TODOs.
- [x] Type/signature consistency: `Group`, `OrderLine`, `FacetState`, `ProductIndex`, `SupplierLite` used identically across tasks.
- [x] `scoreColorClass` contract preserved (existing semantics green/yellow/orange/red).
- [x] No test framework introduced — verification via tsc + lint + dev smoke.

## Acceptance verification (from spec)

Before declaring the plan complete, the executor must verify:
- [ ] Zero perceptible lag typing into search input at 500+ items (manual).
- [ ] All existing `/cerca` capabilities preserved — search by name, best-price surface, typical-order CRUD, import wizard, cart CTA, exclusion list.
- [ ] Split-view renders at ≥ 1024px; mobile drawer + sheet below.
- [ ] URL state roundtrip works (copy URL → open in new tab → identical state).
- [ ] Keyboard shortcuts functional (⌘K, /, ↓↑, Enter, Esc, ⌘A, F, ?).
- [ ] Score colors on prices remain rosso/arancione/giallo/verde.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- [ ] No console errors during normal interaction.
