# GastroBridge Landing Page — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Approach:** Monochrome Forest — premium, minimal, high-impact

---

## Design Vision

A landing page that communicates luxury and technological innovation through a restrained, monochrome forest green palette. The page alternates between dark forest and light cream sections, creating natural rhythm. Animations are subtle and fluid throughout, with two cinematic "wow" moments: a parallax 3D dual section and split text reveal on the final CTA.

**Mood:** Luxury tech meets organic sophistication
**Target:** Both restaurateurs (buyers) and suppliers (sellers) in Ho.Re.Ca.
**Visual content:** Abstract geometric shapes, gradients, icons — no photography

---

## Palette & Typography

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Forest Dark | `#145238` | Hero/dark section backgrounds (matches existing `--color-forest-dark` in globals.css) |
| Forest | `#1B6B4A` | Primary brand, accents on light sections |
| Cream | `#FAF8F5` | Light section backgrounds, text on dark |
| Terracotta | `#C4520A` | CTA highlights on light backgrounds only |
| Terracotta Light | `#E8773A` | Terracotta variant for dark backgrounds (WCAG AA compliant) |
| Charcoal | `#1A1A1A` | Footer background |
| Cream/70 | `rgba(250,248,245,0.7)` | Secondary text on dark backgrounds |
| Forest/10 | `rgba(27,107,74,0.1)` | Borders, dividers on light backgrounds |

**Contrast notes:**
- Cream on Forest Dark: ~7:1 (passes WCAG AA)
- Terracotta Light `#E8773A` on Forest Dark: ~3.5:1 (passes AA for large text / decorative use)
- Terracotta `#C4520A` on Cream: 4.35:1 — use only for large text (labels >=0.875rem bold) or decorative icons. For small text, use Forest instead.

### Typography
| Element | Font | Weight | Size (desktop) |
|---------|------|--------|----------------|
| Headlines (H1) | DM Serif Display | 400 | ~5-6rem |
| Headlines (H2) | DM Serif Display | 400 | ~3-3.5rem |
| Body | Inter | 400 | 1rem-1.125rem |
| Labels/Micro | Inter | 600 | 0.875rem, uppercase, tracking wide |
| Numbers/Stats | DM Serif Display | 400 | ~3.5-4rem |

---

## Page Structure

```
┌─────────────────────────────────┐
│         NAVBAR (fixed)          │  glassmorphism, forest/80% + blur
├─────────────────────────────────┤
│         1. HERO                 │  forest dark bg, mesh gradient
│         full viewport           │
├─────────────────────────────────┤
│     2. SOCIAL PROOF / LOGOS     │  cream bg, marquee strip
├─────────────────────────────────┤
│      3. HOW IT WORKS            │  forest dark bg, 3 cards
├─────────────────────────────────┤
│    4. DUAL SECTION              │  cream left / forest right
│    (Ristoratori / Fornitori)    │  ★ parallax 3D wow moment
├─────────────────────────────────┤
│       5. STATS / NUMERI         │  cream bg, 4 counters
├─────────────────────────────────┤
│      6. TESTIMONIALS            │  forest dark bg, carousel
├─────────────────────────────────┤
│          7. FAQ                 │  cream bg, accordion
├─────────────────────────────────┤
│       8. CTA FINALE             │  forest dark bg, mesh gradient
│                                 │  ★ split text wow moment
├─────────────────────────────────┤
│          FOOTER                 │  charcoal bg
└─────────────────────────────────┘
```

---

## Section Details

### Navbar
- **Position:** Fixed top, z-50
- **Style:** `backdrop-blur-xl` on `forest/80%` background (glassmorphism)
- **Content:** Logo (left), nav links center, CTA button right ("Inizia Gratis")
- **Nav links:**
  | Label | href | Type |
  |-------|------|------|
  | Come Funziona | `#come-funziona` | Anchor scroll |
  | Per Chi | `#per-chi` | Anchor scroll |
  | Prezzi | `/pricing` | Page link |
  | FAQ | `#faq` | Anchor scroll |
- **Active state:** Anchor links highlight based on current scroll position (IntersectionObserver)
- **Scroll behavior:** Compacts on scroll (reduced height, more opaque background). Transition: smooth 300ms
- **Mobile:** Hamburger icon → full-screen overlay menu on forest dark background with staggered link animations

