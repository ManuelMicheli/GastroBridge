# Restaurant Area — Awwwards-Level Foundations (Phase A)

**Date:** 2026-04-16
**Scope:** Restaurant area only (`app/(app)/**`). Supplier untouched.
**Status:** Design approved, ready for plan decomposition.
**Sequencing:** Phase A (this spec) → Phase B (3 separate specs: dashboard hero, cerca-as-art, ordini timeline).

---

## 1. Goal

Ship a Linear-grade foundations layer that every restaurant page inherits. After Phase A merges, every page in the restaurant area feels professional without per-page redesign.

## 2. Aesthetic Direction

**Reference family:** Linear / Vercel / Arc.

- Minimal, hyper-typographic, restrained motion.
- Monochrome dominant. Carmine `#B91C3C` (light) / `#E84560` (dark) used as a micro-accent (≤5% surface area).
- Density-first. Hairline borders. No ornament without function.
- "Awwwards" here means *craft*, not *spectacle*.

**Density calibration:** "Linear-comfortable" — 14px body, ~40px row height, 6–8px micro-spacing. Pro feel without being unreadable for non-power users (chefs, owners on mobile).

**Motion budget:** "L2 — Linear actual." 5 named primitives total, all <300ms, all CSS where possible. `prefers-reduced-motion` zeroes durations.

## 3. Architecture

Foundations touch four layers, in order:

1. **Tokens** — typography, spacing, motion, elevation, radii.
2. **Primitives** — `components/ui/*` refinement plus 8 new primitives.
3. **Dashboard chrome** — sidebar, topbar, breadcrumb, command palette, page-header pattern.
4. **State patterns** — universal skeleton/empty/error/loading + adoption.

Restaurant area only. Tokens scoped via `[data-area="restaurant"]` (already in place). Supplier scope inherits its own remap, unchanged.

## 4. Token System

### 4.1 Typography (Satoshi already loaded)

| Token | Size/leading | Weight | Use |
|---|---|---|---|
| `text-display-2xl` | 48/52 | 600 | Hero numbers (dashboard KPI hero) |
| `text-display-xl` | 36/40 | 600 | Page H1 (rare) |
| `text-display-lg` | 28/32 | 600 | Section hero |
| `text-title-lg` | 20/28 | 600 | Card titles, modal headers |
| `text-title-md` | 16/24 | 600 | Section headers, table column groups |
| `text-title-sm` | 14/20 | 600 | Subsections, list group headers |
| `text-body` | 14/20 | 400 | Default body, table cells |
| `text-body-sm` | 13/18 | 400 | Metadata, secondary info |
| `text-caption` | 12/16 | 500 | Eyebrow labels (uppercase, +4% tracking, brand-depth color) |
| `text-mono` | 13/18 | 500 | Numbers in tables, IDs, codes (JetBrains Mono) |

**Tracking:** `-0.011em` display, `-0.006em` titles, `0` body, `+0.04em` uppercase eyebrow.

### 4.2 Spacing scale

`2 / 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 72 / 96` (px).
**Page gutter:** 24 mobile, 32 tablet, 48 desktop.
**Section vertical rhythm:** 32 / 48 / 72.

### 4.3 Radii

`sm=6, md=8, lg=12, xl=16, 2xl=20, pill=9999`.

### 4.4 Elevation

**Dark:**
- card: `0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)`
- card-hover: adds `0 12px 40px rgba(0,0,0,0.5)`
- modal: `0 32px 64px rgba(0,0,0,0.6)`

**Light:**
- card: `0 1px 2px rgba(0,0,0,0.04), 0 1px 0 rgba(0,0,0,0.06)`
- card-hover: `0 4px 12px rgba(0,0,0,0.08)`
- modal: `0 24px 48px rgba(0,0,0,0.12)`

**Hairlines:** 1px borders only, `--color-border-subtle` default. Borders never bolder than 1px and never colored except focus/active brand state.

### 4.5 Motion primitives (5 total)

