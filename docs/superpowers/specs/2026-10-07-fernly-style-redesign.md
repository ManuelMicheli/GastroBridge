# Fernly-style redesign of the GastroBridge logged-in app

Date: 2026-10-07 · Scope: restaurant area `app/(app)` first, shared shell with the
supplier area `app/(supplier)`, light pass on `app/(auth)`. Marketing is untouched.

Reference: a 47 s screen recording of a project-management demo dashboard
("built in HTML, CSS & GSAP"). Only its layout, visual language, components and
motion are reproduced. Its name, logo, copy and the presentation chrome of the
video (green blurred backdrop, rounded window frame, caption pills, watermark,
title cards) are not.

Everything below was measured from the frames (1280×720 @ 60 fps; the app
window spans ≈1066 px of the video, i.e. the real UI was rendered at ≈1440 px and
downscaled by ≈0.74 — all px values below are already converted back to 1440).

## 1. Layout

```
┌ canvas #ECEEED ───────────────────────────────────────────────┐
│ ┌ sidebar panel ┐ ┌ topbar panel (search · icons · user) ──┐ │
│ │ logo          │ └─────────────────────────────────────────┘ │
│ │ MENU          │ ┌ content panel ──────────────────────────┐ │
│ │  items        │ │ H1 + subtitle            [+ primary][○]│ │
│ │ GENERAL       │ │ KPI × 4                                 │ │
│ │  items        │ │ cards grid                              │ │
│ │ promo card    │ │                                         │ │
│ └───────────────┘ └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

* Three floating panels on a light grey canvas, 8–10 px gaps, radius 22–24 px.
  Sidebar ≈ 232 px wide, topbar ≈ 64 px tall, the content panel scrolls.
* Panels are a hair lighter than the canvas (`#F5F6F6` on `#ECEEED`); cards inside
  the content panel are white, radius 18–20 px, almost no border and a very soft
  two-layer shadow (`0 1px 2px rgba(16,24,20,.04), 0 8px 24px rgba(16,24,20,.04)`).
* Generous whitespace: card padding 20–24 px, grid gap 14–16 px.

## 2. Typography

* Geometric grotesk — Plus Jakarta Sans (loaded with `next/font/google`, exposed as
  `--font-app`, applied to the app + auth roots only). Weights 400/500/600/700.
* H1 ≈ 30 px / 600 / -0.02em, near-black `#0B0F0D`; subtitle 14 px muted `#6B7270`.
* Card titles 17 px / 500. Big KPI numbers 44–48 px / 500, `tabular-nums`.
* Uppercase group labels ("MENU", "GENERAL") 11 px / 500 / +0.08em, muted.
* Timer digits ≈ 40 px / 500 tabular, colon separators slightly lower contrast.

## 3. Colour

The reference uses one accent hue in 6 steps (shown green). GastroBridge maps the
same steps onto its own brand:

| step | role in reference | Bordeaux (restaurant default) |
|---|---|---|
| 950 | timer / promo background | `#2A0710` |
| 900 | hero KPI gradient end, "dark" bar, gauge in-progress | `#3A0B16` |
| 800 | primary pill button, active chip | `#5A1424` → `#6B1F2E` (marketing bordeaux) |
| 600 | "mid" bar, gauge completed, chart line | `#B91C3C` (restaurant carmine) |
| 400 | "light" bar, donut 3rd slice | `#E5798D` |
| 100 | column drop highlight, subtle chips | `#FBE7EB` |
| 50  | nav active tint, inputs focus halo | `#FDF3F5` |

Accent presets (Impostazioni → Aspetto): **Bordeaux** (restaurant default),
**Forest** (homage to the original GastroBridge green `#1B6B4A`), **Ocean**,
**Ambra**; supplier area default **Ocra** (existing ocra/avorio identity). They are
CSS custom properties keyed by `data-accent` on the area root and `<html>`,
persisted in `localStorage` (`gb-accent:<area>`) and applied by an inline script
before paint. Changing accent adds a short-lived `.accent-transition` class so
every colour property tweens for 450 ms.