### Section 1: Hero
- **Layout:** `min-h-screen`, flex center, text-center
- **id:** `hero`
- **Background:** Forest dark `#145238` with animated mesh gradient (3-4 radial-gradient layers with CSS custom properties for position, animated via GSAP timeline ~20s loop. Mobile: static 2-layer gradient)
- **Content:**
  - Micro-badge: pill shape, `border border-cream/20`, text cream/70, "La piattaforma Ho.Re.Ca. #1 in Italia"
  - H1: "Tutti i tuoi fornitori. Un solo posto." — DM Serif Display, cream, ~5-6rem
  - Subtitle: "Confronta prezzi, scopri fornitori e gestisci ordini per la tua attivita." — Inter, cream/70
  - CTA group: Primary button (cream bg, forest text) + Secondary button (outline cream)
  - Stats bar: 3 inline qualitative stats separated by vertical dividers — "Nord Italia", "Gratis per Iniziare", "Supporto 24/7"
- **Animations:**
  - Mesh gradient: 3-4 radial-gradient layers, positions animated via GSAP timeline, ~20s loop. Mobile: static fallback
  - H1: GSAP SplitText, words reveal from bottom with stagger 0.05s, `ease: "power3.out"`, duration 1s
  - Badge: fade-in + slight slide-down, 0.3s delay
  - Subtitle: fade-in + slide-up, starts after H1 completes
  - CTAs: fade-in + slide-up, stagger 0.1s after subtitle
  - Stats: counter animation (0 → target number) triggered when scrolling past hero fold, duration 2s

### Section 2: Social Proof / Logos
- **id:** `social-proof`
- **Layout:** `py-16`, cream background
- **Content:**
  - Label: "Scelto da ristoranti e fornitori in tutta Italia" — uppercase, tracking-widest, forest/50
  - Logo strip: 6-8 geometric placeholder shapes (circles, rounded squares) in `forest/15`, arranged in infinite horizontal marquee
  - Bottom border: `1px solid forest/10`
- **Animations:**
  - Marquee: pure CSS, `animation: marquee 30s linear infinite`, duplicated children for seamless loop
  - Logos: base opacity 0.4, hover → opacity 1.0, transition 300ms
  - Section: fade-in on scroll entry (intersection observer or GSAP scrollTrigger)

### Section 3: How It Works
- **id:** `come-funziona`
- **Layout:** `py-24`, forest dark background. 3 cards in a row (desktop `grid-cols-3`, mobile stack)
- **Cards:** `border border-cream/10`, `bg-forest/lighter` (slightly lighter than section bg), `rounded-2xl`, `p-8`
  - Step number: cream/20 opacity, DM Serif Display, ~6rem, positioned as watermark behind content
  - Icon: geometric shape (hexagon/circle/triangle) in terracotta-light `#E8773A`, `w-12 h-12`
  - Title: cream, DM Serif Display, ~1.5rem
  - Description: cream/70, Inter
  - Steps: "Registrati e configura il profilo" → "Cerca, confronta prezzi e fornitori" → "Ordina e gestisci tutto in un posto"
- **Connector:** SVG horizontal line between cards (desktop only), forest/30 stroke, animated draw-on
- **Animations:**
  - Cards: staggered entry (slide-up + fade-in), stagger 0.15s, scrollTrigger
  - Connector line: SVG `strokeDashoffset` animation after cards enter, GSAP
  - Icons: subtle rotate-in on entry

### Section 4: Dual Section (Ristoratori / Fornitori) — WOW MOMENT 1
- **id:** `per-chi`
- **Layout:** Full width, `min-h-[80vh]`. Two halves side by side: left cream, right forest dark. Mobile: stacked vertically.
- **Left (Ristoratori):**
  - Background: cream
  - Label: "Per Ristoratori" — uppercase, tracking-wide, terracotta
  - H2: "Trova i migliori fornitori per la tua cucina" — DM Serif Display, forest
  - 3-4 bullets with geometric icons (forest): "Confronta prezzi in tempo reale", "Scopri fornitori verificati", "Ordina con un click", "Monitora consegne e spese"
  - CTA: "Registra il tuo Ristorante" — forest bg, cream text
- **Right (Fornitori):**
  - Background: forest dark
  - Label: "Per Fornitori" — uppercase, tracking-wide, terracotta-light `#E8773A`
  - H2: "Raggiungi centinaia di nuovi clienti" — DM Serif Display, cream
  - 3-4 bullets with geometric icons (cream): "Vetrina prodotti professionale", "Gestione ordini centralizzata", "Analytics e insights", "Crescita garantita"
  - CTA: "Diventa Fornitore" — cream bg, forest text
- **Animations (Parallax 3D):**
  - GSAP ScrollTrigger with `scrub: true`
  - Left half: `translateY` moves slightly faster than scroll (speed 1.1x)
  - Right half: `translateY` moves slightly slower (speed 0.9x), creating depth separation
  - Internal elements have 3 depth layers:
    - Layer 1 (labels): speed 1.2x
    - Layer 2 (headlines + bullets): speed 1.0x (base)
    - Layer 3 (icons): speed 0.8x
  - Creates a subtle but noticeable 3D floating effect as user scrolls through

