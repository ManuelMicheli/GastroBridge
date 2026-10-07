"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface MobileTopbarProps {
  title?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Default: true. Shows only on viewports < lg. */
  mobileOnly?: boolean;
  className?: string;
  /** Hide the bottom hairline separator. */
  borderless?: boolean;
}

/**
 * MobileTopbar — sticky translucent chrome for mobile routes.
 * Design: backdrop-filter blur + saturate (Apple-app style),
 * 0.5px separator bottom, safe-top aware, 44px tap targets.
 * Use inside `(app)` layout shell above scroll content.
 */
export function MobileTopbar({
  title,
  leading,
  trailing,
  mobileOnly = true,
  className,
  borderless = false,
}: MobileTopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        "bg-[color:var(--ios-chrome-bg)]",
        "[backdrop-filter:var(--ios-chrome-blur)] [-webkit-backdrop-filter:var(--ios-chrome-blur)]",
        !borderless && "border-b border-[color:var(--ios-separator)]",
        mobileOnly && "lg:hidden",
        "pt-[var(--safe-top)]",
        className
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {leading}
          {title && (
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-[var(--f-ink)]">
              {title}
            </h1>
          )}
        </div>
        {trailing && <div className="flex flex-shrink-0 items-center gap-1">{trailing}</div>}
      </div>
    </header>
  );
}

interface TopbarIconButtonProps {
  onClick?: () => void;
  href?: string;
  ariaLabel: string;
  children: ReactNode;
  badge?: boolean;
  className?: string;
}

export function TopbarIconButton({
  onClick,
  href,
  ariaLabel,
  children,
  badge,
  className,
}: TopbarIconButtonProps) {
  const Tag = (href ? "a" : "button") as "a" | "button";
  return (
    <Tag
      {...(href ? { href } : { type: "button" })}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "f-icon-btn",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-primary)] focus-visible:ring-offset-1",
        className
      )}
    >
      {children}
      {badge && (
        <span
          aria-hidden="true"
          className="absolute right-[9px] top-[9px] h-2 w-2 rounded-full bg-[#E5484D] ring-2 ring-[var(--f-card)]"
        />
      )}
    </Tag>
  );
}

export function TopbarHamburger({
  onClick,
  ariaLabel = "Apri menu",
}: {
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="f-icon-btn"
    >
      <span className="flex w-5 flex-col gap-[3px]">
        <span className="h-[1.5px] rounded-full bg-current" />
        <span className="h-[1.5px] rounded-full bg-current" />
        <span className="h-[1.5px] rounded-full bg-current" />
      </span>
    </button>
  );
}

export function TopbarBack({
  label = "Indietro",
  href,
  onClick,
}: {
  label?: string;
  href?: string;
  onClick?: () => void;
}) {
  const Tag = (href ? "a" : "button") as "a" | "button";
  return (
    <Tag
      {...(href ? { href } : { type: "button" })}
      onClick={onClick}
      className="flex h-10 items-center gap-1 rounded-full pl-1 pr-3 text-[var(--acc-700)] transition active:bg-[var(--acc-50)]"
      aria-label={`Torna a ${label}`}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path
          d="M10 3L5 8l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-medium">{label}</span>
    </Tag>
  );
}