```css
--motion-fade:    opacity 200ms var(--ease-out-expo);
--motion-lift:    transform 200ms var(--ease-out-expo);          /* hover -1px translateY */
--motion-spring:  280ms cubic-bezier(0.34, 1.56, 0.64, 1);       /* modals, popovers */
--motion-stagger: 40ms;                                          /* delay between list items */
--motion-page:    240ms var(--ease-out-expo);                    /* route transition */
```

`prefers-reduced-motion: reduce` zeroes all durations.

## 5. Component Primitives

Refine `components/ui/*` (existing) and add 8 new primitives.

### 5.1 Button
- Sizes: `sm` 28px, `md` 32px, `lg` 40px.
- Variants: `primary` (carmine solid), `secondary` (hairline + transparent), `ghost` (no border, hover bg-surface-hover), `danger` (error solid).
- Focus ring: 2px offset, brand color, 200ms fade-in.
- Hover: `--motion-lift` -1px + brightness +5%.
- Active: `scale(0.98)` 80ms.
- Loading: spinner inline-replaces label, button width locked.
- Icon-only: square, tooltip auto-bound via `aria-label`.

### 5.2 Input / Select / Textarea
- Default 32px height, `lg` 36px.
- Border `--color-border-default`. Focus → `--color-brand-primary` 1px + 3px ring `--color-brand-primary-subtle`.
- Label above (12px caption uppercase) + helper text below (12px text-secondary).
- Error: border error + helper red + AlertCircle icon left.
- Numeric inputs: tabular-nums, mono font.
- Select: chevron 12px, dropdown matches input width, max-h 320 + scroll.

### 5.3 Card / DarkCard
- Default: bg-surface-card, 1px hairline, radius lg, padding 20.
- Interactive variant: adds `--motion-lift` on hover + border lightens to `border-default`.
- Glow variant **removed by default**. Only on hero KPI of dashboard.

### 5.4 Badge
- Tones: neutral / brand / success / warning / error / info.
- Styles: `solid`, `subtle` (12% bg + full color text, default), `outline`.
- 11px text, 4×8 padding, radius pill.

### 5.5 Modal / Dialog
- Overlay: `rgba(0,0,0,0.6)` dark / `rgba(0,0,0,0.4)` light, blur 8px.
- Panel: `--motion-spring` enter, scale 0.96→1 + fade.
- Header pinned, footer pinned, body scrolls.
- Esc + click-outside close. Focus trap. Return focus to trigger on close.

### 5.6 Toast
- 4 tones: success / error / warning / info.
- 320px wide, top-right.
- Slide-down + fade enter, swipe-to-dismiss.
- Action button optional. Auto-dismiss 5s, persist on hover.

### 5.7 Tooltip
- 100ms open delay, instant close.
- 12px text, 6×8 padding, surface-elevated bg, shadow-card.
- Arrow optional. Max width 240, wraps.

### 5.8 Skeleton (new primitive)
- `<Skeleton variant="text|line|block|circle" />`.
- Shimmer 1.4s linear. Reduced-motion = static dim.
- Each page provides its own skeleton tree matching final layout (zero CLS).

### 5.9 Table
- Sticky header, hairline rows, 40px row height (D2), zebra optional.
- Hover: bg-surface-hover full row.
- Sortable columns: chevron right of label, active state shows direction.
- Selection: leading checkbox col, bulk-action bar slides up from bottom when ≥1 selected.
- Loading: 5 skeleton rows matching columns.
- Empty: centered EmptyState.

### 5.10 Dropdown / Popover (new if missing)
- `--motion-spring` enter.
- Trigger gets `aria-expanded`, focus-visible ring.
- Items 32px height, 14px text, kbd shortcut shown right (mono).
- Section dividers, danger items (red text).

### 5.11 New universal primitives

- `<EmptyState />`
- `<ErrorState />`
- `<PageHeader />`
- `<SectionHeader />`
- `<ActionBar />`
- `<FilterBar />`
- `<Skeleton />`
- `<Popover />` (if not already present)

