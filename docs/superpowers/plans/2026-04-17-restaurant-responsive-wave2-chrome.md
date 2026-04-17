# Restaurant Responsive — Wave 2 Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Wave 1 fluid foundation into app shell and improve existing mobile chrome (SidebarDrawer, DarkMobileNav, DarkTopbar, CommandPalette) for flawless mobile experience.

**Architecture revision:** Wave 1 created `components/dashboard/bottom-nav.tsx` but `components/dashboard/mobile/dark-mobile-nav.tsx` already exists and is wired into `DashboardShell`. Wave 2 DELETES the redundant component and instead enhances the shared `DarkMobileNav` + `SidebarDrawer` with restaurant-aware behavior (cart badge, swipe-close, safe-area, active-fill). Shared infra = no supplier regression if scope-checked.

**Tech Stack:** Next.js 15, motion/react, Tailwind 4, TypeScript strict, existing `useCart` hook.

**Spec:** `docs/superpowers/specs/2026-04-17-restaurant-mobile-responsive-design.md`

---

## File Structure

| File                                               | Action                                                   |
|----------------------------------------------------|----------------------------------------------------------|
| `components/dashboard/bottom-nav.tsx`              | DELETE (redundant, never wired)                          |
| `app/globals.css`                                  | Add `.safe-area-pb` + `.safe-area-pt` utility classes    |
| `components/dashboard/mobile/dark-mobile-nav.tsx`  | Cart badge support + active-fill + real safe-area        |
| `components/dashboard/mobile/sidebar-drawer.tsx`   | Enable swipe-close for restaurant + safe-area universal  |
| `components/dashboard/shell.tsx`                   | Wrap in `cq-shell` + apply fluid `--page-gutter`         |
| `components/dashboard/command-palette/command-palette.tsx` | Full-screen mobile variant (< md)              |
| `app/(app)/layout.tsx`                             | MOBILE_NAV swap /cataloghi → /carrello + pass cart count |

---

## Task 1: Delete Redundant BottomNav

**Files:**
- Delete: `components/dashboard/bottom-nav.tsx`

- [ ] **Step 1: Verify component is unused**

Run: Grep for `BottomNav` across codebase to confirm no imports exist.

- [ ] **Step 2: Delete file**

Run: `git rm components/dashboard/bottom-nav.tsx`

- [ ] **Step 3: Build verify**

Run: `npm run build`
Expected: PASS — no broken imports.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(restaurant-responsive): drop redundant BottomNav (Wave 2.1)

Wave 1 created BottomNav but DarkMobileNav already handles this role
and is wired into DashboardShell. Dropping the unused duplicate.
Wave 2 enhances DarkMobileNav instead.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Global Safe-Area Utility Classes

**Files:**
- Modify: `app/globals.css` (after container query utilities block)

- [ ] **Step 1: Add safe-area utility classes**

Insert after the `@container section (min-width: 521px)` block from Wave 1 Task 3:

```css
/* =========================================
   Safe-area utilities (iOS notch/home indicator)
   Used by fixed bottom chrome (mobile nav, sticky action bars).
   ========================================= */
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.safe-area-pt {
  padding-top: env(safe-area-inset-top, 0px);
}

.safe-area-px {
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
```

- [ ] **Step 2: Build verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
feat(responsive): safe-area utility classes (Wave 2.2)

.safe-area-pb/pt/px expose env(safe-area-inset-*) as Tailwind-compatible
utilities. Needed because DarkMobileNav was referencing non-existent
.safe-area-pb class.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: DarkMobileNav Enhanced

**Files:**
- Modify: `components/dashboard/mobile/dark-mobile-nav.tsx`

- [ ] **Step 1: Read current implementation**

Read `components/dashboard/mobile/dark-mobile-nav.tsx` to confirm interface shape.

- [ ] **Step 2: Rewrite component with cart badge + active-fill**

Replace entire file contents with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";
import { resolveIcon } from "../icons";

export type MobileNavItem = {
  href: string;
  label: string;
  iconName: string;
  /** Show cart count badge on this item */
  badgeCount?: number;
};

