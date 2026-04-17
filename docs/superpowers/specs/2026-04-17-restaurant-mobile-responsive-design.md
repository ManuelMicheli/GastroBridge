# Restaurant Area — Mobile-First Fluid Responsive Design

**Date:** 2026-04-17
**Branch target:** `main`
**Scope:** Restaurant area (`app/(app)/**`) only — Supplier area (`app/(supplier)/**`) untouched.
**Strategy:** Bottom-up tokens-first. Foundation in `globals.css` scoped to `[data-area="restaurant"]`, then chrome layout, then per-route audit.

---

## Goal

Make every restaurant page perfectly responsive across all device sizes (320px → 1920px+) using a fluid design system: clamp() typography, container queries, and adaptive density. No hardcoded breakpoints in components — components adapt to their parent container, not viewport.

**Why:** User wants Awwwards-grade professional polish at every viewport. Current Phase A foundation is desktop-first. Phase A typography/spacing tokens are static px values; Tailwind responsive prefixes are scattered across routes.

**Success criteria:**
- Every restaurant page is usable and visually polished on iPhone SE (320px) through 4K desktop (1920px+)
- No horizontal scroll on any viewport (except intentional carousels/tables)
- All touch targets ≥ 44×44px on mobile
- Typography scales smoothly without jumps at breakpoints
- Supplier area visually unchanged (regression-safe)
- Dark and light theme parity across all viewports

---

## Architecture Overview

4-layer fluid system, all scoped to `[data-area="restaurant"]`:

```
Layer 1 — Fluid Tokens         → app/globals.css (additive)
Layer 2 — Container Queries    → utility classes + new primitives
Layer 3 — Chrome Mobile        → drawer, mobile topbar, bottom-nav, full-screen palette
Layer 4 — Per-Route Audit      → 8 routes adapted using Layers 1-3
```

---

## Layer 1 — Fluid Tokens

### Typography (clamp-based)

Add inside `[data-area="restaurant"]` scope override:

```css
--text-display-2xl: clamp(32px, 4.5vw + 16px, 64px);
--text-display-2xl--line-height: 1.08;
--text-display-xl:  clamp(28px, 3vw + 16px, 44px);
--text-display-xl--line-height: 1.12;
--text-display-lg:  clamp(22px, 2vw + 14px, 32px);
--text-display-lg--line-height: 1.18;
--text-title-lg:    clamp(18px, 1vw + 14px, 22px);
--text-title-md:    clamp(15px, 0.5vw + 13px, 17px);
/* body, body-sm, caption, mono → unchanged (readability anchor) */
```

### Spacing (page-level fluid)

```css
--page-gutter:    clamp(16px, 4vw, 48px);
--section-gap:    clamp(24px, 5vw, 72px);
--card-pad:       clamp(16px, 2.5vw, 24px);
--page-max-width: min(1440px, 100%);
```

### Density Variables (adaptive)

Per-context variables resolved via container queries:

```css
--row-active: var(--row-cozy);
--cell-pad-active: var(--cell-pad-cozy);
```

Default = cozy (44px touch). Container queries override to `--row-compact` on `min-width: 521px`.

### Safe Area (mobile)

```css
--safe-bottom: env(safe-area-inset-bottom, 0px);
--safe-top:    env(safe-area-inset-top, 0px);
```

---

## Layer 2 — Container Queries

### Utility classes (`globals.css`)

```css
.cq-shell    { container-type: inline-size; container-name: shell; }
.cq-section  { container-type: inline-size; container-name: section; }
.cq-card     { container-type: inline-size; container-name: card; }
```

### Standard breakpoints (container)

| Token  | Width      | Use case                     |
|--------|------------|------------------------------|
| cq-sm  | ≥ 360px    | mobile wide                  |
| cq-md  | ≥ 520px    | tablet portrait              |
| cq-lg  | ≥ 720px    | tablet landscape / desktop   |
| cq-xl  | ≥ 960px    | wide desktop                 |

### Policy

| Pattern               | Tool                                    |
|-----------------------|-----------------------------------------|
| Component layout      | Container queries (`@container`)        |
| Page chrome (sidebar) | Viewport queries (Tailwind `lg:`)       |
| Typography/spacing    | Fluid tokens (clamp) — no media query   |
| Touch density         | Container queries on density vars       |

---

## Layer 3 — Chrome Mobile

### Sidebar pattern

