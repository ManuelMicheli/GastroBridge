# Restaurant Foundations — Plan A2: Component Primitives Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add new universal primitives (`PageHeader`, `SectionHeader`, `EmptyState`, `ErrorState`, `Popover`, enhanced `Skeleton`). Polish `Card` to consume new elevation token. Refactor of `button`/`input`/`select`/`badge` is **deferred** to per-page opt-in to avoid breaking supplier visually.

**Architecture:** Pure additive. Each new primitive is a standalone file in `components/ui/`. `Card` polish is a single token swap (uses `--elevation-card-active` already set up in Plan A1). Zero impact on supplier area beyond the Card elevation refinement (which was already a subtle shadow change and renders nearly identically).

**Tech Stack:** React 19, TypeScript strict, Tailwind 4, lucide-react, motion v12 (framer-motion).

**Spec reference:** `docs/superpowers/specs/2026-04-16-restaurant-foundations-awwwards-design.md` §5.

---

## File Structure

**Files created:**
- `components/ui/page-header.tsx` — `<PageHeader />` primitive
- `components/ui/section-header.tsx` — `<SectionHeader />` primitive
- `components/ui/empty-state.tsx` — `<EmptyState />` primitive (4 contexts)
- `components/ui/error-state.tsx` — `<ErrorState />` primitive (inline + page)
- `components/ui/popover.tsx` — `<Popover />` primitive built on Radix-style API or vanilla
- `components/illustrations/empty-orders.tsx` — bespoke SVG
- `components/illustrations/empty-search.tsx` — bespoke SVG
- `components/illustrations/empty-cart.tsx` — bespoke SVG
- `components/illustrations/empty-suppliers.tsx` — bespoke SVG
- `components/illustrations/empty-products.tsx` — bespoke SVG
- `components/illustrations/empty-team.tsx` — bespoke SVG
- `components/illustrations/index.ts` — barrel export

**Files modified:**
- `components/ui/card.tsx` — swap `shadow-card` → `var(--elevation-card-active)`, hairline border, `rounded-lg` (12px not 16px), padding-5 (20px) default
- `components/ui/skeleton.tsx` — add `variant` prop (`text|line|block|circle`)

**No files deleted.**

---

## Task 1: Card polish — wire to new elevation token

**Files:**
- Modify: `components/ui/card.tsx`

- [ ] **Step 1: Replace Card root component**

Replace the `Card` constant block (lines 4–13) with:

```tsx
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]",
        className
      )}
      style={{ boxShadow: "var(--elevation-card-active)" }}
      {...props}
    />
  )
);
```

(Note: keeping `bg-white` here keeps supplier light-mode behavior; `.dashboard-dark .bg-white` rule already remaps to surface-card in dark mode. The 1px hairline + new shadow give the Linear feel without breaking supplier.)

- [ ] **Step 2: Build verify**

```bash
pnpm build
```

Expected: success, 0 new warnings.

- [ ] **Step 3: Commit**

```bash
git add components/ui/card.tsx
git commit -m "feat(restaurant-foundations): wire Card to elevation-card-active token + hairline"
```

---

## Task 2: Skeleton v2 — variant prop

**Files:**
- Modify: `components/ui/skeleton.tsx`

- [ ] **Step 1: Replace Skeleton component with variants**

Replace the entire content of `components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils/formatters";

type SkeletonVariant = "text" | "line" | "block" | "circle";

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  width?: string | number;
  height?: string | number;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: "h-4 rounded-md",        // for inline text (single line)
  line: "h-3 rounded",           // for thin separators / metadata
  block: "rounded-lg",           // for card bodies, image placeholders
  circle: "rounded-full",        // for avatars, icons
};

function Skeleton({ variant = "text", className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[color:var(--color-surface-hover)]",
        variantStyles[variant],
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl p-5 border border-[color:var(--color-border-subtle)]",
        className
      )}
      style={{ boxShadow: "var(--elevation-card-active)" }}
    >
      <Skeleton variant="text" className="w-3/4 mb-4" />
      <Skeleton variant="line" className="w-1/2 mb-2" />
      <Skeleton variant="line" className="w-full mb-2" />
      <Skeleton variant="line" className="w-2/3" />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden border border-[color:var(--color-border-subtle)]"
      style={{ boxShadow: "var(--elevation-card-active)" }}
    >
      <div className="p-4 bg-[color:var(--color-surface-hover)]">
        <Skeleton variant="text" className="w-full" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="p-4 border-t border-[color:var(--color-border-subtle)]"
        >
          <div className="flex items-center gap-4">
            <Skeleton variant="circle" width={40} height={40} />
            <div className="flex-1">
              <Skeleton variant="text" className="w-1/3 mb-2" />
              <Skeleton variant="line" className="w-1/4" />
            </div>
            <Skeleton variant="block" width={80} height={24} />
          </div>
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, type SkeletonVariant };
```

