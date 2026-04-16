# Restaurant Foundations — Plan A1: Tokens + Motion Primitives

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `app/globals.css` with the Linear-grade typography scale, spacing, radii, elevation, and motion primitives defined in the spec, and migrate the restaurant scope to use them. Supplier scope must remain visually unchanged.

**Architecture:** Pure additive CSS in `@theme` + new motion CSS variables + `prefers-reduced-motion` guard. No JS changes in this plan — primitives only. Tailwind 4 auto-exposes `@theme` tokens as utilities.

**Tech Stack:** Tailwind CSS 4 (`@theme` in `globals.css`), CSS variables, `motion` v12 (Framer Motion rebranded — used in later plans, not here).

**Spec reference:** `docs/superpowers/specs/2026-04-16-restaurant-foundations-awwwards-design.md` §4.

---

## File Structure

**Files modified:**
- `app/globals.css` — extend `@theme` block with new tokens, add motion primitives + reduced-motion handler

**Files created:**
- `app/(app)/_internal/_smoke/page.tsx` — local-only smoke page rendering all new typography utilities, motion primitives, and elevation tokens. Used for visual verification, removed at end.

**No files deleted.** No business logic touched.

---

## Task 1: Add typography scale tokens to `@theme`

**Files:**
- Modify: `app/globals.css` (the `@theme {}` block, add after `--font-mono`)

- [ ] **Step 1: Add typography size tokens**

Open `app/globals.css`. After the existing `--font-mono: "JetBrains Mono", monospace;` line inside `@theme {}`, insert this block:

```css
  /* =========================================
     Typography Scale (Linear-grade)
     - text-display-* for hero numbers + page H1s
     - text-title-*   for section headers
     - text-body / text-body-sm for content
     - text-caption   for eyebrow labels (uppercase, tracked)
     - text-mono      for numbers/IDs/codes
     ========================================= */
  --text-display-2xl: 48px;
  --text-display-2xl--line-height: 52px;
  --text-display-2xl--letter-spacing: -0.011em;
  --text-display-2xl--font-weight: 600;

  --text-display-xl: 36px;
  --text-display-xl--line-height: 40px;
  --text-display-xl--letter-spacing: -0.011em;
  --text-display-xl--font-weight: 600;

  --text-display-lg: 28px;
  --text-display-lg--line-height: 32px;
  --text-display-lg--letter-spacing: -0.011em;
  --text-display-lg--font-weight: 600;

  --text-title-lg: 20px;
  --text-title-lg--line-height: 28px;
  --text-title-lg--letter-spacing: -0.006em;
  --text-title-lg--font-weight: 600;

  --text-title-md: 16px;
  --text-title-md--line-height: 24px;
  --text-title-md--letter-spacing: -0.006em;
  --text-title-md--font-weight: 600;

  --text-title-sm: 14px;
  --text-title-sm--line-height: 20px;
  --text-title-sm--letter-spacing: -0.006em;
  --text-title-sm--font-weight: 600;

  --text-body: 14px;
  --text-body--line-height: 20px;

  --text-body-sm: 13px;
  --text-body-sm--line-height: 18px;

  --text-caption: 12px;
  --text-caption--line-height: 16px;
  --text-caption--letter-spacing: 0.04em;
  --text-caption--font-weight: 500;

  --text-mono: 13px;
  --text-mono--line-height: 18px;
  --text-mono--font-weight: 500;
```

- [ ] **Step 2: Add spacing scale tokens (Tailwind 4 understands `--spacing-*`)**

Right after the typography block, add:

```css
  /* =========================================
     Spacing Scale — Linear-comfortable density
     Page gutter: 24 mobile / 32 tablet / 48 desktop
     Section vertical rhythm: 32 / 48 / 72
     ========================================= */
  --spacing-0\.5: 2px;
  --spacing-1: 4px;
  --spacing-1\.5: 6px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-14: 56px;
  --spacing-18: 72px;
  --spacing-24: 96px;
```

(Tailwind 4 already has the same scale by default. We re-declare to lock the values — explicit > implicit.)

- [ ] **Step 3: Add radii tokens**

Right after spacing block, add:

```css
  /* =========================================
     Radii — md default for primitives, lg for cards
     ========================================= */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-pill: 9999px;
```

