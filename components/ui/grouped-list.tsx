"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

interface GroupedListProps {
  label?: ReactNode;
  labelAction?: ReactNode;
  children: ReactNode;
  className?: string;
  tinted?: boolean;
}

export function GroupedList({
  label,
  labelAction,
  children,
  className,
  tinted = false,
}: GroupedListProps) {
  return (
    <div className={cn("px-[10px]", className)}>
      {label && (
        <div className="flex items-center justify-between px-[10px] pt-4 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
            {label}
          </span>
          {labelAction && <div className="text-xs text-[color:var(--caption-color)]">{labelAction}</div>}
        </div>
      )}
      <div
        className={cn(
          "overflow-hidden rounded-xl",
          "bg-[color:var(--ios-surface)]",
          "shadow-[0_0.5px_0_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]",
          "dark:shadow-[0_0.5px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.35)]",
          tinted && "bg-gradient-to-b from-[color:var(--color-brand-primary-subtle)] to-transparent ring-[0.5px] ring-[color:var(--color-brand-primary-border)]"
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface GroupedListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
  children?: never;
  /** Min height. Default 44px (iOS tap). */
  compact?: boolean;
  as?: "div" | "button" | "a";
}

export function GroupedListRow({
  leading,
  title,
  subtitle,
  trailing,
  showChevron = false,
  onClick,
  href,
  className,
  compact = false,
  as,
}: GroupedListRowProps) {
  const Tag = (as ?? (href ? "a" : onClick ? "button" : "div")) as "div" | "button" | "a";

  return (
    <Tag
      {...(href ? { href } : {})}
      {...(onClick ? { onClick } : {})}
      className={cn(
        "group relative flex w-full items-center gap-3 px-3 text-left",
        "transition-colors",
        onClick || href ? "active:bg-black/[0.04] dark:active:bg-white/[0.04]" : "",
        compact ? "min-h-[38px] py-2" : "min-h-[44px] py-2.5",
        // Hairline between siblings (not before first)
        "[&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:top-0 [&:not(:first-child)]:before:right-0 [&:not(:first-child)]:before:h-px [&:not(:first-child)]:before:bg-[color:var(--ios-separator)]",
        leading
          ? "[&:not(:first-child)]:before:left-[48px]"
          : "[&:not(:first-child)]:before:left-3",
        className
      )}
    >
      {leading && (
        <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center">
          {leading}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium leading-tight text-[color:var(--color-text-primary)] dark:text-white">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[11px] text-[color:var(--text-muted-light)] dark:text-white/60">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
      {showChevron && (
        <ChevronRight
          className="ml-1 h-4 w-4 flex-shrink-0 text-[color:var(--ios-chev-muted)]"
          aria-hidden="true"
        />
      )}
    </Tag>
  );
}
