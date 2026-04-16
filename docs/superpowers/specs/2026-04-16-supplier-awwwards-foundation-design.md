# Supplier Area — Awwwards Foundation Polish (Phase 1)

**Date:** 2026-04-16
**Author:** ManuelMicheli (via Claude Opus 4.7)
**Status:** Design approved — ready for implementation plan
**Scope:** Foundation-level polish for the `app/(supplier)/**` area — design system, shell, primitives, signature components.

## 1. Context

GastroBridge is a B2B Ho.Re.Ca. marketplace with two visually distinct areas: **restaurant** (carmine/white, buyer-side) and **supplier** (ocra/ivory, seller-side). Token rebrand for the supplier area has already shipped (see `app/globals.css` — `[data-area="supplier"]` light + dark scopes with ocra `#A87535`, ivory `#FBF8F1`, gold highlight `#E8B547`, brown depth `#5C3F18`). The shell (`DashboardShell` + `CollapsibleSidebar` + `DarkTopbar` + `CommandPalette`) is functional.

The goal now is to elevate the supplier area to **awwwards-level professional aesthetic and UI/UX quality** without touching the restaurant area. Because this spans 13+ route groups, the work is decomposed into 5 phases. **This spec covers Phase 1 only — the design-system foundation that every downstream phase will inherit.**

## 2. Phase decomposition

- **Phase 1 (this spec)** — Foundation polish. Shared design-system layer: motion/density tokens, shell polish, UI primitives, signature components, quality passes.
- Phase 2 — Dashboard hero redesign (consumer of signature components).
- Phase 3 — Dense operational tables (catalogo, ordini, listini, DDT, clienti, magazzino).
- Phase 4 — Action flows (orders kanban + preparation, deliveries + POD, import wizard).
- Phase 5 — Settings, staff, analytics, reviews.

Out-of-scope for Phase 1: the restaurant area (`app/(app)/**`), marketing pages, existing ocra/ivory tokens (extend only, do not rewrite).

## 3. Design decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Visual direction | **A (Editorial Operator) light + C (Ops Command) dark** | Light mode reads as a professional editorial dashboard (Linear/Stripe/Mercury); dark mode shifts to a realtime ops command center (Superhuman/Vercel). Same brand, two moods. |
| Density baseline | **Cozy — 44px row** default, with user-toggle `compact ↔ cozy` on dense tables. Editorial (56px) reserved for hero and dashboard landing only. | Bilanced across readability and ops density. Editorial on tables wastes vertical space in daily use. |
| Signature moments | **#2 Animated counters · #3 Realtime pulse · #5 Micro-celebrations · #6 Live data ticker · #8 Display serif greeting** | Five memorable moments anchor the brand: hero (greeting + counters + ticker), ops (pulse + celebration). Command palette and ambient spotlight intentionally deferred. |
| Motion intensity | **Balanced** — 400–600ms on hero, 150–250ms on micro; `ease-out-expo` default, `ease-spring` for celebrations; 40ms stagger on lists | Visible and deliberate without fatiguing a daily 8h operator tool. Cinematic motion stuns once then tires. |
| A11y | WCAG AA (4.5:1 body, 3:1 large). `prefers-reduced-motion` respected everywhere. Full keyboard navigation. | Non-negotiable for a professional SaaS tool. |

Hard rules (inherited from the rebrand spec and preserved here): ocra never signals "warning", gold never signals "success", semantic colors (success/warning/error/info) stay independent of brand, gold appears on ≤5% of any operational page.

## 4. Architecture

### 4.1 Token additions (`app/globals.css`)

All new tokens extend the existing `@theme` block. No existing token is modified.