| Viewport              | Behavior                                 |
|-----------------------|------------------------------------------|
| `< lg` (< 1024px)     | Off-canvas drawer 280px, backdrop blur, swipe-to-close |
| `lg` (≥ 1024px)       | Collapsed rail 64px, icon-only           |
| `xl` (≥ 1280px)       | Full sidebar 240px expanded              |

State persisted via existing localStorage Context.

### Topbar (mobile)

- `< md` → height 52px, hamburger sx + logo center + avatar dx, search icon → opens full-screen overlay
- `md+` → height 64px, sidebar toggle + inline search + breadcrumbs + actions

### Command Palette

- `< md` → full-screen modal, input 52px, item 56px
- `md+` → centered max-w-2xl, item 44px
- Cmd+K hint hidden on mobile

### Bottom Nav (new — `< md` only)

5 azioni primarie: Dashboard / Cerca / Carrello / Ordini / Account
- Fixed bottom 64px + safe-area-inset-bottom
- Active state: brand-primary fill icon + 3px top border
- Cart shows item count badge

### New primitives

| Component                           | Purpose                                  |
|-------------------------------------|------------------------------------------|
| `components/ui/bottom-sheet.tsx`    | Replace modals on `< md`                 |
| `components/ui/sticky-action-bar.tsx` | Fixed bottom CTA bar mobile             |
| `components/dashboard/bottom-nav.tsx` | Mobile-only bottom navigation           |

---

## Layer 4 — Route-by-Route Audit

### `/dashboard`
- Hero spending: display-2xl fluido + sparkline width 100% container
- KPI grid: cq 4-col → 2-col → 1-col stack
- Quick actions: horizontal snap-x on mobile (cards 280px)
- Recent orders table: container query → card list `< cq-md`

### `/cerca` (944-line client)
- Filter sidebar → bottom-sheet drawer `< lg`
- Product grid: cq 4→3→2→1 col + image aspect-ratio
- Search input full-width topbar mobile
- Sort/filter chips horizontal snap

### `/cataloghi/confronta`
- Comparison table → vertical stack per supplier `< lg`
- Sticky column header mobile, swipe between suppliers (snap-x)

### `/ordini` + `/ordini/[id]`
- List: extend tap area, min 44px touch
- Detail timeline 5-step: vertical mobile (already partial)
- Action buttons → sticky-action-bar mobile

### `/fornitori`
- Card grid cq 3→2→1
- Detail → bottom-sheet full-screen `< md`

### `/carrello`
- Items + summary side-by-side `lg+` → stacked + sticky-action-bar checkout mobile
- Quantity controls 44px touch
- Totals card sticky bottom mobile

### `/analytics`
- Charts: container query, snap-x cards mobile
- Spend-trend: aspect-ratio fluido, legend stacked mobile

### `/impostazioni`
- Form 2-col `lg+` → 1-col mobile (auto-fit grid)
- Section nav: horizontal scroll tabs mobile, vertical sidebar `lg+`

---

## Charts & Tables — Fluid Patterns

### Charts (SVG)
- Wrapper `cq-card`, `<svg width="100%" viewBox>`
- Aspect ratio: 16/9 desktop → 4/3 tablet → 3/2 mobile
- Legend inline `cq-md+` → stacked `< cq-md`
- Tooltip: hover desktop, tap-to-show mobile
- Sparkline height: clamp(32px, 6vw, 56px)

### Tables — 3 strategies (per case)

**A. Reflow → Card** (lista ordini, lista fornitori)
- `< cq-md` row → stacked card with label/value pairs

**B. Horizontal scroll** (catalogo, confronto multi-col)
- `overflow-x-auto`, sticky-left first column with shadow drop
- `scroll-snap-type: x mandatory`

**C. Priority columns** (ordini detail, ddt)
- Hide non-critical cols `< cq-lg` via `:nth-child` rules
- "More" tap → bottom-sheet with all fields

### Modals
- `< md` → bottom-sheet, drag handle, swipe-dismiss
- `md+` → centered modal max-w-2xl
- Page modals (es. compare detail) → full-screen mobile, scroll-y

---

## Forms, Inputs, Density

### Inputs
- Height: `clamp(40px, 6vw, 44px)`
- Font-size 16px min on mobile (no iOS Safari zoom)
- Padding: `clamp(12px, 1.5vw, 14px)`
- Focus ring: existing `--focus-ring` token