- [ ] **Step 4: Add elevation shadow tokens**

After radii, add:

```css
  /* =========================================
     Elevation — hairline + soft shadows.
     Linear rule: borders never bolder than 1px.
     ========================================= */
  --elevation-card: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(0, 0, 0, 0.06);
  --elevation-card-hover: 0 4px 12px rgba(0, 0, 0, 0.08);
  --elevation-modal: 0 24px 48px rgba(0, 0, 0, 0.12);

  --elevation-card-dark: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 8px 32px rgba(0, 0, 0, 0.4);
  --elevation-card-hover-dark: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 12px 40px rgba(0, 0, 0, 0.5);
  --elevation-modal-dark: 0 32px 64px rgba(0, 0, 0, 0.6);
```

- [ ] **Step 5: Add motion primitive tokens**

After elevation, add:

```css
  /* =========================================
     Motion Primitives (5 total)
     prefers-reduced-motion: reduce  →  durations zeroed below
     ========================================= */
  --duration-page: 240ms;
  --duration-spring: 280ms;

  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  /* --ease-out-expo already defined above */

  --motion-stagger: 40ms;
```

(`--motion-fade`, `--motion-lift`, `--motion-page` are *combinations* of duration+ease+property — defined as utility classes outside `@theme` in Step 7, since CSS vars cannot hold transition shorthand portably across all engines.)

- [ ] **Step 6: Run dev server, verify no CSS parse errors**

Run:

```bash
pnpm dev
```

Expected: server starts, no `Error: failed to parse` from globals.css. Open `http://localhost:3000/dashboard` — page renders identical to before (we have not consumed new tokens yet).

Stop server (`Ctrl+C`) before next step.

- [ ] **Step 7: Add motion utility classes + reduced-motion guard**

Outside the `@theme` block, *after* the existing `body { }` rule and before the `[data-area="supplier"]` block, insert:

```css
/* =========================================
   Motion utility classes
   Composed transitions for hover/lift/fade.
   Used directly in components via className.
   ========================================= */
.motion-fade {
  transition: opacity 200ms var(--ease-out-expo);
}

.motion-lift {
  transition: transform 200ms var(--ease-out-expo);
}

.motion-lift:hover {
  transform: translateY(-1px);
}

.motion-spring {
  transition-duration: var(--duration-spring);
  transition-timing-function: var(--ease-spring);
}

/* Stagger helper — applied to children of a list using
   --stagger-index inline style (set in JSX). */
.motion-stagger > * {
  animation-delay: calc(var(--stagger-index, 0) * var(--motion-stagger));
}

/* Reduced motion: zero out everything. */
@media (prefers-reduced-motion: reduce) {
  .motion-fade,
  .motion-lift,
  .motion-spring,
  .motion-stagger > * {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
```

- [ ] **Step 8: Commit token + motion additions**

```bash
git add app/globals.css
git commit -m "feat(restaurant-foundations): add Linear-grade typography, spacing, radii, elevation, motion tokens"
```

---

## Task 2: Add `[data-area="restaurant"]` polish overrides

The restaurant scope already exists. We add explicit semantic-token mappings for the new elevation tokens and ensure `text-caption` defaults to `--color-brand-depth` color when used inside the restaurant scope.

**Files:**
- Modify: `app/globals.css` (inside `[data-area="restaurant"]` light block AND dark block)

- [ ] **Step 1: Map elevation tokens inside restaurant light scope**

Inside `[data-area="restaurant"] {` block, after the `--glow-brand-strong` line, add:

```css
  /* Phase A foundations — elevation bound to scope */
  --elevation-card-active: var(--elevation-card);
  --elevation-card-active-hover: var(--elevation-card-hover);
  --elevation-modal-active: var(--elevation-modal);
```

- [ ] **Step 2: Map elevation tokens inside restaurant dark scope**

Inside `.dark[data-area="restaurant"], [data-area="restaurant"].dark, [data-area="restaurant"] .dark {` block, after the `--glow-brand-strong` line, add:

```css
  /* Phase A foundations — elevation bound to scope (dark) */
  --elevation-card-active: var(--elevation-card-dark);
  --elevation-card-active-hover: var(--elevation-card-hover-dark);
  --elevation-modal-active: var(--elevation-modal-dark);
```