### Section 5: Stats / Numeri
- **id:** `numeri`
- **Layout:** `py-20`, cream background. 4 stats in a row with vertical dividers (`border-r border-forest/10`)
- **Stats:**
  - "500+" — Ristoranti Attivi
  - "150+" — Fornitori Verificati
  - "10.000+" — Prodotti Disponibili
  - "98%" — Tasso di Soddisfazione
- **Style:** Number in DM Serif Display, ~3.5rem, forest. Label in Inter, forest/60
- **Animations:**
  - GSAP counter (scrollTrigger): numbers count from 0, duration 2.5s, `ease: "power2.out"`
  - Stagger entry from left, 0.1s between each stat

### Section 6: Testimonials
- **id:** `testimonianze`
- **Layout:** `py-24`, forest dark background. Single testimonial centered, max-width ~800px
- **Content:**
  - Decorative quotation marks: cream/10, DM Serif Display, ~8rem, positioned behind text
  - Quote text: cream, DM Serif Display italic, ~1.5-1.75rem, line-height relaxed
  - Author: name in cream (Inter, semibold), role + restaurant in cream/70 (Inter)
  - Navigation dots: 3-4 dots, `w-2 h-2`, terracotta-light `#E8773A` for active, cream/30 for inactive
- **Testimonials data (placeholder):**
  1. "GastroBridge ha rivoluzionato il modo in cui gestiamo i nostri fornitori. Risparmiamo ore ogni settimana." — Marco R., Chef Exec, Ristorante Esempio
  2. "Da quando usiamo la piattaforma, abbiamo aumentato i clienti del 40% in tre mesi." — Laura B., Fornitore, Azienda Esempio
  3. "Confrontare prezzi non e mai stato cosi semplice. Un must per ogni ristoratore." — Giuseppe T., Proprietario, Trattoria Esempio
- **Animations:**
  - Auto-rotate: 5s interval, pause on hover/focus
  - Transition: horizontal slide (GSAP, `xPercent`), crossfade, duration 0.6s
  - Dots: scale animation on active
- **Accessibility:**
  - Left/right arrow keys cycle testimonials
  - Auto-rotation uses `aria-live="polite"` region
  - Dots use `role="tablist"` / `role="tab"` / `role="tabpanel"` pattern
  - Pause button (cream/30, small, near dots) stops auto-rotation

### Section 7: FAQ
- **id:** `faq`
- **Layout:** `py-24`, cream background. Two columns (desktop): left 1/3 sticky title, right 2/3 accordion
- **Left column:**
  - H2: "Domande Frequenti" — DM Serif Display, forest
  - Subtitle: "Tutto quello che devi sapere per iniziare" — Inter, forest/60
  - `position: sticky; top: 8rem` (desktop only)
- **Right column (Accordion):**
  - 5-6 FAQ items, each:
    - Question row: Inter semibold, forest, with +/- icon in terracotta on the right
    - Answer: Inter, forest/80, revealed on expand
    - Divider: `border-b border-forest/10` between items
  - FAQ content (placeholder):
    1. "Come funziona GastroBridge?" — overview of the platform
    2. "Quanto costa?" — free tier + paid plans reference
    3. "Come mi registro come fornitore?" — registration flow
    4. "In quali zone e disponibile?" — Northern Italy, expanding
    5. "I pagamenti sono sicuri?" — Stripe security
    6. "Posso provare gratis?" — free trial info
- **Animations:**
  - Accordion: smooth height transition (`max-height` or GSAP `auto`), 400ms, ease out
  - Icon: rotates 45deg on open (+ becomes x)
  - Section fade-in on scroll

### Section 8: CTA Finale — WOW MOMENT 2
- **id:** `cta-finale`
- **Layout:** `py-32`, forest dark background with animated mesh gradient (same as hero, creates visual bookend)
- **Content:**
  - H2: "Il futuro della ristorazione inizia qui" — DM Serif Display, cream, ~4rem
  - Subtitle: "Unisciti a centinaia di professionisti Ho.Re.Ca. che stanno gia crescendo con noi." — Inter, cream/70
  - Two CTAs: "Registra il tuo Ristorante" (cream bg, forest text, large) + "Diventa Fornitore" (outline cream, large)
- **Animations (Split Text):**
  - H2 uses GSAP SplitText: each word reveals individually, sliding up from below with rotation
  - `stagger: 0.08s`, `duration: 0.8s`, `ease: "power4.out"`
  - `rotationX: 90` → `0` (words flip in from below, 3D feel)
  - ScrollTrigger: starts when section enters 80% of viewport
  - Mesh gradient: intensifies (opacity increases from 0.3 → 0.7) as user scrolls deeper into section
  - CTAs: fade-in after headline animation completes