type Props = {
  items: MobileNavItem[];
};

export function DarkMobileNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 lg:hidden bg-surface-sidebar/95 backdrop-blur-xl border-t border-border-subtle z-40 safe-area-pb"
      aria-label="Navigazione principale"
    >
      <div className="flex items-stretch justify-around min-h-[56px]">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = resolveIcon(item.iconName);
          const showBadge =
            typeof item.badgeCount === "number" && item.badgeCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 px-2 py-1.5 transition-colors focus-ring",
                isActive ? "text-accent-green" : "text-text-tertiary"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-accent-green"
                  aria-hidden="true"
                />
              )}
              <span className="relative">
                <Icon
                  className="h-5 w-5"
                  fill={isActive ? "currentColor" : "none"}
                  strokeWidth={isActive ? 1.5 : 1.75}
                />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-green text-surface-base text-[10px] font-semibold flex items-center justify-center"
                    aria-label={`${item.badgeCount} elementi`}
                  >
                    {item.badgeCount! > 99 ? "99+" : item.badgeCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Build verify**

Run: `npm run build`
Expected: PASS — `MobileNavItem` type extension adds optional field, no breaking changes.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/mobile/dark-mobile-nav.tsx
git commit -m "$(cat <<'EOF'
feat(mobile-nav): cart badge + active-fill + real safe-area (Wave 2.3)

DarkMobileNav now supports optional badgeCount per item (cart use case),
active state fills icon + 3px top accent bar, aria-current=page for a11y.
Fixed safe-area-pb class now resolves (added in Wave 2.2).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: SidebarDrawer Swipe-Close Universal + Safe-Area

**Files:**
- Modify: `components/dashboard/mobile/sidebar-drawer.tsx`

- [ ] **Step 1: Enable swipe-close for both areas + apply safe-area universally**

Edit the pointer handlers and drawer className. Replace the supplier-gated handlers:

Find:
```tsx
function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    if (!isSupplier) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent<HTMLElement>) {
    if (!isSupplier) return;
```

Replace with (drop the `isSupplier` gate):
```tsx
function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent<HTMLElement>) {
```

(Note: leave the guard for restaurant removed — swipe works for both areas now.)

Find the drawer className:
```tsx
className={cn(
              "fixed left-0 top-0 bottom-0 w-72 bg-surface-sidebar border-r border-border-subtle z-50 flex flex-col lg:hidden",
              isSupplier &&
                "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            )}
```

Replace with:
```tsx
className={cn(
              "fixed left-0 top-0 bottom-0 w-72 bg-surface-sidebar border-r border-border-subtle z-50 flex flex-col lg:hidden",
              "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            )}
```

Also update the backdrop blur intensity for consistency (both areas get the stronger blur now):

Find:
```tsx
className={cn(
              "fixed inset-0 z-40 lg:hidden",
              isSupplier
                ? "bg-surface-overlay backdrop-blur-xl"
                : "bg-surface-overlay backdrop-blur-sm",
            )}
```

Replace with:
```tsx
className="fixed inset-0 z-40 lg:hidden bg-surface-overlay backdrop-blur-xl"
```

- [ ] **Step 2: Remove unused `isSupplier` if now dead**

Check if `isSupplier` is referenced anywhere else in the file. If not, remove the line:
```tsx
const isSupplier = role === "supplier";
```

(Keep if still used e.g. for role-specific label; current file uses it only for gated behaviors that we just removed.)

- [ ] **Step 3: Build verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/mobile/sidebar-drawer.tsx
git commit -m "$(cat <<'EOF'
feat(mobile-nav): universal swipe-close + safe-area on sidebar drawer (Wave 2.4)

Previously restaurant drawer had no swipe-to-close and no safe-area
padding — only supplier got the premium UX. Unified both paths so
restaurant users get the same mobile polish.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: DashboardShell Fluid Gutter + Container Context

**Files:**
- Modify: `components/dashboard/shell.tsx`

- [ ] **Step 1: Read current shell**

Confirm current structure.

- [ ] **Step 2: Replace main content wrapper with fluid gutter**

Find:
```tsx
<main className="flex-1 w-full pb-20 lg:pb-6">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
              {hero ? <div className="mb-8">{hero}</div> : null}
              {children}
            </div>
          </main>
```

Replace with:
```tsx
<main
            className="flex-1 w-full pb-20 lg:pb-6 cq-shell"
            style={{ paddingBottom: "max(80px, calc(80px + env(safe-area-inset-bottom, 0px)))" }}
          >
            <div
              className="w-full py-6 mx-auto"
              style={{
                paddingLeft: "var(--page-gutter, 16px)",
                paddingRight: "var(--page-gutter, 16px)",
                maxWidth: "var(--page-max-width, 100%)",
              }}
            >
              {hero ? <div className="mb-8">{hero}</div> : null}
              {children}
            </div>
          </main>
```

(Note: the `--page-gutter` token only resolves to its fluid value inside `[data-area="restaurant"]`. Supplier falls back to 16px via the CSS fallback arg. The safe-area-inset-bottom padding ensures the mobile nav bar doesn't eat content on iPhones with home indicator.)

- [ ] **Step 3: Build verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/shell.tsx
git commit -m "$(cat <<'EOF'
feat(shell): fluid page gutter + cq-shell container context (Wave 2.5)

Main content wrapper reads --page-gutter token (clamp fluid in
restaurant scope) and max-width (1440px). Sets cq-shell container
context so nested components can @container query shell width.
Safe-area inset added to bottom padding so iPhone home indicator
doesn't overlap last row of content above the mobile nav.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: CommandPalette Full-Screen Mobile

**Files:**
- Modify: `components/dashboard/command-palette/command-palette.tsx`

- [ ] **Step 1: Replace panel className + result area max-height to scale with viewport**

Find:
```tsx
className="fixed left-1/2 top-[20%] -translate-x-1/2 w-[90vw] max-w-lg bg-surface-elevated border border-border-default rounded-2xl shadow-elevated-dark z-50 overflow-hidden"
```

Replace with:
```tsx
className={cn(
              "fixed z-50 bg-surface-elevated border border-border-default shadow-elevated-dark overflow-hidden",
              // Mobile: full-screen
              "inset-0 md:inset-auto",
              // Desktop: centered panel
              "md:left-1/2 md:top-[20%] md:-translate-x-1/2 md:w-[90vw] md:max-w-lg md:rounded-2xl"
            )}
```

Then at the top of the file, add `cn` to the imports if not present:

Find:
```tsx
import { Search } from "lucide-react";
```

After it, add:
```tsx
import { cn } from "@/lib/utils/formatters";
```

(Check if cn already imported. Don't duplicate.)

- [ ] **Step 2: Increase input height on mobile + hide kbd hint**

Find:
```tsx
<div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
```

Replace with:
```tsx
<div className="flex items-center gap-3 px-4 py-4 md:py-3 border-b border-border-subtle">
```

Find:
```tsx
<kbd className="px-1.5 py-0.5 rounded bg-surface-base text-[10px] font-mono text-text-tertiary border border-border-subtle">
                ESC
              </kbd>
```

Replace with:
```tsx
<kbd className="hidden md:inline-block px-1.5 py-0.5 rounded bg-surface-base text-[10px] font-mono text-text-tertiary border border-border-subtle">
                ESC
              </kbd>
```

- [ ] **Step 3: Increase results area on mobile**

Find:
```tsx
<div className="max-h-72 overflow-y-auto py-2">
```

Replace with:
```tsx
<div className="flex-1 md:max-h-72 overflow-y-auto py-2">
```

And find:
```tsx
className="fixed z-50 bg-surface-elevated border border-border-default shadow-elevated-dark overflow-hidden"
```

(Already replaced in Step 1.) Add `flex flex-col md:block` inside the className from Step 1 so the flex-1 results area expands:

Update the Step 1 replacement to:
```tsx
className={cn(
              "fixed z-50 bg-surface-elevated border border-border-default shadow-elevated-dark overflow-hidden",
              // Mobile: full-screen, flex column so results expand
              "inset-0 flex flex-col md:inset-auto md:block",
              // Desktop: centered panel
              "md:left-1/2 md:top-[20%] md:-translate-x-1/2 md:w-[90vw] md:max-w-lg md:rounded-2xl"
            )}
```

- [ ] **Step 4: Hide footer hint on mobile (no physical keyboard)**

Find:
```tsx
<div className="flex items-center gap-4 px-4 py-2 border-t border-border-subtle text-[10px] text-text-tertiary">
              <span>↑↓ naviga</span>
              <span>↵ seleziona</span>
              <span>esc chiudi</span>
            </div>
```

Replace with:
```tsx
<div className="hidden md:flex items-center gap-4 px-4 py-2 border-t border-border-subtle text-[10px] text-text-tertiary">
              <span>↑↓ naviga</span>
              <span>↵ seleziona</span>
              <span>esc chiudi</span>
            </div>
```

- [ ] **Step 5: Add mobile close button**

Find the end of the search input block (after the ESC kbd):
```tsx
<kbd className="hidden md:inline-block px-1.5 py-0.5 rounded bg-surface-base text-[10px] font-mono text-text-tertiary border border-border-subtle">
                ESC
              </kbd>
            </div>
```

Replace the closing `</div>` with a mobile close button before it:
```tsx
<kbd className="hidden md:inline-block px-1.5 py-0.5 rounded bg-surface-base text-[10px] font-mono text-text-tertiary border border-border-subtle">
                ESC
              </kbd>
              <button
                onClick={close}
                className="md:hidden p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover focus-ring"
                aria-label="Chiudi ricerca"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
```

- [ ] **Step 6: Build verify**

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/command-palette/command-palette.tsx
git commit -m "$(cat <<'EOF'
feat(cmd-palette): full-screen mobile variant (Wave 2.6)

Mobile (<md): palette expands to inset-0 full-screen with flex column
layout so results area grows to fill. Input gets larger padding for
touch. ESC hint + keyboard footer hidden on mobile (no physical kbd).
Added explicit close X button on mobile.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Layout.tsx — MOBILE_NAV Restaurant-tuned + Cart Badge Wiring

**Files:**
- Modify: `app/(app)/layout.tsx`
- Read: `lib/hooks/useCart` export shape (to understand how to get count in server component)

- [ ] **Step 1: Inspect useCart to understand client/server boundary**

Read `lib/hooks/useCart` to see if cart count is readable server-side or must stay client.

Run: `Grep pattern "export.*CartProvider|useCart" in lib/hooks/` to locate source.

- [ ] **Step 2: Create client-side MobileNavWithCart wrapper**

Since cart count lives in client CartProvider context, DarkMobileNav must read it client-side. The items array needs a client wrapper that injects badgeCount.

Create `components/dashboard/mobile/dark-mobile-nav-with-cart.tsx`:

```tsx
"use client";

import { useCart } from "@/lib/hooks/useCart";
import { DarkMobileNav, type MobileNavItem } from "./dark-mobile-nav";

type Props = {
  items: MobileNavItem[];
  /** Which item's href should display the cart count badge */
  cartHref?: string;
};

/**
 * Client wrapper that reads cart context and injects badgeCount
 * into the matching nav item. Used only in restaurant area.
 */
export function DarkMobileNavWithCart({ items, cartHref = "/carrello" }: Props) {
  const { itemCount } = useCart();

  const itemsWithBadge = items.map((item) =>
    item.href === cartHref ? { ...item, badgeCount: itemCount } : item
  );

  return <DarkMobileNav items={itemsWithBadge} />;
}
```

(If `useCart` export differs — e.g., returns `{ items: [] }` and you derive count as `items.length`, adjust the hook usage. Inspect actual shape first.)

- [ ] **Step 3: Update MOBILE_NAV in layout.tsx for restaurant**

Find:
```tsx
const MOBILE_NAV: MobileNavItem[] = [
  { href: "/dashboard",    label: "Home",    iconName: "LayoutDashboard" },
  { href: "/cerca",        label: "Cerca",   iconName: "Search" },
  { href: "/cataloghi",    label: "Catal.",  iconName: "BookMarked" },
  { href: "/ordini",       label: "Ordini",  iconName: "ClipboardList" },
  { href: "/impostazioni", label: "Altro",   iconName: "Settings" },
];
```

Replace with:
```tsx
const MOBILE_NAV: MobileNavItem[] = [
  { href: "/dashboard",    label: "Home",     iconName: "LayoutDashboard" },
  { href: "/cerca",        label: "Cerca",    iconName: "Search" },
  { href: "/carrello",     label: "Carrello", iconName: "ShoppingCart" },
  { href: "/ordini",       label: "Ordini",   iconName: "ClipboardList" },
  { href: "/impostazioni", label: "Account",  iconName: "Settings" },
];
```

- [ ] **Step 4: Update shell.tsx to swap DarkMobileNav for DarkMobileNavWithCart in restaurant**

In `components/dashboard/shell.tsx`:

Import the new wrapper:
```tsx
import { DarkMobileNavWithCart } from "./mobile/dark-mobile-nav-with-cart";
```

(Keep the existing `DarkMobileNav` import — supplier still uses it.)

Find:
```tsx
{/* Mobile bottom nav */}
        <DarkMobileNav items={mobileNavItems} />
```

Replace with:
```tsx
{/* Mobile bottom nav — restaurant gets cart badge wrapper */}
        {role === "restaurant" ? (
          <DarkMobileNavWithCart items={mobileNavItems} />
        ) : (
          <DarkMobileNav items={mobileNavItems} />
        )}
```

- [ ] **Step 5: Build verify**

Run: `npm run build`
Expected: PASS — verify useCart import path is correct (hook must export a `useCart` named export or default returning something with count).

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/layout.tsx components/dashboard/mobile/dark-mobile-nav-with-cart.tsx components/dashboard/shell.tsx
git commit -m "$(cat <<'EOF'
feat(mobile-nav): restaurant cart badge + tuned MOBILE_NAV (Wave 2.7)

MOBILE_NAV restaurant swaps /cataloghi (low touch frequency) for
/carrello (primary conversion point) with live cart count badge.
New DarkMobileNavWithCart client wrapper reads useCart context and
injects badgeCount. Supplier continues using plain DarkMobileNav.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wave 2 Verification

**Files:** (verification only)

- [ ] **Step 1: Final build + no regressions**

Run: `npm run build`
Expected: PASS

- [ ] **Step 2: Git diff summary**

Confirm changes scoped correctly:
- All CSS in restaurant or global utility (no supplier-specific CSS touched)
- DarkMobileNav type extension is backward-compatible (optional `badgeCount`)
- SidebarDrawer changes ALSO benefit supplier (swipe-close universal — intentional improvement, not regression)
- Command palette changes apply to both areas (shared component) — verify supplier palette still works visually by the mobile breakpoint

- [ ] **Step 3: Wave 2 done — handoff to Wave 3**

Next: write Wave 3 plan (per-route audit — 4 parallelizable batches).

---

## Deliberate Cross-Area Changes

Wave 2 touches 3 files shared with supplier area. These are INTENTIONAL improvements, not regressions:

1. **`sidebar-drawer.tsx`** — Now both areas get swipe-close + safe-area. Supplier already had these; restaurant now matches.
2. **`dark-mobile-nav.tsx`** — Type gains optional `badgeCount`. Supplier won't pass it, nothing visible changes. The active-fill icon + 3px top accent bar will apply to supplier too → supplier visual polish improvement (OCRA brand color auto-applies via `text-accent-green` remap).
3. **`command-palette.tsx`** — Full-screen mobile now applies to supplier palette too. Supplier users benefit identically.

If regression is detected in supplier area after Wave 2, revert the specific shared change and scope it to `[data-area="restaurant"]` via conditional rendering.

---

## Out of Scope (this plan)

- Wave 3 per-route audit
- Wave 4 cross-device manual verification
- Sidebar expanded/collapsed state UX changes (not responsive-critical)
- Topbar breadcrumb mobile display (deferred — current hidden `lg:block` acceptable)