- [ ] **Step 3: Add eyebrow caption helper inside restaurant scope (both)**

After the elevation lines in the **light** block, add:

```css
  --caption-color: var(--color-brand-depth);
```

After the elevation lines in the **dark** block, add:

```css
  --caption-color: var(--color-brand-depth);
```

(Same variable, different value — bound to brand-depth which is already scope-aware.)

- [ ] **Step 4: Verify restaurant + supplier still render unchanged**

```bash
pnpm dev
```

Open in browser:
- `http://localhost:3000/dashboard` (restaurant) — unchanged visually.
- `http://localhost:3000/supplier/dashboard` (supplier) — unchanged visually.

Stop dev server.

- [ ] **Step 5: Commit scope polish**

```bash
git add app/globals.css
git commit -m "feat(restaurant-foundations): wire elevation + caption-color into restaurant scope"
```

---

## Task 3: Build smoke verification page

Build a local-only page that renders every new typography utility, every elevation, and every motion primitive. Used to visually verify Phase A foundations before adoption. Deleted at end of Plan A1.

**Files:**
- Create: `app/(app)/_internal/_smoke/page.tsx`

- [ ] **Step 1: Create smoke page**

Create file `app/(app)/_internal/_smoke/page.tsx` with this content:

```tsx
export const dynamic = "force-static";

export default function FoundationsSmokePage() {
  return (
    <div className="px-6 py-10 space-y-12">
      <header>
        <p
          className="uppercase mb-2"
          style={{
            fontSize: "var(--text-caption)",
            lineHeight: "var(--text-caption--line-height)",
            letterSpacing: "var(--text-caption--letter-spacing)",
            fontWeight: "var(--text-caption--font-weight)",
            color: "var(--caption-color)",
          }}
        >
          Phase A — Foundations
        </p>
        <h1
          style={{
            fontSize: "var(--text-display-lg)",
            lineHeight: "var(--text-display-lg--line-height)",
            letterSpacing: "var(--text-display-lg--letter-spacing)",
            fontWeight: "var(--text-display-lg--font-weight)",
          }}
        >
          Token + motion smoke
        </h1>
        <p
          className="mt-2 text-text-secondary"
          style={{
            fontSize: "var(--text-body-sm)",
            lineHeight: "var(--text-body-sm--line-height)",
            maxWidth: "60ch",
          }}
        >
          Internal verification page. All Linear-grade tokens render here once.
          Delete after Plan A1 ships.
        </p>
      </header>

      {/* Typography scale */}
      <section>
        <h2 style={{ fontSize: "var(--text-title-md)", lineHeight: "var(--text-title-md--line-height)", fontWeight: 600 }}>
          Typography scale
        </h2>
        <div className="mt-4 space-y-3">
          <p style={{ fontSize: "var(--text-display-2xl)", lineHeight: "var(--text-display-2xl--line-height)", fontWeight: 600, letterSpacing: "var(--text-display-2xl--letter-spacing)" }}>display-2xl 48/52</p>
          <p style={{ fontSize: "var(--text-display-xl)", lineHeight: "var(--text-display-xl--line-height)", fontWeight: 600, letterSpacing: "var(--text-display-xl--letter-spacing)" }}>display-xl 36/40</p>
          <p style={{ fontSize: "var(--text-display-lg)", lineHeight: "var(--text-display-lg--line-height)", fontWeight: 600, letterSpacing: "var(--text-display-lg--letter-spacing)" }}>display-lg 28/32</p>
          <p style={{ fontSize: "var(--text-title-lg)", lineHeight: "var(--text-title-lg--line-height)", fontWeight: 600 }}>title-lg 20/28</p>
          <p style={{ fontSize: "var(--text-title-md)", lineHeight: "var(--text-title-md--line-height)", fontWeight: 600 }}>title-md 16/24</p>
          <p style={{ fontSize: "var(--text-title-sm)", lineHeight: "var(--text-title-sm--line-height)", fontWeight: 600 }}>title-sm 14/20</p>
          <p style={{ fontSize: "var(--text-body)", lineHeight: "var(--text-body--line-height)" }}>body 14/20 — quick brown fox</p>
          <p style={{ fontSize: "var(--text-body-sm)", lineHeight: "var(--text-body-sm--line-height)" }}>body-sm 13/18 — secondary text</p>
          <p style={{ fontSize: "var(--text-mono)", lineHeight: "var(--text-mono--line-height)", fontFamily: "var(--font-mono)" }}>mono 13/18 — 1234567890 ABCDEF</p>
        </div>
      </section>

      {/* Elevation */}
      <section>
        <h2 style={{ fontSize: "var(--text-title-md)", lineHeight: "var(--text-title-md--line-height)", fontWeight: 600 }}>
          Elevation
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-6">
          <div className="rounded-xl p-6" style={{ background: "var(--color-surface-card)", boxShadow: "var(--elevation-card-active)", border: "1px solid var(--color-border-subtle)" }}>
            <p style={{ fontSize: "var(--text-body-sm)" }}>elevation-card</p>
          </div>
          <div className="motion-lift rounded-xl p-6" style={{ background: "var(--color-surface-card)", boxShadow: "var(--elevation-card-active-hover)", border: "1px solid var(--color-border-subtle)" }}>
            <p style={{ fontSize: "var(--text-body-sm)" }}>card-hover (hover me)</p>
          </div>
          <div className="rounded-xl p-6" style={{ background: "var(--color-surface-card)", boxShadow: "var(--elevation-modal-active)", border: "1px solid var(--color-border-subtle)" }}>
            <p style={{ fontSize: "var(--text-body-sm)" }}>elevation-modal</p>
          </div>
        </div>
      </section>

      {/* Motion */}
      <section>
        <h2 style={{ fontSize: "var(--text-title-md)", lineHeight: "var(--text-title-md--line-height)", fontWeight: 600 }}>
          Motion primitives
        </h2>
        <div className="mt-4 flex flex-wrap gap-4">
          <button
            className="motion-fade rounded-md px-4 py-2 text-white"
            style={{ background: "var(--color-brand-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            motion-fade (hover)
          </button>
          <button
            className="motion-lift rounded-md px-4 py-2 text-white"
            style={{ background: "var(--color-brand-primary)" }}
          >
            motion-lift (hover)
          </button>
          <div
            className="motion-spring rounded-md px-4 py-2"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border-subtle)", fontSize: "var(--text-body-sm)" }}
          >
            motion-spring (instant — see in modals)
          </div>
        </div>

        <div className="mt-6 motion-stagger">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="motion-fade rounded-md px-3 py-2 mb-2"
              style={{
                background: "var(--color-surface-hover)",
                fontSize: "var(--text-body-sm)",
                ["--stagger-index" as string]: i,
                animation: "fadeUp 240ms var(--ease-out-expo) both",
                animationDelay: `calc(${i} * var(--motion-stagger))`,
              }}
            >
              stagger row {i + 1}
            </div>
          ))}
        </div>
      </section>

      {/* Brand color sample */}
      <section>
        <h2 style={{ fontSize: "var(--text-title-md)", lineHeight: "var(--text-title-md--line-height)", fontWeight: 600 }}>
          Brand color (scope-bound)
        </h2>
        <div className="mt-4 flex gap-2 items-center">
          <div className="h-10 w-10 rounded-md" style={{ background: "var(--color-brand-primary)" }} />
          <div className="h-10 w-10 rounded-md" style={{ background: "var(--color-brand-primary-hover)" }} />
          <div className="h-10 w-10 rounded-md" style={{ background: "var(--color-brand-depth)" }} />
          <div className="h-10 w-10 rounded-md" style={{ background: "var(--color-brand-primary-subtle)" }} />
        </div>
      </section>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server, verify smoke page renders**

```bash
pnpm dev
```

Open `http://localhost:3000/_internal/_smoke`.