- [ ] **Step 2: Build verify**

```bash
pnpm build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add components/ui/skeleton.tsx
git commit -m "feat(restaurant-foundations): Skeleton v2 with variant prop (text/line/block/circle)"
```

---

## Task 3: PageHeader primitive

**Files:**
- Create: `components/ui/page-header.tsx`

- [ ] **Step 1: Create PageHeader component**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  divider?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
  divider = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        divider && "pb-6 border-b border-[color:var(--color-border-subtle)]",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1
            className="font-display"
            style={{
              fontSize: "var(--text-display-lg)",
              lineHeight: "var(--text-display-lg--line-height)",
              letterSpacing: "var(--text-display-lg--letter-spacing)",
              fontWeight: "var(--text-display-lg--font-weight)",
              color: "var(--color-text-primary)",
            }}
          >
            {title}
          </h1>
          {meta && <div className="flex items-center gap-2">{meta}</div>}
        </div>
        {subtitle && (
          <p
            className="mt-1.5 text-[color:var(--color-text-secondary)]"
            style={{
              fontSize: "var(--text-body-sm)",
              lineHeight: "var(--text-body-sm--line-height)",
              maxWidth: "60ch",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Build verify**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/page-header.tsx
git commit -m "feat(restaurant-foundations): add PageHeader primitive"
```

---

## Task 4: SectionHeader primitive

**Files:**
- Create: `components/ui/section-header.tsx`

- [ ] **Step 1: Create SectionHeader component**

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/formatters";

interface SectionHeaderProps {
  title: string;
  action?:
    | { label: string; href: string }
    | { label: string; onClick: () => void }
    | ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  const renderAction = () => {
    if (!action) return null;
    if (typeof action === "object" && "href" in action) {
      return (
        <Link
          href={action.href}
          className="text-[color:var(--color-text-link)] hover:underline transition-colors"
          style={{
            fontSize: "var(--text-caption)",
            letterSpacing: "var(--text-caption--letter-spacing)",
            fontWeight: "var(--text-caption--font-weight)",
          }}
        >
          {action.label} →
        </Link>
      );
    }
    if (typeof action === "object" && "onClick" in action) {
      return (
        <button
          onClick={action.onClick}
          className="text-[color:var(--color-text-link)] hover:underline transition-colors"
          style={{
            fontSize: "var(--text-caption)",
            letterSpacing: "var(--text-caption--letter-spacing)",
            fontWeight: "var(--text-caption--font-weight)",
          }}
        >
          {action.label} →
        </button>
      );
    }
    return action;
  };

  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between gap-4",
        className
      )}
    >
      <h2
        style={{
          fontSize: "var(--text-title-md)",
          lineHeight: "var(--text-title-md--line-height)",
          letterSpacing: "var(--text-title-md--letter-spacing)",
          fontWeight: "var(--text-title-md--font-weight)",
          color: "var(--color-text-primary)",
        }}
      >
        {title}
      </h2>
      {renderAction()}
    </div>
  );
}
```

- [ ] **Step 2: Build verify**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/section-header.tsx
git commit -m "feat(restaurant-foundations): add SectionHeader primitive"
```

---

## Task 5: 6 bespoke empty illustrations (SVG)

**Files:**
- Create: `components/illustrations/empty-orders.tsx`
- Create: `components/illustrations/empty-search.tsx`
- Create: `components/illustrations/empty-cart.tsx`
- Create: `components/illustrations/empty-suppliers.tsx`
- Create: `components/illustrations/empty-products.tsx`
- Create: `components/illustrations/empty-team.tsx`
- Create: `components/illustrations/index.ts`

Each is 200×160, monochrome line art, with a single brand accent dot. All use `currentColor` for stroke + brand variable for accent so they recolor per scope.

- [ ] **Step 1: Create empty-orders.tsx**

```tsx
export function EmptyOrdersIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="40"
        y="40"
        width="120"
        height="100"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line x1="56" y1="64" x2="144" y2="64" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="56" y1="80" x2="120" y2="80" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="56" y1="96" x2="100" y2="96" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="56" y1="112" x2="130" y2="112" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="160" cy="40" r="6" fill="var(--color-brand-primary)" />
    </svg>
  );
}
```

- [ ] **Step 2: Create empty-search.tsx**

```tsx
export function EmptySearchIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="90"
        cy="70"
        r="36"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line
        x1="116"
        y1="96"
        x2="140"
        y2="120"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <line x1="78" y1="60" x2="102" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="78" y1="76" x2="92" y2="76" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="146" cy="34" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
```

- [ ] **Step 3: Create empty-cart.tsx**

```tsx
export function EmptyCartIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M40 50 L60 50 L74 110 L150 110"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path
        d="M65 70 L156 70 L148 102 L72 102 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <circle cx="86" cy="128" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="138" cy="128" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="160" cy="46" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
```

- [ ] **Step 4: Create empty-suppliers.tsx**

```tsx
export function EmptySuppliersIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="50" y="60" width="46" height="80" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="104" y="40" width="46" height="100" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="60" y1="78" x2="86" y2="78" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="60" y1="92" x2="78" y2="92" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="114" y1="58" x2="140" y2="58" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="114" y1="72" x2="132" y2="72" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="40" y1="140" x2="160" y2="140" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="158" cy="38" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
```

- [ ] **Step 5: Create empty-products.tsx**

```tsx
export function EmptyProductsIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M70 60 L100 44 L130 60 L130 110 L100 126 L70 110 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path
        d="M70 60 L100 76 L130 60"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <line x1="100" y1="76" x2="100" y2="126" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="148" cy="44" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
```

- [ ] **Step 6: Create empty-team.tsx**

```tsx
export function EmptyTeamIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="100" cy="68" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path
        d="M64 130 C64 110 80 96 100 96 C120 96 136 110 136 130"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="60" cy="80" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="140" cy="80" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="156" cy="40" r="5" fill="var(--color-brand-primary)" />
    </svg>
  );
}
```

- [ ] **Step 7: Create barrel export**

`components/illustrations/index.ts`:

```ts
export { EmptyOrdersIllustration } from "./empty-orders";
export { EmptySearchIllustration } from "./empty-search";
export { EmptyCartIllustration } from "./empty-cart";
export { EmptySuppliersIllustration } from "./empty-suppliers";
export { EmptyProductsIllustration } from "./empty-products";
export { EmptyTeamIllustration } from "./empty-team";
```

- [ ] **Step 8: Build verify**

```bash
pnpm build
```

- [ ] **Step 9: Commit**

```bash
git add components/illustrations/
git commit -m "feat(restaurant-foundations): add 6 bespoke empty-state illustrations"
```

---

## Task 6: EmptyState primitive

**Files:**
- Create: `components/ui/empty-state.tsx`

- [ ] **Step 1: Create EmptyState component**

```tsx
import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils/formatters";

