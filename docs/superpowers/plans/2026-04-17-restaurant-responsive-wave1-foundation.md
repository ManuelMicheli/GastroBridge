# Restaurant Responsive — Wave 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fluid token foundation and 3 mobile primitives (BottomSheet, StickyActionBar, BottomNav) inside `[data-area="restaurant"]` scope. Supplier area stays untouched.

**Architecture:** Additive CSS in `app/globals.css` (clamp() typography, fluid spacing, container query utilities, density vars, safe-area). Three new React primitives in `components/ui/` and `components/dashboard/` using existing `motion/react` patterns. Zero edits to base `@theme` tokens — supplier inherits unchanged.

**Tech Stack:** Tailwind 4 (`@theme` in CSS), Next.js 15 + React 19, motion/react (Framer), lucide-react icons, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-04-17-restaurant-mobile-responsive-design.md`

**Verification:** No test framework installed. Each task ends with `npm run build` to catch type/syntax errors. Visual verification deferred to Wave 4.

---

## File Structure

| File                                                 | Purpose                                                  | Action  |
|------------------------------------------------------|----------------------------------------------------------|---------|
| `app/globals.css`                                    | Fluid tokens, container query utilities, density vars    | Modify  |
| `components/ui/bottom-sheet.tsx`                     | Mobile bottom-sheet modal alternative                    | Create  |
| `components/ui/sticky-action-bar.tsx`                | Fixed bottom CTA bar with safe-area padding              | Create  |
| `components/dashboard/bottom-nav.tsx`                | Mobile-only bottom navigation (5 actions)                | Create  |

---

## Task 1: Fluid Typography Tokens

**Files:**
- Modify: `app/globals.css` (inside `[data-area="restaurant"]` light scope, line ~447, AND inside dark scope line ~508)

- [ ] **Step 1: Read current restaurant scope tokens**

Read `app/globals.css` lines 447-555 to confirm current `[data-area="restaurant"]` block structure.

- [ ] **Step 2: Add fluid typography overrides to restaurant light scope**

Insert at end of `[data-area="restaurant"] {` block (just before the closing `}` near line 499):

```css
  /* =========================================
     Fluid typography (mobile-first responsive)
     Scales smoothly 320→1440px viewport.
     Body/caption/mono stay fixed (readability anchor).
     ========================================= */
  --text-display-2xl: clamp(32px, 4.5vw + 16px, 64px);
  --text-display-2xl--line-height: 1.08;
  --text-display-xl: clamp(28px, 3vw + 16px, 44px);
  --text-display-xl--line-height: 1.12;
  --text-display-lg: clamp(22px, 2vw + 14px, 32px);
  --text-display-lg--line-height: 1.18;
  --text-title-lg: clamp(18px, 1vw + 14px, 22px);
  --text-title-md: clamp(15px, 0.5vw + 13px, 17px);
```

Add the SAME block also inside the dark scope `.dark[data-area="restaurant"], [data-area="restaurant"].dark, [data-area="restaurant"] .dark {` block (just before its closing `}` near line 554).

- [ ] **Step 3: Build to verify no syntax errors**

Run: `npm run build`
Expected: `✓ Compiled successfully` — no CSS parse errors.

If build fails with CSS errors, check unescaped colons in clamp() arguments.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
feat(restaurant-responsive): fluid typography tokens (Wave 1.1)

Override --text-display-* and --text-title-* with clamp() inside
[data-area="restaurant"] scope (light + dark). Body/caption/mono
unchanged for readability. Supplier area untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fluid Spacing + Page-level Tokens

**Files:**
- Modify: `app/globals.css` (inside `[data-area="restaurant"]` light scope only — these are theme-agnostic)

- [ ] **Step 1: Add fluid spacing tokens to restaurant light scope**

Insert at end of `[data-area="restaurant"] {` block (after the typography block from Task 1):

```css
  /* =========================================
     Fluid spacing — page chrome scales with viewport
     ========================================= */
  --page-gutter: clamp(16px, 4vw, 48px);
  --section-gap: clamp(24px, 5vw, 72px);
  --card-pad: clamp(16px, 2.5vw, 24px);
  --page-max-width: min(1440px, 100%);

  /* Safe-area insets (iOS notch / home indicator) */
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
feat(restaurant-responsive): fluid spacing + safe-area tokens (Wave 1.2)

--page-gutter, --section-gap, --card-pad use clamp() for fluid scaling.
--safe-bottom/top read env(safe-area-inset-*) for iOS notch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Container Query Utility Classes + Density Adaptive Vars

**Files:**
- Modify: `app/globals.css` (after `.motion-stagger` block, around line 290 — global utility classes, not scoped)

- [ ] **Step 1: Add container query utility classes**

Insert after the reduced-motion media query (around line 301, after `.motion-stagger > *` rules close):

```css
/* =========================================
   Container Query Utilities (Wave 1 — responsive foundation)
   Apply to wrapper elements that should drive child layout.
   Use cq-* responsive classes inside via @container queries.
   ========================================= */
.cq-shell {
  container-type: inline-size;
  container-name: shell;
}

.cq-section {
  container-type: inline-size;
  container-name: section;
}

.cq-card {
  container-type: inline-size;
  container-name: card;
}

/* Density adaptive — row height + cell padding switch via container query.
   Default = cozy (44px touch). Compact (36px) only on wider containers. */
[data-area="restaurant"] {
  --row-active: var(--row-cozy);
  --cell-pad-active: var(--cell-pad-cozy);
}

@container card (min-width: 521px) {
  [data-area="restaurant"] {
    --row-active: var(--row-compact);
    --cell-pad-active: var(--cell-pad-compact);
  }
}

@container section (min-width: 521px) {
  [data-area="restaurant"] {
    --row-active: var(--row-compact);
    --cell-pad-active: var(--cell-pad-compact);
  }
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
feat(restaurant-responsive): container query utilities + density vars (Wave 1.3)

.cq-shell, .cq-section, .cq-card utility classes opt elements into
container query context. Density vars resolve to cozy (44px touch)
by default, compact (36px) when parent container ≥ 521px.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: BottomSheet Primitive

**Files:**
- Create: `components/ui/bottom-sheet.tsx`

- [ ] **Step 1: Create BottomSheet component**

Write to `components/ui/bottom-sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Snap height: "auto" (content), "half" (50vh), "full" (90vh) */
  snap?: "auto" | "half" | "full";
  /** Show drag handle (default true) */
  showHandle?: boolean;
}

