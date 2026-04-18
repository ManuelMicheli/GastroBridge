# Restaurant Area — Status Badge System Polish Pass

**Date:** 2026-04-18
**Area:** `app/(app)/**` (restaurant)
**Scope:** full status-system pass — badge primitive, tones, dots, celebratory check, relationship badge
**Intent:** bring supplier-area badge/status professionalism to restaurant area without changing its white/cream visual identity

---

## Why

Restaurant area has Linear-grade foundations (tokens, PageHeader, EmptyState, motion primitives, loading skeletons) but its status/badge story is inconsistent:

- `Badge` primitive exposes only generic `success|warning|info` variants and still references dead tokens (`forest-light`, `terracotta-light`, `sage-muted`).
- `lib/utils/constants.ts` holds a dead `ORDER_STATUS_COLORS` map pointing at `text-forest|text-sage|text-terracotta`.
- `app/(app)/ordini/_lib/bucketize.ts#statusColorClass` returns raw Tailwind (`bg-amber-500`, `bg-blue-500`, `bg-yellow-500`, `bg-red-500`) — bypasses design system, drifts from palette.
- Order detail page (`app/(app)/ordini/[id]/page.tsx`) renders status via generic `<Badge variant="info">` — loses per-status meaning.
- No micro-signal on live states (no pulse on `shipping`/`in_transit`, no celebratory signal on `delivered`). Supplier area has both (`PulseDot`, `CelebrationCheck`).
- Relationship status on `/fornitori` renders with ad-hoc strings — no unified pill.

Supplier area already demonstrates the target pattern: one meta map per status domain, one `StateBadge` primitive, `PulseDot` for live states, `CelebrationCheck` for terminal-ok states. Needs restaurant-area translation with white/cream coherent palette.

## Constraints

- Palette coherent with restaurant area (white `#FFFFFF` + cream `#FAFAFA` + carmine `#B91C3C` + bordeaux `#7B1F2E`). Soft tints `/50-15%`, ring 1px hairline, zero elevation.
- Supplier area `app/(supplier)/**` must NOT change visually. All new tokens scoped via `[data-area="restaurant"]`.
- WCAG AA contrast on every tone combo (≥ 4.5:1 body).
- `prefers-reduced-motion` respected on pulse + celebrate.
- No new external dependencies.
- Do not delete `components/supplier/signature/*` — supplier relies on them.

## Architecture

### Single source of truth

```
lib/orders/status-meta.ts
  ORDER_STATUS_META: Record<status, OrderStatusMeta>
  getOrderStatusMeta(status): OrderStatusMeta   // fallback-safe

lib/relationships/status-meta.ts
  RELATIONSHIP_STATUS_META: Record<status, RelationshipStatusMeta>
  getRelationshipStatusMeta(status): RelationshipStatusMeta

components/ui/status-dot.tsx
  <StatusDot tone size pulse />                 // aria-hidden, decorative

components/ui/order-status-badge.tsx
  <OrderStatusBadge status size showIcon celebrate />

components/ui/relationship-status-badge.tsx
  <RelationshipStatusBadge status size />

components/ui/celebration-check.tsx
  <CelebrationCheck size tone />                // palette-agnostic via tokens
```

### Deprecations

- `statusColorClass` in `app/(app)/ordini/_lib/bucketize.ts` — keep as thin wrapper delegating to `getOrderStatusMeta(status).tone`, mark `@deprecated`, remove after all call sites migrated.
- `ORDER_STATUS_COLORS` in `lib/utils/constants.ts` — remove entirely (no runtime usage found after migration).
- `Badge` primitive variants `success|warning|info` — kept; no breaking changes. Order-specific badges move to `<OrderStatusBadge>`.

### Tone tokens

New `--tone-*` variables under `[data-area="restaurant"]` in `app/globals.css`. Six tones: `neutral | amber | blue | brand | emerald | rose`. Each tone exposes `--tone-X-bg`, `--tone-X-fg`, `--tone-X-ring`.