type EmptyStateContext = "page" | "section" | "search" | "filter";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  context?: EmptyStateContext;
  className?: string;
}

const contextStyles: Record<EmptyStateContext, string> = {
  page: "py-20",
  section: "py-12",
  search: "py-16",
  filter: "py-12",
};

export function EmptyState({
  title,
  description,
  action,
  illustration,
  icon: Icon,
  context = "page",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        contextStyles[context],
        className
      )}
    >
      {illustration && (
        <div className="mb-6 text-[color:var(--color-text-tertiary)]">
          {illustration}
        </div>
      )}
      {!illustration && Icon && (
        <div className="mb-4 text-[color:var(--color-text-tertiary)]">
          <Icon width={32} height={32} strokeWidth={1.5} />
        </div>
      )}
      <h3
        className="text-[color:var(--color-text-primary)]"
        style={{
          fontSize: "var(--text-title-md)",
          lineHeight: "var(--text-title-md--line-height)",
          fontWeight: "var(--text-title-md--font-weight)",
          letterSpacing: "var(--text-title-md--letter-spacing)",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 max-w-sm text-[color:var(--color-text-secondary)]"
          style={{
            fontSize: "var(--text-body-sm)",
            lineHeight: "var(--text-body-sm--line-height)",
          }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export type { EmptyStateContext, EmptyStateProps };
```

- [ ] **Step 2: Build verify**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/empty-state.tsx
git commit -m "feat(restaurant-foundations): add EmptyState primitive (4 contexts)"
```

---

## Task 7: ErrorState primitive

**Files:**
- Create: `components/ui/error-state.tsx`

- [ ] **Step 1: Create ErrorState component**

```tsx
"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

type ErrorStateVariant = "inline" | "page";

interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: ErrorStateVariant;
  className?: string;
}

const variantStyles: Record<ErrorStateVariant, string> = {
  inline: "py-8",
  page: "py-20",
};

export function ErrorState({
  title,
  description,
  action,
  variant = "inline",
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variantStyles[variant],
        className
      )}
      role="alert"
    >
      <div className="mb-4 text-[color:var(--color-error)]">
        <AlertCircle width={24} height={24} strokeWidth={1.5} />
      </div>
      <h3
        className="text-[color:var(--color-text-primary)]"
        style={{
          fontSize: "var(--text-title-md)",
          lineHeight: "var(--text-title-md--line-height)",
          fontWeight: "var(--text-title-md--font-weight)",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 max-w-sm text-[color:var(--color-text-secondary)]"
          style={{
            fontSize: "var(--text-body-sm)",
            lineHeight: "var(--text-body-sm--line-height)",
          }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export type { ErrorStateVariant, ErrorStateProps };
```

- [ ] **Step 2: Build verify**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/error-state.tsx
git commit -m "feat(restaurant-foundations): add ErrorState primitive (inline + page)"
```

---

## Task 8: Popover primitive

Build a vanilla popover (no Radix dependency added). Used by future dropdowns, filter chips, etc.

**Files:**
- Create: `components/ui/popover.tsx`

- [ ] **Step 1: Create Popover component**

```tsx
"use client";

import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  cloneElement,
  isValidElement,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils/formatters";

type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  placement?: PopoverPlacement;
  className?: string;
  contentClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  trigger,
  children,
  placement = "bottom-start",
  className,
  contentClassName,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const triggerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        contentRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const placementClass: Record<PopoverPlacement, string> = {
    "bottom-start": "top-full left-0 mt-1.5",
    "bottom-end": "top-full right-0 mt-1.5",
    "top-start": "bottom-full left-0 mb-1.5",
    "top-end": "bottom-full right-0 mb-1.5",
  };

  const triggerProps = {
    ref: triggerRef as RefObject<HTMLElement>,
    "aria-expanded": open,
    "aria-controls": id,
    "aria-haspopup": "dialog" as const,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(!open);
    },
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {isValidElement(trigger)
        ? cloneElement(trigger as React.ReactElement<Record<string, unknown>>, triggerProps)
        : (
          <button {...triggerProps} type="button">
            {trigger}
          </button>
        )}
      {open && (
        <div
          id={id}
          ref={contentRef}
          role="dialog"
          className={cn(
            "absolute z-50 min-w-[180px] motion-spring",
            "rounded-lg border border-[color:var(--color-border-default)]",
            "bg-[color:var(--color-surface-card)] p-1",
            "animate-in fade-in zoom-in-95",
            placementClass[placement],
            contentClassName
          )}
          style={{ boxShadow: "var(--elevation-modal-active)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface PopoverItemProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  shortcut?: string;
  destructive?: boolean;
  className?: string;
}

export function PopoverItem({
  children,
  onClick,
  disabled,
  shortcut,
  destructive,
  className,
}: PopoverItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors",
        "hover:bg-[color:var(--color-surface-hover)]",
        "focus-visible:outline-none focus-visible:bg-[color:var(--color-surface-hover)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        destructive
          ? "text-[color:var(--color-error)]"
          : "text-[color:var(--color-text-primary)]",
        className
      )}
      style={{
        fontSize: "var(--text-body)",
        lineHeight: "var(--text-body--line-height)",
      }}
    >
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span
          className="text-[color:var(--color-text-tertiary)]"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

export function PopoverDivider() {
  return (
    <div className="my-1 h-px bg-[color:var(--color-border-subtle)]" />
  );
}

export type { PopoverPlacement, PopoverProps };
```

- [ ] **Step 2: Build verify**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/popover.tsx
git commit -m "feat(restaurant-foundations): add Popover + PopoverItem + PopoverDivider primitives"
```

---

## Verification checklist (Plan A2 complete)

- [x] `Card` consumes `--elevation-card-active` token + hairline border.
- [x] `Skeleton` has `variant` prop (`text|line|block|circle`).
- [x] `PageHeader` primitive created.
- [x] `SectionHeader` primitive created.
- [x] 6 bespoke empty illustrations created.
- [x] `EmptyState` primitive created (4 contexts).
- [x] `ErrorState` primitive created (inline + page).
- [x] `Popover` + `PopoverItem` + `PopoverDivider` primitives created.
- [x] Build green, 0 new warnings vs. baseline.

---

## Out of scope (deferred)

- Refactoring `button`/`input`/`select`/`badge` to Linear density — would visually impact supplier; deferred to opt-in `density` prop in a later plan.
- `ActionBar` and `FilterBar` primitives — deferred to Plan A3 (chrome) since they need to coordinate with topbar/page layout.
- `Modal` polish — current modal works; deferred to per-page polish.
- `Toast` polish — sonner already handles polish well; deferred.
- `Tooltip` primitive — not used heavily in current code; deferred.