## 6. Dashboard Chrome

### 6.1 Sidebar (`CollapsibleSidebar`)
- Width: 240 expanded, 56 collapsed.
- Logo block: 48px height, "Gastro" serif + "Bridge" carmine. Collapsed = "G" mark only.
- Nav items: 32px height, 13px label, 16px icon, 8px gap, 12px horiz padding, radius md.
- Active: bg `--color-brand-primary-subtle` + 2px left bar `--color-brand-primary` + text brand-primary.
- Hover (inactive): bg `--color-surface-hover`, no border.
- Section header: 11px uppercase, +4% tracking, text-tertiary, no divider.
- Workspace switcher (top): user/restaurant name + chevron, dropdown with switch/settings/logout.
- Theme toggle + collapse trigger pinned bottom, hairline divider above.
- Width transition 240ms expo, labels fade 120ms.

### 6.2 Topbar (`DarkTopbar`)
- Height: 52px.
- Left: page breadcrumb only (no logo).
- Center: command palette trigger (search-shaped, `⌘K` kbd hint, max-width 480).
- Right: notifications bell, theme toggle, avatar menu.
- Hairline border-bottom, no shadow.

### 6.3 Breadcrumb
- Inline in topbar. Pattern `Section / Page / Detail`.
- Separator `/` 12px text-tertiary.
- Last segment text-primary 13px, others text-secondary 13px, hover underline.
- Truncation middle on long paths: `Section / … / Detail`.

### 6.4 Command palette (`CommandPalette`)
- Trigger `Cmd+K`. Modal centered, 640px wide, max 70vh.
- Spring enter, esc close, click-outside close.
- Input 48px, no border (palette has its own).
- Results grouped: Azioni / Pagine / Fornitori / Prodotti / Ordini.
- Each row: icon (16) + label + secondary (right) + kbd shortcut.
- Active row: bg-surface-hover + 2px left bar brand.
- Up/Down nav, Enter selects, Tab cycles groups.
- Empty state: "Nessun risultato per <query>" + suggestion chips.
- Recent actions section when query empty.

### 6.5 PageHeader pattern

```tsx
<PageHeader
  title="Ordini"
  subtitle="Gestione ordini e ricezione merce"
  actions={[<Button>Nuovo ordine</Button>]}
  meta={<Badge>23 attivi</Badge>}
/>
```

- Title `text-display-lg` (28/32, 600).
- Subtitle `text-body-sm` text-secondary, max-width 60ch.
- Actions right-aligned, gap 8.
- Meta inline next to title, gap 12.
- 32px bottom margin, hairline divider optional via prop.

### 6.6 SectionHeader
- `text-title-md` (16/24, 600).
- Optional right action: `text-caption` text-link "Vedi tutti →".
- 16px bottom margin.

### 6.7 ActionBar (sticky bottom for forms/lists)
- Position fixed bottom inside content area, hairline border-top, bg-surface-base.
- Left: contextual info ("3 prodotti selezionati", "Modifiche non salvate").
- Right: secondary + primary buttons.
- Slide-up enter on activation.

### 6.8 FilterBar (above tables)
- Inline horizontal: search input (left, 280px) + filter chips + sort dropdown right.
- Active filter: chip with X, brand-subtle bg.
- "Tutti i filtri" overflow → drawer right.
- Result count below: "12 risultati su 248".

## 7. State Patterns

### 7.1 Skeleton system
- Per-page skeleton co-located via Next.js `app/(app)/<route>/loading.tsx`.
- Uses `<Skeleton />` primitive.
- Rule: skeleton must reproduce final grid + row count + column widths (zero CLS).
- 8 page-level skeletons: dashboard, cerca, fornitori, cataloghi, ordini, carrello, analytics, impostazioni.

### 7.2 EmptyState