Semantic colours never follow the accent: success `#16A34A`, warning `#D97706`,
danger `#DC2626` (status pills: Completed = green outline, In progress = amber
outline, Pending = red outline — 1 px border, 10 % tint fill, 11 px text, radius 6).

Hatching for "not yet / pending": `repeating-linear-gradient(135deg, #9CA3A0 0 1.5px,
transparent 1.5px 7px)` on `#F4F5F5`.

Dark texture on hero/timer/promo cards: concentric fine arcs centred
off the bottom-right corner (`repeating-radial-gradient` 1 px lines every 14 px at
6–8 % white) over a 135° gradient 900→950.

## 4. Components

* **Sidebar**: logo (rounded-square mark + wordmark), uppercase group labels,
  items 40 px tall with 20 px line icons; active = semibold near-black text +
  accent icon + 3×24 px accent bar glued to the panel's left edge (slides between
  items). Count badge: dark accent pill, white 11 px tabular text. Bottom promo card
  (dark textured, phone icon in a white circle, 2-line title, muted subtitle, full
  width pill button).
* **Topbar**: pill search field (≈ 340 px, white, magnifier, placeholder, `⌘ K`
  hint chip); right: two 40 px white circular icon buttons (mail, bell) with a red
  6 px dot, avatar initials circle (peach pastel) + name / email.
* **Page header**: H1 + subtitle left; right a filled pill button (accent 800,
  white "+" icon, 40 px tall, 20 px padding) and an outline pill (1.5 px near-black
  border).
* **KPI card**: title 15 px, top-right 32 px circle with ↗ (outlined on white
  cards; white filled with dark arrow on the hero). Big number. Caption row: tiny
  outlined chip "5 ▲" + muted text. Hero card = accent gradient + subtle texture,
  white text, slightly raised shadow.
* **Pill bar chart**: 7 fully rounded bars per weekday, width ≈ 62 % of slot;
  past days filled dark / mid / light accent, future days hatched; small white pill
  label with value above the highlighted bar connected by a 1 px stem; weekday
  initials below in muted 12 px.
* **Reminder card**: muted title, big accent-ink headline (22 px/600, 2 lines),
  muted meta line, full-width filled pill CTA with icon at the bottom.
* **List card**: 36 px colourful icon tiles + title + "Due date: …" muted line;
  header with small outline "+ New" pill.
* **People list**: 40 px pastel initials avatar, name, "Working on **x**", status
  pill on the right.
* **Gauge**: 180° arc, 34 px stroke with round caps; segments completed (600),
  in progress (900), pending hatched; big % in the centre (40 px) + muted caption;
  legend of dots below.
* **Chips**: rounded group container (white, 4 px padding) with chips 32 px; the
  active one is a filled accent pill that slides between chips.
* **Kanban**: transparent columns with header (status dot, name, count right),
  white cards radius 14: tag chips (tinted), priority flag, title, progress bar
  (accent, 4 px), meta (clock + due, comments) and avatar stack.
* **Team card**: centred 64 px pastel avatar with presence dot, name, role, dept
  chip, two stats, workload bar with %, two pill buttons (outline + filled).
* **Drawer**: right side floating panel (8 px inset, radius 24, ≈ 400 px), close
  "×" in a light circle, centred avatar, meta row, 3 stat tiles, list, two pill
  buttons.
* **Calendar**: month grid of rounded day cells (light grey fill for days in month),
  coloured event chips (tinted bg + coloured text), today with accent ring and a
  filled day-number circle; right column: "OGGI · SABATO" eyebrow, big date,
  timeline cards with a coloured left rail; "Coming up" list with date badges.
* **Analytics**: segmented pills 7D/30D/90D (active filled accent) + outline
  "Export CSV"; KPI cards with value, ▲/▼ delta line, full-bleed sparkline with
  soft fill; area chart (2 px accent line + gradient fill, dashed grey previous,
  dashed vertical guide + ringed dot + dark accent tooltip); donut with gaps,
  total in the centre; contribution heatmap (5 tints, "Less … More").
* **Modal**: 420 px white panel, radius 20, title 20 px; inputs 44 px tall,
  radius 12, light grey fill, accent ring on focus; right-aligned Cancel (outline
  pill) / primary (filled pill). Backdrop: `rgba(20,24,22,.28)` + 4 px blur.