Light mode values (hex/rgb):

| Tone | bg | fg | ring |
|---|---|---|---|
| neutral | `rgb(244 244 245)` zinc-100 | `rgb(82 82 91)` zinc-600 | `rgb(228 228 231)` zinc-200 |
| amber | `rgb(254 243 199)` amber-100 | `rgb(146 64 14)` amber-800 | `rgb(253 230 138)` amber-200 |
| blue | `rgb(219 234 254)` blue-100 | `rgb(29 78 216)` blue-700 | `rgb(191 219 254)` blue-200 |
| brand | `var(--color-brand-primary-subtle)` | `var(--color-brand-depth)` | `var(--color-brand-primary-border)` |
| emerald | `rgb(209 250 229)` emerald-100 | `rgb(4 120 87)` emerald-700 | `rgb(167 243 208)` emerald-200 |
| rose | `rgb(255 228 230)` rose-100 | `rgb(159 18 57)` rose-700 | `rgb(254 205 211)` rose-200 |

Dark mode (`.dark[data-area="restaurant"]`): bg uses `rgba(…, 0.12)`, fg brightened (`amber-300`, `blue-300`, `emerald-300`, `rose-300`), ring `rgba(…, 0.28)`. Brand dark uses existing `--color-brand-primary` (carmine-bright) + `--color-brand-depth` (bordeaux-glow).

**Token naming:** `--tone-*` kept bare (not wired to Tailwind `@theme` color families — accessed via inline `style`), while brand refs inside tone definitions use canonical `--color-brand-*` prefix (Tailwind v4 convention used across the project).

### Status → tone mapping

```ts
ORDER_STATUS_META = {
  draft:                          { label: "Bozza",           tone: "neutral" },
  pending:                        { label: "In attesa",       tone: "amber" },
  submitted:                      { label: "Inviato",         tone: "amber" },
  pending_confirmation:           { label: "Attesa conferma", tone: "amber" },
  pending_customer_confirmation:  { label: "Attesa cliente",  tone: "amber" },
  confirmed:                      { label: "Confermato",      tone: "blue" },
  preparing:                      { label: "In preparazione", tone: "brand" },
  packed:                         { label: "Imballato",       tone: "brand" },
  shipping:                       { label: "In spedizione",   tone: "brand", pulse: true },
  in_transit:                     { label: "In transito",     tone: "brand", pulse: true },
  shipped:                        { label: "Spedito",         tone: "brand", pulse: true },
  delivered:                      { label: "Consegnato",      tone: "emerald", terminal: "ok" },
  completed:                      { label: "Completato",      tone: "emerald", terminal: "ok" },
  cancelled:                      { label: "Annullato",       tone: "rose", terminal: "ko" },
  rejected:                       { label: "Rifiutato",       tone: "rose", terminal: "ko" },
  stock_conflict:                 { label: "Conflitto stock", tone: "rose" },
}

RELATIONSHIP_STATUS_META = {
  pending:   { label: "In attesa",  tone: "amber" },
  active:    { label: "Attiva",     tone: "emerald" },
  paused:    { label: "In pausa",   tone: "neutral" },
  rejected:  { label: "Rifiutata",  tone: "rose" },
  archived:  { label: "Archiviata", tone: "neutral" },
}
```

Unknown status falls back to `{ label: capitalize(status), tone: "neutral" }` — no crash, no console warn.

## Primitive APIs

### `<OrderStatusBadge>`

```tsx
type Size = "xs" | "sm" | "md";
type Props = {
  status: string;
  size?: Size;          // default "sm"
  showIcon?: boolean;   // default true — hide for ultra-dense rows
  celebrate?: boolean;  // default false — opt-in celebratory anim on mount for terminal:"ok"
  className?: string;
};
```

Markup:

```tsx
<span
  role="status"
  aria-label={`Stato: ${meta.label}`}
  data-tone={meta.tone}
  className="inline-flex items-center gap-1.5 rounded-full
             ring-1 ring-inset px-2 py-0.5
             text-[11px] font-medium tabular-nums tracking-tight"
  style={{
    background: `var(--tone-${meta.tone}-bg)`,
    color:      `var(--tone-${meta.tone}-fg)`,
    "--tw-ring-color": `var(--tone-${meta.tone}-ring)`,
  }}
>
  {showIcon && meta.pulse
    ? <PulseDotRestaurant tone={meta.tone} size={dotSize} />
    : showIcon ? <StatusDot tone={meta.tone} size={dotSize} aria-hidden /> : null}
  {celebrate && meta.terminal === "ok"
    ? <CelebrationCheck size={celebSize} tone="emerald" />
    : null}
  <span>{meta.label}</span>
</span>
```

Sizes:

| size | text | padding | dot | check |
|---|---|---|---|---|
| xs | 10px | `px-1.5 py-0` | 4 | 10 |
| sm | 11px | `px-2 py-0.5` | 6 | 12 |
| md | 12px | `px-2.5 py-1` | 7 | 14 |

### `<StatusDot>`

```tsx
type Tone = "neutral"|"amber"|"blue"|"brand"|"emerald"|"rose";
type Props = { tone: Tone; size?: number; pulse?: boolean; className?: string };
```

Decorative, `aria-hidden`. Background = `var(--tone-${tone}-fg)` (saturated version). When `pulse`, renders absolute-positioned ring with `pulse-ring` keyframe (already defined in `globals.css` per supplier realtime work). Hidden on `motion-reduce`.

### `<RelationshipStatusBadge>`

Same render shape as `<OrderStatusBadge>` but reads from `RELATIONSHIP_STATUS_META`. Kept as separate component for domain clarity (different label set, different status keys, different semantic).

### `<CelebrationCheck>` (restaurant variant)

Duplicated from `components/supplier/signature/celebration-check.tsx` into `components/ui/celebration-check.tsx`, parameterized by `tone` prop:

```tsx
type Tone = "emerald" | "brand";
type Props = { size?: number; tone?: Tone; className?: string };
```

Uses `var(--tone-${tone}-bg)` for fill and `var(--tone-${tone}-fg)` for icon stroke. `useReducedMotion()` → skips bounce, keeps static circle + check. Motion uses `motion/react` (already in project) with spring overshoot `[0.34, 1.56, 0.64, 1]` matching supplier feel.

## Migration plan

### Wave 1 — Foundation (no visible UI change)

1. `app/globals.css` — add `--tone-*` light + dark tokens scoped under `[data-area="restaurant"]`
2. `lib/orders/status-meta.ts` (new) — map + `getOrderStatusMeta`
3. `lib/relationships/status-meta.ts` (new) — map + `getRelationshipStatusMeta`
4. `components/ui/status-dot.tsx` (new)
5. `components/ui/order-status-badge.tsx` (new)
6. `components/ui/relationship-status-badge.tsx` (new)
7. `components/ui/celebration-check.tsx` (new, duplicated from supplier)

### Wave 2 — Ordini core

8. `app/(app)/ordini/_lib/bucketize.ts` — `statusColorClass` delegates to meta tone, marked `@deprecated`
9. `app/(app)/ordini/_components/timeline-row.tsx` — replace raw dot with `<StatusDot>` or `<OrderStatusBadge size="xs" showIcon>` (decide during implementation; keep row height identical)
10. `app/(app)/ordini/_components/status-chips.tsx` — replace inline raw dot with `<StatusDot tone>` reading from meta
11. `app/(app)/ordini/_components/order-peek.tsx` — swap status pill with `<OrderStatusBadge size="md">`
12. `app/(app)/ordini/orders-client.tsx` — verify no leftover raw usage
13. `app/(app)/ordini/[id]/page.tsx` — swap hero badge + each split status card with `<OrderStatusBadge size="md" celebrate={status==="delivered"}>`
14. `app/(app)/ordini/[id]/conferma/confirm-client.tsx` — same treatment

### Wave 3 — Peripheral