```tsx
<EmptyState
  icon={InboxIcon}
  title="Nessun ordine ancora"
  description="Quando crei il primo ordine, comparirà qui con stato e timeline."
  action={<Button>Crea primo ordine</Button>}
  illustration={<OrdersEmptyArt />}
/>
```

- Centered vertical, max-width 360.
- Title 16/24 600, description 13/20 text-secondary.
- 4 contexts: page-empty, section-empty, search-empty, filter-empty.
- 6 bespoke SVG illustrations (200×160, monochrome line, brand accent dot): empty-cart, empty-orders, empty-suppliers, empty-search, empty-products, empty-team.

### 7.3 ErrorState

```tsx
<ErrorState
  title="Impossibile caricare gli ordini"
  description="Riprova o ricarica la pagina."
  action={<Button onClick={retry}>Riprova</Button>}
  variant="inline" | "page"
/>
```

- AlertCircle icon text-error 24px.
- Inline = within card. Page = full container with optional "Torna alla dashboard".
- Auto-retry option for transient errors (3 attempts, exponential backoff).

### 7.4 Loading patterns by surface

| Surface | Pattern |
|---|---|
| List/table | Skeleton rows matching final |
| Card | Skeleton internals only, card chrome immediate |
| Form submit | Button shows spinner + lock, fields stay enabled |
| Modal open | Skeleton inside, modal frame instant |
| Inline value (KPI) | Pulse skeleton, width=value-width-estimate |
| Image | bg-surface-hover, fade-in on load 200ms |
| Page route | `loading.tsx` skeleton hero + grid |

### 7.5 Optimistic UI rules
- Cart add/remove: immediate UI + revert on error toast.
- Order draft save: instant "Salvato" indicator (text-tertiary, 1.5s fade).
- Status toggle: immediate flip, revert on error.
- Like/star/favorite: instant fill, silent revert on error.

### 7.6 Micro-feedback
- Copy to clipboard: button label morphs → ✓ "Copiato" 1.5s → revert.
- Save success: toast top-right or inline "Salvato" text-success fade.
- Destructive action: confirm modal with typed-name verification for irreversible ops.
- Bulk action complete: toast with count + undo (5s window).

## 8. Page Transitions + Accessibility

### 8.1 Page transitions
- `app/(app)/template.tsx` wraps each route. Cross-fade 240ms via Framer Motion `<AnimatePresence mode="wait">` keyed on pathname.
- Exit: opacity 0 + translateY(-4px) 160ms.
- Enter: opacity 1 + translateY(0) 240ms expo, delay 80ms.
- Disable on `prefers-reduced-motion`.
- Sidebar/topbar persist (outside template).
- `loading.tsx` renders during async wait; swaps when ready.

### 8.2 Scroll behavior
- New route → scroll top instant.
- Hash anchor → smooth scroll.
- Restore scroll on back nav (Next.js default).

### 8.3 Focus management
- Modal open → focus first interactive.
- Modal close → focus return to trigger.
- Route change → focus h1 of new page (`tabindex={-1}` sr-only).
- Skip-to-content link top-left, visible on focus.

### 8.4 Keyboard map (documented in `?` modal and command palette)

