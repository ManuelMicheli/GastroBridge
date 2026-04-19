"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";
import { resolveIcon } from "../icons";

export type PillNavItem = {
  href: string;
  label: string;
  iconName: string;
  badgeCount?: number;
};

type Props = {
  items: PillNavItem[];
};

/**
 * FloatingPillNav — Apple-app style bottom navigation.
 * Cream blur pill floating above content with carmine underline on active.
 * Safe-area aware bottom inset + shadow-lifted from content.
 * Replaces DarkMobileNav in the restaurant scope.
 */
export function FloatingPillNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{ paddingBottom: "max(14px, calc(14px + env(safe-area-inset-bottom, 0px)))" }}
    >
      <nav
        aria-label="Navigazione principale"
        className={cn(
          "mx-4 flex min-h-[60px] items-stretch rounded-[30px]",
          "bg-[color:var(--ios-chrome-bg)]",
          "[backdrop-filter:var(--ios-chrome-blur)] [-webkit-backdrop-filter:var(--ios-chrome-blur)]",
          "ring-[0.5px] ring-[color:var(--pill-nav-ring)]",
          "shadow-[var(--pill-nav-shadow)]",
          "px-1"
        )}
      >
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
                "group relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-full",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-primary)]",
                isActive
                  ? "text-[color:var(--color-brand-primary)]"
                  : "text-[color:var(--text-muted-light)] dark:text-white/60"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 h-[3px] w-7 rounded-full bg-[color:var(--color-brand-primary)]"
                />
              )}
              <span className="relative mt-1.5">
                <Icon
                  className="h-[19px] w-[19px]"
                  fill={isActive ? "currentColor" : "none"}
                  strokeWidth={isActive ? 1.5 : 1.75}
                />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 flex min-w-[16px] h-[16px] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] px-1 text-[9px] font-semibold text-[color:var(--color-brand-on-primary)] ring-2 ring-[color:var(--ios-chrome-bg)]"
                    aria-label={`${item.badgeCount} elementi`}
                  >
                    {item.badgeCount! > 99 ? "99+" : item.badgeCount}
                  </span>
                )}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.06em] leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