Expected:
- All typography rows render at correct sizes.
- 3 elevation cards visible, middle one lifts on hover.
- Motion primitives render: fade button, lift button, spring placeholder.
- Stagger rows animate in with 40ms delay between each on first paint.
- Brand color swatches show carmine `#B91C3C` (light) or `#E84560` (dark).

If anything doesn't render, **stop and debug** before proceeding.

Stop dev server.

- [ ] **Step 3: Commit smoke page**

```bash
git add "app/(app)/_internal/_smoke/page.tsx"
git commit -m "chore(restaurant-foundations): add internal smoke page for token verification"
```

---

## Task 4: Update body font fallback note + verify Inter renders the new scale

The spec assumes Satoshi but `app/layout.tsx` uses Inter as fallback. The new typography scale uses display sizes (28-48px) — verify Inter handles them with the `-0.011em` tracking gracefully (it does, but this is a verification step, not a code change).

**Files:**
- Read only: `app/layout.tsx`

- [ ] **Step 1: Visual verification on smoke page**

Run dev server.

```bash
pnpm dev
```

Open `http://localhost:3000/_internal/_smoke` in light mode AND dark mode (use the existing theme toggle in the topbar).

Expected:
- Display sizes look crisp, not airy or pinched.
- Tracking is tight on display sizes.
- Caption tracking is wide (`+4%`).
- Mono row uses JetBrains Mono.

