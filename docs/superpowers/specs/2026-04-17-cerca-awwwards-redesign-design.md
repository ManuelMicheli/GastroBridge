# /cerca — Awwwards-grade redesign (terminal dense)

**Date:** 2026-04-17
**Area:** Restaurant — Ricerca prodotto (`app/(app)/cerca/`)
**Status:** Design approved, pending implementation plan

## Goal

Rebuild `/cerca` to an awwwards-caliber, production-grade search experience with Bloomberg/Linear "terminal dense" aesthetic. Must feel premium, organized, instantly responsive — zero perceptible input lag at 5k items.

Primary jobs-to-be-done:
1. Find a product across all supplier catalogs and pick the best-scored offer.
2. Maintain a recurring "ordine tipico" (typical order) and compare supplier totals.

## Scope

- **In scope:** Whole `app/(app)/cerca/` page (both "Ricerca singolo prodotto" and "Ordine tipico" sections) + the typical-order import wizard (reskin, not logic change).
- **Out of scope:** Scoring engine (`lib/scoring`), catalog upload/management, cart/order flow beyond "go to cart" CTA, backend changes.

## Constraints

- Volume target: 500–5 000 unique product groups, up to ~20k raw offers across supplier catalogs.
- Keep existing tokens (`--color-surface-*`, `--color-accent-*`, `--text-*`, `scoreColorClass`) from the Linear-grade foundations (see `memory/project_restaurant_foundations.md`).
- Keep existing scoring engine + `BreakdownTooltip` data shape.
- Reuse current server-side data fetch in `page.tsx` (no API changes).
- Mobile-first fluid responsive (see `memory/project_mobile_responsive.md`).
- No heavy design libs; reuse Tailwind + existing primitives.

## UX Pattern

- **Split view** (desktop): facet sidebar (260px) + results list (fluid) + detail pane (420px, sticky).
- **Tab toggle** in header: `Ricerca | Ordine tipico` (URL: `?tab=ricerca|ordine`).
- **Mobile**: facets in slide-in sheet, detail pane in full-screen sheet from right.

## Aesthetic

- Bloomberg/Linear "terminal dense" — mono tabular-nums for numbers, dense row rhythm (56px), uppercase section labels (`font-mono 10px tracking-wide`).
- Micro-animations only: fade on query change (150ms), width transitions on bars (300ms), row hover (75ms).
- No bouncy motion, no parallax.

## Architecture

### Layout

```
┌ PageHeader (title, subtitle, tab toggle) ────────────────────────────┐
├────────────┬────────────────────────────┬────────────────────────────┤
│ FacetPanel │ SearchBar (sticky top)     │ DetailPane (sticky top)    │
│ 260px      │ ResultsList (virtual 56px) │ BestOfferCard              │
│ sticky     │ flex 1                     │ OfferList + breakdown      │
│            │                            │ 420px                      │
└────────────┴────────────────────────────┴────────────────────────────┘

Grid: grid-cols-[260px_minmax(0,1fr)_420px] at ≥ lg
      grid-cols-[260px_minmax(0,1fr)]        at md (no detail, overlay)
      grid-cols-1                            at < md (drawer + sheet)
```

### Components

```
app/(app)/cerca/
  page.tsx                             (unchanged — server fetch)
  search-client.tsx                    (rewrite — shell, tab, URL sync)
  _components/
    facet-panel.tsx                    FacetPanel — groups + clear-all
    facet-group.tsx                    FacetGroup — collapsible with counts
    facet-range.tsx                    FacetRange — dual-handle price, single score
    search-bar.tsx                     SearchBar — hero input + ⌘K hint + count
    results-list.tsx                   ResultsList — virtual list wrapper + sort
    result-row.tsx                     ResultRow — 56px dense row
    sparkline.tsx                      Sparkline — inline SVG, offer prices
    detail-pane.tsx                    DetailPane — container + empty state
    best-offer-card.tsx                BestOfferCard — hero stats + CTA
    offer-list.tsx                     OfferList — offer rows with relative bars
    score-breakdown-inline.tsx         ScoreBreakdownInline — inline bar chart
    typical-order-panel.tsx            TypicalOrderPanel — tab content
    typical-order-table.tsx            TypicalOrderTable — dense table
    typical-order-add.tsx              TypicalOrderAdd — inline search-to-add
    import-wizard.tsx                  Extracted existing wizard + terminal reskin
    keyboard-hint.tsx                  KeyboardHint — key-chip primitive
    cheatsheet-overlay.tsx             CheatsheetOverlay — `?` shortcut help
  _lib/
    product-index.ts                   MiniSearch index builder + search fn
    facets.ts                          Filter + counts logic (pure)
    url-state.ts                       URL params ⇄ state
    highlight.tsx                      <mark> highlight helper

lib/search/                            (new shared dir)
  tokenize.ts                          Italian-friendly tokenizer (accent-strip)
```

### Data flow

```
page.tsx (server)
    └─ suppliers, items, preferences
         ↓
    SearchPageClient
         ├─ builds Group[] (existing rankOffers logic, memoized)
         ├─ builds MiniSearch index (useMemo on groups)
         ├─ URL state ⇄ facet state (useSearchParams + router.replace)
         └─ passes state + index down
              ↓
         ┌──────────┬──────────────┬────────────┐
         FacetPanel  ResultsList    DetailPane
            ↓          ↓              ↓
         facets    query + facets  selectedId
                     ↓
                  filtered Group[]
                     ↓
                  virtualized render
```

### Search index