**Motion tokens**

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);       /* already exists */
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);      /* new — counter */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);     /* new — celebration */
--duration-fast: 150ms;     /* exists */
--duration-normal: 250ms;   /* exists */
--duration-slow: 400ms;     /* exists */
--duration-hero: 600ms;     /* new — counter mount, serif greeting */
--duration-pulse: 1800ms;   /* new — pulse dot loop */
--duration-ticker: 45s;     /* new — ticker full cycle */
--stagger-sm: 40ms;         /* new — list stagger */
```

**Density tokens**

```css
--row-compact: 36px;
--row-cozy: 44px;        /* default */
--row-editorial: 56px;   /* hero only */
--cell-pad-compact: 6px 10px;
--cell-pad-cozy: 10px 14px;
--cell-pad-editorial: 14px 16px;
```

**Elevation scale**

```css
--elev-0: 0 0 0 transparent;
--elev-1: 0 1px 2px rgba(0, 0, 0, 0.04);
--elev-2: 0 4px 12px rgba(0, 0, 0, 0.06);
--elev-3: 0 8px 24px rgba(0, 0, 0, 0.08);
--elev-4: 0 20px 60px rgba(0, 0, 0, 0.12);
/* dark variants use rgba(0,0,0,.4) … rgba(0,0,0,.7) and live in dashboard-dark scope */
```

**Focus token (unified dual-ring)**

```css
--focus-ring: 0 0 0 2px var(--surface-page), 0 0 0 4px var(--color-brand-primary);
```

**Numeric font utility**

```css
--font-num: var(--font-display);
/* consumers apply: font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; */
```

No new color tokens.

### 4.2 Shell polish

Shell already exists in `components/dashboard/shell.tsx` — targeted polish, not a rewrite.

**`CollapsibleSidebar`** (`components/dashboard/sidebar/collapsible-sidebar.tsx`)

- Wordmark: `Gastro` in display-serif regular + `Bridge` in display-serif + trailing period `.` colored `brand-primary` (signature mark). Remove current bold treatment on "Bridge".
- Role pill: replace raw uppercase caption with a thin pill — `bg-brand-primary-subtle` `text-brand-depth` 10px tracking-widest, `border-brand-primary-border`.
- Section dividers: 1px hairline `border-subtle` above each section label, 16px vertical spacing between groups.
- Active nav item: 2px left indicator bar `brand-primary` + existing subtle bg. In dark, add `--glow-brand` on the indicator.
- Hover nav item: `bg-surface-hover` + icon color transitions to `brand-primary` over 150ms.
- Badge counts: mono 10px pill. `ordersBadge` → `bg-brand-highlight` `text-brand-highlight-on` (gold). `stockBadge` → `bg-warning-subtle` `text-warning` (amber, not brand).
- Footer `SidebarUserCard`: avatar monogramma on `brand-primary-subtle`, name + muted email, inline theme toggle.
- Motion: width 72↔256 at 250ms `ease-out-expo` (unchanged); nav items fade-in staggered 20ms on expand.
- Collapsed state: Radix tooltip per icon, 300ms open delay, side="right".

**`DarkTopbar`** (`components/dashboard/topbar/dark-topbar.tsx`)

- **Breadcrumbs**: separator `/` in `text-brand-primary`, current page in display serif 14px, parent links in mono 11px muted. Parent hover: underline ocra.
- **SearchTrigger**: mono placeholder `Cerca…  ⌘K` 11px JetBrains Mono, search icon left, `bg-surface-muted` + `border-subtle`. Focus expands width 240px → 320px at 250ms.
- **NotificationBell**: count badge in `brand-highlight`, pulse dot on unread (wired to realtime).
- **ThemeToggle**: polish icon swap with rotation + scale.
- **LiveStatus** (new, conditional): `PulseDot` + `Live · {ordersToday} oggi` in mono. Only on pages with realtime relevance (dashboard, ordini, consegne). Component described in §4.4.

**`SidebarDrawer`** (`components/dashboard/mobile/sidebar-drawer.tsx`)

- Overlay `bg-surface-overlay` with `backdrop-blur-xl`.
- Slide-in 320px width, 300ms `ease-out-expo`, swipe-to-close (native touch, no library).
- iOS safe-area insets honored.

**`CommandPalette`** — unchanged in Phase 1 (already implemented, polish deferred if needed).

**Main container**

- Apply `max-width: 1440px` plus responsive padding (`p-4 sm:p-6 lg:p-8`).
- Optional `<PageHero>` slot (via prop in the shell) for `SerifGreeting` on dashboard and settings home.

### 4.3 Primitive polish

All primitives read CSS variables so they automatically render ocra in the supplier scope and carmine in the restaurant scope. No `role`-branching inside components.

**`Button`** (`components/ui/button.tsx`)
- Variants: `primary`, `secondary`, `ghost`, `destructive`, `celebration` (gold — reserved for rare success actions).
- Sizes: `sm` 32px, `md` 40px (default), `lg` 48px, `icon` square.
- States: idle / hover / active / focus / disabled / loading.
- Hover primary: active scale 0.98 + `bg-brand-primary-hover` + `elev-2`.
- Focus: `--focus-ring` dual-ring.
- Loading: spinner replaces icon, button width frozen to prevent layout jump.
- Icon slot: left or right, 8px gap, stroke 1.5.
- Transition: 150ms `ease-out-expo`.

**`Input` / `Select` / `Textarea`** (`components/ui/input.tsx`, `select.tsx`)
- Border 1px `border-default`; focus border `brand-primary` + subtle ring.
- Padding 10px 14px, height 40px.
- Label rendered above the control (more scannable than float-label).
- Invalid: border `error` + helper text below.
- Prefix/suffix slots (icon, currency unit).
- Disabled: `bg-surface-muted` + muted text.

**`Card`** (`components/ui/card.tsx` — polish existing)
- Border 1px `border-default`, radius 14px.
- Padding variants: `compact` 14px, default 20px, `hero` 28px.
- Elevation: rest `elev-1`; if `clickable`, hover `elev-2` at 200ms.
- `glow` prop (dark only): ambient `--glow-brand` on hover.
- Slots: `CardHeader` (eyebrow + title + action), `CardBody`, `CardFooter`.

**`Badge`** (`components/ui/badge.tsx`)
- Variants: `brand`, `highlight` (gold), `success`, `warning`, `error`, `info`, `neutral`.
- Sizes: `xs` 9px, `sm` 11px (default), `md` 13px.
- Shapes: `pill` (default) or `square` (tag).
- Mono font for numeric badges (e.g. `12 NEW`), sans for labels.
- `dot` variant with leading colored dot.

**`Modal`** (Radix Dialog wrapper)
- Overlay `bg-surface-overlay` + `backdrop-blur-sm`.
- Panel max-width `lg`, radius 16px, `elev-4`, padding 24px.
- Header: title display serif 22px + close icon.
- Motion: fade + scale 0.98 → 1.0 at 300ms `ease-out-expo`.
- Focus trap, Escape closes, click-outside closes, body scroll lock.

**`Toast`** (`components/ui/toast.tsx`)
- Position: top-right desktop, top-center mobile.
- Variants: success / warning / error / info / brand.
- Auto-dismiss 4s, pause on hover, swipe-to-dismiss on mobile.
- Structure: icon + title + description + optional action button.
- Enter: slide-in from right + fade, 300ms.
- Stack max 3, overflow collapses to `+N altri`.

**`SkeletonShimmer`** (`components/ui/skeleton.tsx` — polish existing)
- Background `surface-muted` with shimmer gradient ocra-tinted (≤4% opacity) traversing left → right, 1.8s loop.
- Reduced-motion fallback: pulse opacity instead of shimmer.

**`EmptyState`** (new)
- Centered, max-width 420px.
- Hero icon 48px in `brand-primary` muted.
- Title display serif 22px, description sans muted.
- Optional primary + secondary CTA.
- Presets: `no-data`, `no-results-search`, `error`, `coming-soon`.

**`Table`** (new unified primitive — `components/ui/table.tsx`)
- `density` prop: `compact | cozy | editorial`.
- Column config: `{ key, label, width, align, sortable, render }`.
- Row hover: `bg-surface-hover`.
- Selected row: `bg-brand-primary-subtle` + left indicator bar.
- Sticky header over `surface-page` with bottom border.
- Integrated empty state.
- Slot for pagination at the bottom.
- Density toggle UI (two icon-buttons, persisted per user in `localStorage` scoped by table id).
- Sort indicator: chevron with optional count.

### 4.4 Signature components

New namespace: `components/supplier/signature/`. Zero new runtime dependencies — `motion/react` is already present.

**`<CountUp />`**
- Animates from 0 (or previous value) to `value` on mount, triggered by `IntersectionObserver` when first visible.
- `ease-out-quart`, `tabular-nums` to prevent width jitter.
- Format options: `currency` (`€48.340`), `number` (`127`), `percent` (`18%`), `compact` (`€48.3k`).
- Optional `prefix` / `suffix` (e.g. `+` delta, `↗` arrow).
- Value transitions animate between values (no reset).
- `prefers-reduced-motion` → render final value immediately.
- Fires once on mount, not on every scroll.
- Props: `value`, `format`, `decimals`, `duration`, `delay`, `prefix`, `suffix`, `className`.

**`<PulseDot variant="live" />`**
- 8px dot + animated ring (2s loop, opacity 1 → 0, scale 1 → 2.2).
- Variants: `live` (green), `warning` (amber), `brand` (ocra).
- Optional sibling label.
- Auto-pauses on `document.visibilitychange` (hidden → paused).
- Reduced-motion fallback: static dot, no ring.
- Consumers: topbar live indicator, real-time order cards, notifications.

**`<Ticker items={...} speed={45} pauseOnHover />`**
- Horizontal infinite marquee. Items duplicated `×2` for seamless loop.
- `speed` is full-cycle seconds (default 45).
- Item shape: `{ label: string, value: string, icon?: ReactNode }`.
- Separator: 4px gold dot between items.
- Border top + bottom `border-subtle`.
- Left/right fade via `mask-image`.
- Reduced-motion fallback: static snapshot, no scrolling.
- Consumer: dashboard hero header (live KPI strip).

**`<CelebrationCheck size={32} />`**
- Gold circle (`bg-brand-highlight`) with dark checkmark.
- Spring bounce on mount (0.2 → 1.1 → 1.0) at 600ms `ease-spring`.
- Single pulse shadow ring on mount (not looped), 800ms.
- Consumers: order fulfilled, DDT signed, delivery confirmed.
- Mounted via toast or inline in an order row.
- Reduced-motion fallback: direct scale-in, no bounce.

**`<SerifGreeting name="Pastifici Rossi" />`**
- Layout: eyebrow label (`Buongiorno` / `Buon pomeriggio` / `Buonasera`) in mono 11px muted.
- Title: display serif 36px desktop / 28px mobile, `text-text-primary`.
- Trailing period `.` in `text-brand-primary` (signature mark).
- Optional subtitle: current date + time (`Martedì 16 aprile · h. 14:32`), updates every minute client-side.
- Greeting detected from local time on the client.
- Fade-in 600ms on mount.
- Consumers: dashboard landing, settings home.

**`<LiveStatus count={3} label="ordini in prep" />`**
- Composition: `PulseDot` + mono `count` + label.
- Variants: topbar compact, card banner.
- Hook `useSupabaseRealtimeCount` to auto-refresh.

File layout:

```
components/supplier/signature/
├── count-up.tsx
├── pulse-dot.tsx
├── ticker.tsx
├── celebration-check.tsx
├── serif-greeting.tsx
├── live-status.tsx
└── index.ts
```

## 5. Quality passes

### 5.1 Accessibility (WCAG AA)

- Contrast: body ≥ 4.5:1, large text ≥ 3:1, UI ≥ 3:1. `#A87535` on `#FBF8F1` = 4.52:1 ✓. Gold `#E8B547` on ivory = 2.1:1 ✗ → never use gold text on ivory; only dark-on-gold badges.
- Focus visible on every interactive element via `--focus-ring`.
- Keyboard paths: sidebar (Tab + Enter), command palette ⌘K, Escape closes modals and drawers.
- ARIA: `aria-label` on icon-only buttons, `aria-current="page"` on active nav, `role="status"` on live indicator, `aria-live="polite"` on toast container.
- Reduced-motion: every animation has a static fallback.