If `display-xl` or `display-2xl` look too thin, weight 600 may need bumping to 700 — note in commit message but do NOT change in this plan (out of scope: spec says 600).

Stop dev server.

- [ ] **Step 2: Verify supplier area looks unchanged**

Run dev server.

```bash
pnpm dev
```

Open `http://localhost:3000/supplier/dashboard`. Compare visually to expectation: ocra brand colors, no carmine bleed, no typography changes.

If anything looks off (e.g., a card lost its shadow, a button looks different), the elevation or token additions broke supplier scope. **Stop and debug.**

Stop dev server.

- [ ] **Step 3: No commit needed — verification only.**

---

## Task 5: Delete smoke page (cleanup before plan close)

Smoke page is internal verification only. Removed before merge.

**Files:**
- Delete: `app/(app)/_internal/_smoke/page.tsx` (and parent `_internal/_smoke` + `_internal` directories if empty)

- [ ] **Step 1: Delete smoke page and parent dirs**

```bash
rm "app/(app)/_internal/_smoke/page.tsx"
rmdir "app/(app)/_internal/_smoke"
rmdir "app/(app)/_internal"
```

- [ ] **Step 2: Verify nothing else references it**

```bash
git grep -n "_internal/_smoke" || echo "no refs"
```

Expected: `no refs`.

- [ ] **Step 3: Verify dev still builds**

```bash
pnpm dev
```

Open `http://localhost:3000/dashboard`. Renders identically to baseline.

Stop dev server.

- [ ] **Step 4: Commit cleanup**

```bash
git add -A
git commit -m "chore(restaurant-foundations): remove internal smoke page (Plan A1 verification done)"
```

---

## Task 6: Final build + verification

- [ ] **Step 1: Run full Next.js build**

```bash
pnpm build
```

Expected: build completes with **0 errors** and **0 new warnings** vs. baseline. TypeScript passes. ESLint passes.

If build fails, debug before proceeding.

- [ ] **Step 2: Smoke test all restaurant routes load**

```bash
pnpm start &
SERVER_PID=$!
sleep 3
for route in dashboard cerca fornitori cataloghi ordini carrello analytics impostazioni; do
  echo "--- /$route ---"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:3000/$route"
done
kill $SERVER_PID
```

Expected: every route returns 200 (or 307 redirect to login if not authenticated, both ok).

- [ ] **Step 3: No commit — verification only.**

---

## Verification checklist (Plan A1 complete)

- [x] `app/globals.css` has typography scale, spacing, radii, elevation, motion tokens.
- [x] Restaurant scope wires elevation + caption color.
- [x] Supplier area renders unchanged.
- [x] Motion utility classes (`motion-fade`, `motion-lift`, `motion-spring`, `motion-stagger`) declared.
- [x] `prefers-reduced-motion` zeroes all motion primitives.
- [x] Smoke page deleted.
- [x] Build green.

When all boxes ticked, Plan A1 is done. Move to Plan A2.

---

## Out of scope (deferred to later plans)

- Refining `components/ui/*` to use the new tokens — Plan A2.
- Adding new primitives (EmptyState, ErrorState, PageHeader, etc.) — Plan A2.
- Sidebar/topbar refinement — Plan A3.
- Page transitions via `template.tsx` — Plan A3.
- 8 page-level loading.tsx skeletons — Plan A4.
- WCAG audit — Plan A4.