```ts
// _lib/product-index.ts
import MiniSearch from "minisearch";
import { tokenize } from "@/lib/search/tokenize";

export type IndexedDoc = {
  id: string;               // Group.key
  productName: string;
  unit: string;
  supplierNames: string;    // space-joined
};

export function buildIndex(groups: Group[]) {
  const mini = new MiniSearch<IndexedDoc>({
    fields: ["productName", "unit", "supplierNames"],
    storeFields: ["id"],
    tokenize: (s) => tokenize(s),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { productName: 3, unit: 1 },
      combineWith: "AND",
    },
  });
  mini.addAll(groups.map(g => ({
    id: g.key,
    productName: g.productName,
    unit: g.unit,
    supplierNames: g.offers.map(o => o.supplier.supplier_name).join(" "),
  })));
  return mini;
}
```

Tokenizer: lowercase → NFD normalize → strip diacritics → split `[\s\-_/().,;:]+`.

### Rendering strategy

- Query input: controlled state, `useDeferredValue` for derived filtered list.
- Facet changes wrapped in `startTransition`.
- Results list uses `@tanstack/react-virtual` (rowHeight 56, overscan 8).
- Small LRU cache `Map<queryKey, string[]>` capped at 20 entries for backspace recovery.
- Index built lazily on first mount + rebuilt only when `groups` identity changes.

### Facet state

```ts
type FacetState = {
  units: Set<string>;
  supplierIds: Set<string>;
  categories: Set<string>;
  priceRange: [number, number] | null;  // null = full range
  minScore: number;                      // 0..100
  bioOnly: boolean;
  certs: Set<string>;
};
```

Live counts: for each facet group, compute counts applying **all other** facet filters but not the group itself (standard "or all" facet logic).

### URL state

Shallow routing via `router.replace`, debounced 300ms:

```
/cerca?tab=ricerca&q=pomodoro&units=kg,lt&suppliers=a,b&min=0&max=10&score=70&bio=1&sel=<groupKey>
```

Restores complete state on load / back / forward / share.

### Keyboard map

**Ricerca tab:**

| Key | Action |
|-----|--------|
| `/` or `⌘K` | focus search input |
| `↓` / `↑` | navigate results |
| `Enter` | select → open detail |
| `Esc` | close detail → if no detail, clear query |
| `⌘A` | add selected product to ordine tipico |
| `F` | toggle facet drawer (mobile) |
| `?` | cheatsheet overlay |

**Ordine tipico tab:**

| Key | Action |
|-----|--------|
| `N` | focus inline add-row search |
| `↑`/`↓` | navigate rows |
| `Del` | remove selected row |
| `Enter` on qty | commit + focus next row |

### Accessibility

- `role="combobox"` on search input with `aria-expanded`, `aria-activedescendant`.
- `aria-live="polite"` region for result counts.
- Facet panel `role="search"`.
- Focus visible: 2px `accent-green/40` ring.
- Detail pane `role="region"` with `aria-label="Dettagli prodotto"`.
- Touch targets ≥ 44px on mobile.

### Design tokens (reuse existing)

- Surfaces: `--color-surface-base`, `--color-surface-card`, `--color-surface-hover`
- Text: `--color-text-primary/secondary/tertiary`
- Borders: `--color-border-subtle`
- Accent: `--color-accent-green` (CTA, selected), `--color-accent-amber` (highlight)
- Score tint: `scoreColorClass(score)` helper (existing)
- Typography: `var(--text-title-lg/md)`, body 13–14px sans, numbers `font-mono tabular-nums`

### Dependencies

- `minisearch` (~10KB gzip)
- `@tanstack/react-virtual` (~8KB gzip)

### Performance budget

- < 16ms/keystroke render on 5k items (measured in Chrome Performance tab).
- Initial paint unchanged vs current (SSR same shell).
- Index build < 50ms on 5k items (one-off on mount).

## Testing plan

- **Manual scenarios:** 100 / 1k / 5k items. Rapid paste, rapid backspace, all facet combos, URL share/restore.
- **Perf:** Chrome Performance profile → no frame > 16ms during typing at 5k items.
- **Mobile:** 375px viewport — facet drawer slide-in, detail sheet, touch targets ≥ 44px, no horizontal scroll.
- **Accessibility:** Tab-through full flow, VoiceOver/NVDA announces counts, keyboard shortcuts don't trap focus.
- **URL share:** copy URL with filters → new tab → identical state restored.
- **Backward compat:** existing `/cerca/ordine` cart route still reachable from `ordine tipico` footer CTA.

## Risks / open questions

- **Italian tokenizer quality:** MiniSearch default doesn't understand Italian plurals (pomodori vs pomodoro). Fuzzy 0.2 should cover plural endings; monitor.
- **Virtual list with sticky detail:** ensure the virtual list's inner scroll container doesn't trap wheel events on the rest of the layout.
- **URL length:** many suppliers selected could blow URL length. Mitigation: cap at 20 ids, or use short ids.
- **`scoreColorClass` color semantics:** must remain rosso/arancione/giallo/verde per prior feedback — verify in implementation.

## Out of this spec (future)

- Server-side search API (only if catalog volume explodes past 50k).
- Saved searches / alerts on price drop.
- Comparison view (2+ products side-by-side).
- Recent searches history / pinned products.

## Acceptance criteria

- [ ] Zero perceptible lag typing into search input at 5k items.
- [ ] All existing `/cerca` capabilities preserved (no regression): search by name, best-price surface, typical-order CRUD, import wizard, cart CTA, exclusion list surfacing.
- [ ] Split-view layout renders correctly at ≥ 1024px; graceful mobile drawer + sheet below.
- [ ] URL state roundtrip works (share → restore).
- [ ] Keyboard shortcuts all functional.
- [ ] Score colors on prices remain rosso/arancione/giallo/verde per existing semantics.
- [ ] Lighthouse a11y score ≥ 95 on the page.
- [ ] No console errors, no layout shift during typing.