* **Toast**: dark accent pill, bottom-centre, white 13 px text, 10×18 padding.

## 5. Motion (measured)

| interaction | measurement | implementation |
|---|---|---|
| page enter | cards fade from 0, rise ≈14 px, blur 6→0; 420–480 ms; stagger ≈70 ms; `cubic-bezier(.22,1,.36,1)` | CSS keyframes `f-rise` with `--i` index |
| title | characters revealed left→right over ≈250 ms | CSS clip-path reveal |
| count-up | from 0 on mount, ≈1.1 s, ease-out (power2/3); on data change tweens from previous value | rAF hook `useCountUp` |
| bars | grow from baseline, ≈600 ms, 60 ms stagger, ease-out | CSS `scaleY` keyframes |
| gauge | arc sweeps with the % counting, ≈1.1 s | SVG dash-offset driven by the same tween |
| modal open | backdrop ≈120 ms; panel scale .96→1 + fade ≈260 ms; content stagger 40 ms | `motion` AnimatePresence |
| modal close | ≈120 ms fade | same |
| toast | rise 12 px + fade ≈200 ms, bottom-centre, ≈2.6 s | sonner, restyled |
| sidebar indicator | bar slides between items ≈350 ms | absolutely positioned bar, CSS transform transition |
| kanban drag | card lifts (scale 1.03, rotate ≈2.5°, big soft shadow); target column tinted accent-50 with 1.5 px accent border; others reflow ≈250 ms | dnd-kit DragOverlay + sortable transitions |
| filter FLIP | removed cards fade/scale out ≈150 ms; remaining glide ≈500 ms power3.out; active chip pill slides ≈300 ms | `motion` layout + AnimatePresence popLayout |
| drawer | backdrop ≈200 ms; panel slides from right ≈380 ms; content stagger ≈50 ms after 150 ms | `motion` |
| calendar month | grid fades out ≈120 ms, new month fades/slides in ≈250 ms | `motion` AnimatePresence keyed by month |
| analytics range | KPIs re-count, chart morphs | count-up tween + Recharts animation |
| accent change | all colours cross-fade ≈450 ms, toast "Accento impostato su …" | `.accent-transition` class |

All motion is disabled under `prefers-reduced-motion: reduce` (final state shown
immediately, count-ups jump to the value).

## 6. Mapping to GastroBridge (honest data only)

| reference | GastroBridge |
|---|---|
| Total / Ended / Running / Pending projects | Spesa del mese (hero, € net/gross toggle) · Ordini del mese · In consegna · In attesa di conferma (derived from order + split statuses) |
| Project Analytics bars | "Andamento spesa" — spend per weekday of the current week, days not yet elapsed hatched |
| Reminders | "Prossima consegna" (earliest `order_splits.expected_delivery_date` ≥ today) with CTA to the order; fallback CTA "Nuovo ordine" |
| Project list | "Fornitori" — the restaurant's catalogs with product counts |
| Team collaboration | "Ordini recenti" with supplier name + status pill |
| Project progress gauge | "Budget mensile" — delivered/closed spend vs open spend vs remaining budget (`restaurants.monthly_budget_eur`), empty state CTA when no budget |
| Time tracker | "Fine mese" live countdown to month end with spend vs budget — no fake timer |
| Tasks kanban | Restaurant: read-only status board of orders; Supplier: full drag kanban of order splits (existing actions) |
| Team page | Fornitori / Cataloghi card grid with source + category chips, FLIP filter, side drawer |
| Calendar | "Calendario consegne" (restaurant, from expected delivery dates); supplier deliveries calendar |
| Analytics | spend / orders / avg ticket / suppliers KPIs with sparklines, spend vs previous period area chart, spend by category donut, orders-per-day heatmap, top suppliers |
| Settings | sub-nav for every existing section + new "Aspetto" (accent + week start) |
| Download app promo | "GastroBridge su iPhone & Android" — shown only when the PWA install prompt is available |

Left out: help menu item (no help center exists), meeting/time-tracking actions,
fictional assignees/comments on order cards, the fake "risparmio stimato"
(previously `spend × 8 %`) which is not real data.