const snapHeights = {
  auto: "auto",
  half: "50vh",
  full: "90vh",
};

/**
 * BottomSheet — mobile-first drawer modal.
 * Slides up from bottom, supports swipe-to-dismiss, safe-area aware.
 * Use as alternative to Modal on viewports < md.
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
  snap = "auto",
  showHandle = true,
}: BottomSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
        >
          <motion.div
            className={cn(
              "w-full bg-white rounded-t-2xl shadow-elevated overflow-hidden",
              "pb-[var(--safe-bottom)]",
              className
            )}
            style={{ maxHeight: snapHeights[snap] }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                <div className="h-1 w-10 rounded-full bg-sage-muted" />
              </div>
            )}
            {title && (
              <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-sage-muted/40">
                <h2 className="text-lg font-semibold text-charcoal font-body">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-sage-muted/50 transition-colors focus-ring"
                  aria-label="Chiudi"
                >
                  <X className="h-5 w-5 text-sage" />
                </button>
              </div>
            )}
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: snap === "auto" ? "75vh" : undefined }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Build to verify TypeScript types**

Run: `npm run build`
Expected: PASS — no type errors. If `motion/react` PanInfo import fails, fall back to importing from `framer-motion` (check `package.json` for installed name).

- [ ] **Step 3: Commit**

```bash
git add components/ui/bottom-sheet.tsx
git commit -m "$(cat <<'EOF'
feat(restaurant-responsive): BottomSheet primitive (Wave 1.4)

Mobile-first drawer modal. Slides from bottom, swipe-to-dismiss
threshold (120px offset or 500 velocity), safe-area aware bottom
padding, ESC + backdrop close. Snap variants: auto/half/full.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: StickyActionBar Primitive

**Files:**
- Create: `components/ui/sticky-action-bar.tsx`

- [ ] **Step 1: Create StickyActionBar component**

Write to `components/ui/sticky-action-bar.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  /** When true, only renders on viewports < md (mobile). Default true. */
  mobileOnly?: boolean;
  /** Optional left-side content (e.g., total summary) */
  leading?: ReactNode;
}

/**
 * StickyActionBar — fixed bottom CTA container with safe-area inset.
 * Used for /carrello checkout, /ordini detail actions, /cerca add-to-cart.
 * Hides on md+ by default unless mobileOnly={false}.
 */
export function StickyActionBar({
  children,
  className,
  mobileOnly = true,
  leading,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "border-t border-sage-muted/60 bg-white/95 backdrop-blur-md",
        "pb-[var(--safe-bottom)]",
        mobileOnly && "md:hidden",
        className
      )}
      role="toolbar"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {leading && <div className="flex-1 min-w-0">{leading}</div>}
        <div className={cn("flex items-center gap-2", !leading && "flex-1 justify-end")}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/ui/sticky-action-bar.tsx
git commit -m "$(cat <<'EOF'
feat(restaurant-responsive): StickyActionBar primitive (Wave 1.5)

Fixed bottom CTA bar with safe-area-inset-bottom padding. Optional
leading slot (totals/summary) + action slot. Mobile-only by default
(hidden md+). Uses backdrop-blur for content-aware overlay.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: BottomNav Chrome (Mobile-only Navigation)