### 5.2 Performance

- Motion restricted to `transform` and `opacity` only (no layout-triggering properties).
- `CountUp` uses `requestAnimationFrame`, not per-frame `setState`.
- `PulseDot` uses CSS animation (GPU), not JS.
- `Ticker` uses `will-change: transform` and `content-visibility: auto` when off-screen.
- Client boundaries deferred via dynamic import for `CommandPalette` and `NotificationBell`.
- Skeletons rendered on the server; no client JS on first paint.

### 5.3 Keyboard map

Documented in a `⌘/` help modal accessible from topbar and from `/supplier/impostazioni`.

- `⌘K` — command palette
- `Ctrl+B` — toggle sidebar
- `G D` — go dashboard, `G O` — go ordini, `G C` — go catalogo, `G K` — go clienti
- `N` — new order (contextual)
- `Esc` — close overlay

### 5.4 Responsive

- Breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
- Sidebar: hidden below `lg`, collapsible on `lg–xl`, expanded on `xl+`.
- Topbar: breadcrumbs hidden below `lg`; search trigger collapses to icon below `md`.
- Tables: overflow-x scroll below `md` with sticky first column.
- Mobile bottom nav preserved.

### 5.5 Testing

- Unit (vitest): `CountUp` format, `PulseDot` render, greeting time detection, `Table` density toggle.
- A11y (axe-core): `DashboardShell`, `Table`, `Modal`.
- Visual snapshot: Playwright screenshots per primitive state.
- E2E smoke (Playwright): dashboard load, sidebar toggle, command palette open/close, theme toggle persistence.