15. `app/(app)/analytics/_components/recent-orders-log.tsx` — dot → `<StatusDot>` (keep ultra-dense row)
16. `app/(app)/carrello/_components/receipt-supplier-block.tsx` — swap split status badge
17. `app/(app)/fornitori/suppliers-client.tsx` + `_components/supplier-row.tsx` + `_components/supplier-detail-pane.tsx` — `<RelationshipStatusBadge>`
18. `app/(app)/cataloghi/confronta/_components/compare-header.tsx` — "best price" pill stays as bespoke inline element (not a status, skip migration to keep scope tight)

### Wave 4 — Cleanup

19. `lib/utils/constants.ts` — remove `ORDER_STATUS_COLORS` (dead after Waves 2-3)
20. `app/(app)/ordini/_lib/bucketize.ts` — if zero external imports of `statusColorClass` remain, remove the wrapper

## A11y

- `<OrderStatusBadge>` and `<RelationshipStatusBadge>` use `role="status" aria-label="Stato: {label}"` so screen readers announce meaning, not color.
- `<StatusDot>` is `aria-hidden="true"` — pure decoration; the accessible label is on the parent badge / row.
- `PulseDot` ring animation: `motion-reduce:hidden` on the ring, static dot remains.
- `<CelebrationCheck>` respects `useReducedMotion()` — skips scale bounce, keeps static icon.
- Focus states: any `<button>` wrapping badges (filter chips, action buttons) retains `focus-visible:ring-2 ring-[var(--color-brand-primary)]` from existing button styles.
- Contrast: all light-mode tone pairs hit ≥ 4.5:1 (validated manually). Dark-mode pairs use brightened fg (300 range) against 12% alpha bg — validated separately.

## Edge cases

- Unknown status string → fallback meta with `tone: "neutral"` and capitalized label. No crash, no console noise.
- Status changes mid-render (realtime refresh) → badge re-renders with new meta; `celebrate` prop driven by caller so it fires once at mount of detail page and does not loop on re-render (motion/react `initial/animate` semantics).
- Split status inside order detail differs from parent order status — each split renders its own badge; they are independent.
- Dark mode toggle mid-session → CSS vars swap automatically via `.dark[data-area="restaurant"]`, no JS.
- SSR: no hooks in primitive rendering (StatusDot, OrderStatusBadge). `CelebrationCheck` uses `"use client"` because of `motion/react` and `useReducedMotion`. Safe across boundaries.

## Non-goals

- No realtime row flash on restaurant orders list — already handled by restaurant realtime provider elsewhere, out of badge scope.
- No promotion of `components/supplier/signature/*` to shared — supplier keeps its own. Restaurant gets its own palette-coherent duplicates.
- No kanban view for restaurant ordini — user is the buyer, not the ops operator.
- No refactor of filter chip layout — only swap the dot primitive inside.
- No change to `<Badge>` generic primitive — new primitives are additive.
- No change to supplier-area code, tokens, or components.

## Verification (manual, post-implementation)

1. `/ordini` light: badge carmine soft on `preparing`, pulse dot brand on `shipping`, emerald tint on `delivered`, rose on `cancelled`.
2. `/ordini` dark: same semantics, alpha-tinted bg, brightened fg.
3. `/ordini/[id]` on a delivered order: celebration check appears once on mount, stays static after.
4. `/fornitori`: paused → neutral pill, active → emerald, pending → amber, rejected → rose.
5. `/supplier/*` — zero visual delta (spot check dashboard + ordini + magazzino).
6. OS `prefers-reduced-motion` ON: no pulse rings, no bounce on check.
7. Build passes, TypeScript strict clean, zero new a11y warnings in console.

## File count

- 7 new files (4 primitives + 3 meta/dup)
- 13 edited files (tokens + migrations + cleanup)
- 2 deletions (`ORDER_STATUS_COLORS`, `statusColorClass` if fully unused)

Total: 20 files touched. Additive-dominant. One migration per file, no cross-file coupling in edits.