### Form layout (auto-fit)
```css
grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
```

### Density adaptive
```css
@container card (max-width: 520px) {
  --row-active: var(--row-cozy);
  --cell-pad-active: var(--cell-pad-cozy);
}
@container card (min-width: 521px) {
  --row-active: var(--row-compact);
  --cell-pad-active: var(--cell-pad-compact);
}
```

### Touch targets
- All interactive ≥ 44×44px on mobile
- 8px min spacing between adjacent targets
- Hover-only states replaced with tap+confirm mobile

---

## Implementation Order (4 Waves)

### Wave 1 — Foundation
1. Add fluid typography tokens to `[data-area="restaurant"]` scope
2. Add fluid spacing/page-gutter tokens
3. Add container query utility classes
4. Add density adaptive vars + safe-area vars
5. Build `<BottomSheet />` primitive
6. Build `<StickyActionBar />` primitive
7. Build `<BottomNav />` chrome

### Wave 2 — Chrome Layout
1. `app/(app)/layout.tsx` — wrap shell in `cq-shell`, safe-area padding, bottom-nav slot
2. Sidebar → drawer `< lg` + swipe close
3. Topbar mobile compact + search overlay
4. Bottom-nav 5 actions
5. Command palette → full-screen mobile

### Wave 3 — Routes (parallelizable batches)
- **Batch A:** dashboard + analytics (charts/KPI)
- **Batch B:** cerca + cataloghi/confronta (filter + grid + compare)
- **Batch C:** ordini + ordini/[id] (list + detail + timeline)
- **Batch D:** fornitori + carrello + impostazioni

### Wave 4 — Verification
- Viewport test: 320 / 375 / 430 / 600 / 768 / 1024 / 1280 / 1440 / 1920
- Touch target audit
- Cross-browser: Safari iOS, Chrome Android, Firefox desktop
- `prefers-reduced-motion` verify
- Dark/light theme parity per viewport
- Supplier area regression check

---

## Hard Rules

- All overrides MUST live inside `[data-area="restaurant"]` scope (supplier safe)
- NEVER touch base `@theme` tokens (supplier inherits)
- Maintain 1px hairline rule (no thicker borders)
- No carmine for error/warning/destructive
- `prefers-reduced-motion` zeroed on every animation/transition
- 240ms fade-up page transition preserved
- `--focus-ring` dual-ring focus state preserved on every interactive
- 16px min font-size on inputs (iOS Safari no-zoom)

---

## Files Touched (estimate)

| Path                                                             | Change           |
|------------------------------------------------------------------|------------------|
| `app/globals.css`                                                | Additive ~120 lines |
| `app/(app)/layout.tsx`, `template.tsx`                           | Wrap + safe-area  |
| `components/dashboard/sidebar.tsx`                               | Drawer pattern    |
| `components/dashboard/topbar.tsx`                                | Mobile compact    |
| `components/dashboard/command-palette.tsx`                       | Full-screen mobile |
| `components/ui/bottom-sheet.tsx` (new)                           | Create            |
| `components/ui/sticky-action-bar.tsx` (new)                      | Create            |
| `components/dashboard/bottom-nav.tsx` (new)                      | Create            |
| `components/dashboard/restaurant/restaurant-dashboard.tsx`       | Hero + KPI fluid  |
| `app/(app)/cerca/search-client.tsx`                              | Filter sheet, grid cq |
| `app/(app)/cataloghi/confronta/compare-client.tsx`               | Stack < lg        |
| `app/(app)/ordini/page.tsx`, `ordini/[id]/page.tsx`              | Touch + sticky    |
| `app/(app)/fornitori/*`                                          | cq grid, sheet detail |
| `app/(app)/carrello/cart-client.tsx`                             | Sticky CTA mobile |
| `app/(app)/analytics/*`                                          | Charts cq + snap-x |
| `app/(app)/impostazioni/*`                                       | Form auto-fit     |

---

## Commit Strategy

- 1 commit per wave (4 commits total)
- 1 final commit with verification notes
- Conventional Commits format with `feat(restaurant-responsive):` prefix

---

## Out of Scope

- Supplier area mobile responsive (Phase 2 — separate spec)
- Marketing/auth pages
- New features beyond responsive adaptation
- Tablet-specific orientations (portrait vs landscape — handled by container queries naturally)
- Bundle size optimization
- Image optimization (AVIF/WebP — separate concern)