### 5.6 Manual verification checklist (exit criteria for Phase 1)

1. `/supplier/dashboard` in light: ivory surface, serif greeting with ocra period, animated counters, scrolling ticker, live pulse.
2. Same page in dark: `#09090F` surface, counters + pulse amplified, aggressive elevation on cards.
3. Sidebar expands and collapses smoothly at 250ms; tooltips in collapsed state; active indicator visible.
4. Topbar: editorial breadcrumb, `⌘K` search, smooth theme toggle.
5. Tables honor density toggle compact ↔ cozy and persist it across reloads.
6. Modal: focus trap works, Escape closes, motion at 300ms.
7. Toast: stacks, swipe-dismiss on mobile, auto-dismiss at 4s.
8. Command palette globally reachable via `⌘K`, full keyboard navigation.
9. With `prefers-reduced-motion`: no shimmer, no bounce, no pulse loop.
10. Keyboard-only: every page navigable, focus visible everywhere.
11. Mobile iOS: safe-area respected, bottom nav visible, drawer swipeable.
12. Lighthouse: performance ≥ 95, accessibility ≥ 95, best-practices ≥ 95.
13. Restaurant area untouched — smoke test on `/dashboard` confirms visual parity with pre-change state.

## 6. Hard rules preserved

1. Never modify `app/(app)/**` or any component exclusive to the restaurant area.
2. Never hardcode brand hex values in components — always pass through CSS variables so the same class renders carmine in the restaurant scope and ocra in the supplier scope.
3. Gold accent stays at ≤ 5% of any operational page; large yellow surfaces are out of bounds except for celebratory or onboarding contexts.
4. `prefers-reduced-motion` is honored on every motion primitive.
5. Semantic states (success / warning / error / info) remain independent of brand color.
6. No new runtime dependencies; reuse what is already installed.

## 7. Non-goals (Phase 1)

- Redesigning the command palette (existing, good enough for now).
- Rebuilding or restructuring dashboard content (Phase 2).
- Refactoring existing operational tables (Phase 3).
- Any page-level work beyond the shell and foundation primitives.

## 8. Deliverables

- Updated `app/globals.css` with the new motion, density, elevation, focus, and numeric-font tokens.
- Polished `CollapsibleSidebar`, `DarkTopbar`, `SidebarDrawer`.
- Polished `Button`, `Input`, `Select`, `Badge`, `Toast`, `Card`, `Modal`, `Skeleton` primitives; new `EmptyState` and `Table` primitives.
- New `components/supplier/signature/*` module with the five signature components plus `LiveStatus`.
- A11y, performance, keyboard, and responsive passes.
- Test coverage on new primitives and signature components.
- Manual verification checklist passed.
- Restaurant area unchanged (smoke-tested).