### Footer
- **Layout:** `py-16`, charcoal `#1A1A1A` background. 4 columns (desktop), stacked (mobile)
- **Columns:**
  1. **Brand:** GastroBridge logo, 2-line description in cream/50, social icons (geometric style)
  2. **Piattaforma:** Come Funziona, Per Ristoratori, Per Fornitori, Prezzi
  3. **Risorse:** Centro Assistenza, Blog, API Documentation, Status
  4. **Legale:** Privacy Policy, Termini di Servizio, Cookie Policy, P.IVA
- **Bottom bar:** `border-t border-cream/10`, copyright text in cream/30
- **Style:** All text cream/50, hover → cream, transition 200ms. Links: Inter 0.875rem

---

## Animation Architecture

### GSAP Setup
- **Native scroll** — no ScrollSmoother. Native scroll preserves `position: sticky`, `position: fixed`, anchor links, and browser scroll restoration without compatibility issues.
- **ScrollTrigger:** Used for all scroll-based animations. Default trigger: `top 80%` of viewport. Anchor scroll uses `scrollTo` plugin with smooth easing.
- **SplitText:** Used in Hero H1 and CTA Finale H2
- **Responsive:** All GSAP animations use `matchMedia` for mobile adaptations (reduced motion, simpler parallax)

### Animation Hierarchy
1. **Always active:** Mesh gradient (CSS), Marquee (CSS)
2. **Scroll-triggered once:** Section entries, counter animations, split text reveals, SVG line draw
3. **Scroll-scrubbed:** Parallax 3D in dual section, mesh gradient intensity in CTA
4. **Interactive:** Hover states, accordion, testimonial navigation

### Performance
- `will-change: transform` only on parallax elements during scroll
- `prefers-reduced-motion: reduce` → disable all GSAP animations, show content immediately
- Lazy load sections below fold with intersection observer
- GSAP ScrollTrigger `invalidateOnRefresh: true` for resize handling

### Initial Load State
- All scroll-triggered elements start with `opacity: 0; transform: translateY(20px)` in CSS (not JS) so content is hidden even before GSAP hydrates, preventing FOUC
- Mesh gradient: static CSS radial-gradient fallback renders immediately; GSAP animation enhances on hydration
- Hero content animates on mount (not scroll-triggered), so it plays immediately after JS loads

---

## Component Structure

```
app/(marketing)/page.tsx          → sections composition
components/marketing/
  hero.tsx                        → Hero with mesh gradient + split text
  social-proof.tsx                → Logo marquee strip
  how-it-works.tsx                → 3-step cards with connector
  dual-section.tsx                → Ristoratori/Fornitori parallax 3D
  stats.tsx                       → Counter stats bar
  testimonials.tsx                → Carousel testimonials
  faq.tsx                         → Accordion FAQ
  cta-section.tsx                 → Final CTA with split text
components/layout/
  marketing-nav.tsx               → Glassmorphism navbar (update existing)
  footer.tsx                      → Charcoal footer (update existing)
lib/
  gsap-config.ts                  → GSAP plugin registration (ScrollTrigger, SplitText, ScrollToPlugin)
  animations.ts                   → Reusable animation presets (fadeInUp, splitReveal, etc.)
```

### Migration Notes
The following existing components are **replaced** by the redesign:
- `components/marketing/categories.tsx` → replaced by `dual-section.tsx`
- `components/marketing/hero.tsx` → rewritten from scratch
- `components/marketing/how-it-works.tsx` → rewritten from scratch
- `components/marketing/testimonials.tsx` → rewritten from scratch
- `components/marketing/cta-section.tsx` → rewritten from scratch
- `components/layout/marketing-nav.tsx` → updated (glassmorphism + new nav links)
- `components/layout/footer.tsx` → updated (4 columns, charcoal bg)

New components added: `social-proof.tsx`, `dual-section.tsx`, `stats.tsx`, `faq.tsx`

### Font Note
Body font renders as Inter (fallback) until Satoshi woff2 files are added to `public/fonts/`. Spacing values may need minor adjustment when Satoshi is activated.

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` (mobile) | Single column, stacked sections, no parallax 3D (flat layout), reduced font sizes, hamburger nav, simplified mesh gradient |
| `640-1024px` (tablet) | 2-col grid where applicable, lighter parallax, compact stats |
| `> 1024px` (desktop) | Full layout as designed, all animations active |

---

## Accessibility

- All animations respect `prefers-reduced-motion`
- Testimonial carousel has pause button and keyboard navigation
- FAQ accordion uses proper `aria-expanded`, `aria-controls`, `role="region"`
- CTA buttons have clear focus rings (cream outline, 2px offset)
- Color contrast: cream on forest dark passes WCAG AA (ratio ~7:1)
- Navbar mobile menu trapped focus
- Skip-to-content link hidden but accessible