**Files:**
- Read first: `components/dashboard/sidebar.tsx` (to mirror nav item structure)
- Create: `components/dashboard/bottom-nav.tsx`

- [ ] **Step 1: Read existing sidebar for restaurant nav structure**

Read `components/dashboard/sidebar.tsx` to identify the 5 primary restaurant routes (dashboard, cerca, carrello, ordini, account/impostazioni) and the icon names used. Confirm icon library is `lucide-react`.

- [ ] **Step 2: Create BottomNav component**

Write to `components/dashboard/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, ShoppingCart, Package, User } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  /** Match prefix instead of exact path */
  prefix?: boolean;
}

const items: NavItem[] = [
  { href: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { href: "/cerca", label: "Cerca", Icon: Search, prefix: true },
  { href: "/carrello", label: "Carrello", Icon: ShoppingCart },
  { href: "/ordini", label: "Ordini", Icon: Package, prefix: true },
  { href: "/impostazioni", label: "Account", Icon: User },
];

interface BottomNavProps {
  /** Optional cart item count for badge */
  cartCount?: number;
}

/**
 * BottomNav — mobile-only fixed bottom navigation for restaurant area.
 * Hidden on md+. 5 primary routes: dashboard, cerca, carrello, ordini, account.
 * Active state: brand-primary fill icon + 3px top accent border.
 */
export function BottomNav({ cartCount }: BottomNavProps) {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.prefix) return pathname?.startsWith(item.href) ?? false;
    return pathname === item.href;
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden",
        "border-t border-sage-muted/60 bg-white/95 backdrop-blur-md",
        "pb-[var(--safe-bottom)]"
      )}
      aria-label="Navigazione principale"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = isActive(item);
          const showBadge = item.href === "/carrello" && cartCount && cartCount > 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1",
                  "min-h-[56px] px-2 pt-2 pb-1.5 transition-colors",
                  "focus-ring",
                  active ? "text-[color:var(--color-brand-primary)]" : "text-sage hover:text-charcoal"
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-[color:var(--color-brand-primary)]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative">
                  <item.Icon
                    className="h-5 w-5"
                    fill={active ? "currentColor" : "none"}
                    strokeWidth={active ? 1.5 : 1.75}
                  />
                  {showBadge && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--color-brand-primary)] text-white text-[10px] font-semibold flex items-center justify-center"
                      aria-label={`${cartCount} articoli nel carrello`}
                    >
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium tracking-tight leading-none">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: PASS — no type errors, `usePathname` import OK from `next/navigation`.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/bottom-nav.tsx
git commit -m "$(cat <<'EOF'
feat(restaurant-responsive): BottomNav primitive (Wave 1.6)

Mobile-only fixed bottom navigation with 5 primary routes
(dashboard, cerca, carrello, ordini, impostazioni). Active state
fills icon + 3px top accent. Optional cart count badge. Hidden md+.
Safe-area-inset-bottom respected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wave 1 Verification

**Files:**
- None modified (verification only)

- [ ] **Step 1: Final build check**

Run: `npm run build`
Expected: PASS — full successful build with all Wave 1 changes integrated.

- [ ] **Step 2: Verify no supplier regression in CSS**

Run: `git diff main..HEAD -- app/globals.css`
Confirm visually that:
- All token additions are inside `[data-area="restaurant"]` blocks (light + dark)
- No edits to base `@theme` block (lines 8-253)
- No edits to `[data-area="supplier"]` blocks (lines 314-436)

- [ ] **Step 3: List new files**

Run: `git diff main..HEAD --name-only --diff-filter=A`
Expected output:
```
components/dashboard/bottom-nav.tsx
components/ui/bottom-sheet.tsx
components/ui/sticky-action-bar.tsx
docs/superpowers/specs/2026-04-17-restaurant-mobile-responsive-design.md
docs/superpowers/plans/2026-04-17-restaurant-responsive-wave1-foundation.md
```

- [ ] **Step 4: Wave 1 done — handoff to Wave 2**

Wave 1 ships foundation tokens and primitives but does NOT wire them into any page yet. Pages still render with old static tokens because no component class consumes the new fluid values directly — they take effect when consumed (Wave 2+).

Next: write `docs/superpowers/plans/2026-04-17-restaurant-responsive-wave2-chrome.md` per spec Layer 3 (Chrome Mobile).

---

## Out of Scope (this plan)

- Wave 2 chrome layout (sidebar drawer, mobile topbar, command palette mobile, bottom-nav wiring)
- Wave 3 per-route audit
- Wave 4 cross-browser/viewport verification
- Visual regression testing (no infrastructure exists; manual Wave 4)
- Storybook/Playwright setup