| Shortcut | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘/` | Focus search |
| `⌘B` | Toggle sidebar |
| `g d` | Go to dashboard |
| `g o` | Go to ordini |
| `g c` | Go to cataloghi |
| `g s` | Go to cerca |
| `?` | Show keyboard help modal |
| `Esc` | Close modal/popover/clear search |
| `j / k` | Next/prev list item (table focus) |
| `Enter` | Open focused item |

### 8.5 ARIA / live regions
- Toast region: `aria-live="polite"` for success/info, `assertive` for error.
- Form errors: `aria-describedby` linking helper text.
- Loading states: `aria-busy="true"` on async surfaces.
- Sortable table headers: `aria-sort`.

### 8.6 Focus-visible polish
- All interactive elements: `:focus-visible` 2px ring offset 2, brand color, 200ms fade.
- Buttons: ring outside border (no inner).
- Links: underline + ring.
- Cards (clickable): ring on focus, `--motion-lift` on hover.

### 8.7 WCAG checklist
- All text ≥ 4.5:1 contrast (≥ 3:1 large).
- Touch targets ≥ 44px on mobile.
- Form labels always visible (no placeholder-as-label).
- Error messages text + icon (not color alone).
- Focus order matches visual order.
- Heading hierarchy h1→h2→h3, no skips.

## 9. Plan Decomposition

Phase A spec → 4 sequential plans.

### Plan A1 — Token system + motion primitives (~3-4 days)
- Extend `globals.css` `@theme` with typography scale, spacing, radii, elevation, motion tokens.
- Tailwind 4 utility exposure for new tokens.
- Add 5 motion primitives + reduced-motion guard.
- Migrate restaurant scope to use new tokens.
- Verify supplier untouched.
- Smoke test all restaurant pages render.

### Plan A2 — Component primitives polish (~5-7 days)
- Refine `components/ui/*`: button, input, select, textarea, badge, modal, toast, card, table, dropdown, tooltip.
- Add new primitives: `Skeleton`, `EmptyState`, `ErrorState`, `Popover`, `PageHeader`, `SectionHeader`, `ActionBar`, `FilterBar`.
- Each: ts file + visual variants + a11y + reduced-motion.
- Update existing usages restaurant-side (find/replace pass).

### Plan A3 — Dashboard chrome refinement (~4-5 days)
- Sidebar: width 240/56, new active state, workspace switcher, theme+collapse pinned bottom.
- Topbar: 52px, breadcrumb left, command palette center.
- Command palette: groups, kbd shortcuts, recent actions, group navigation.
- Breadcrumb component using new pattern.
- Page transition wrapper (`template.tsx`).

### Plan A4 — State patterns + a11y rollout (~4-5 days)
- 8 page-level `loading.tsx` skeletons.
- 6 bespoke empty illustrations (SVG).
- Wire EmptyState/ErrorState into existing pages.
- Focus management (modal trap, route h1 focus, skip link).
- Keyboard shortcuts (g-prefix navigation, ? help modal).
- WCAG audit pass + fixes.

**Total Phase A: ~16-21 days work.**

## 10. Out of Scope

- Supplier area (`app/(supplier)/**`).
- Marketing/landing pages.
- Auth flow.
- Phase B signature page redesigns (separate specs after Phase A).
- New features. Polish only — no new business logic.

## 11. Hard Rules

1. Never hardcode `#B91C3C` or any brand hex in components. Always `var(--color-brand-primary)` or Tailwind class reading the variable.
2. Never use brand carmine for error/warning/destructive. Semantic tokens stay independent.
3. `prefers-reduced-motion` respected on every motion primitive and animation.
4. WCAG AA contrast on all text (≥ 4.5:1 body, ≥ 3:1 large).
5. No shadow on hairlines (1px borders only). Elevation via shadow tokens.
6. No glow on default cards. Glow reserved for dashboard hero KPI in Phase B.
7. Supplier area must render identically before and after each plan merges.

## 12. Verification (per plan)

After each plan merges:

- Smoke test all restaurant routes load without console errors.
- Visual diff vs. baseline (manual).
- Lighthouse a11y ≥ 95 on dashboard and ordini.
- `prefers-reduced-motion` test: all animations stop.
- Supplier route smoke test: visually unchanged.
- TypeScript build passes, ESLint clean.

## 13. Phase B Preview (separate brainstorm cycles later)

Three signature pages get bespoke treatment after Phase A:

- **Dashboard** — hero KPI moment, count-up animation, real-time activity feed, "today" timeline.
- **Cerca prodotti** — search-as-art: instant results, comparison cards, category palette, side-by-side prices.
- **Ordini** — timeline-rich detail page, status scrubber, receiving wizard polish, issue resolution flow.

Each gets its own spec → plans → ship cycle.
