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
          "mx-4 flex min-h-[62px] items-stretch gap-1 rounded-full p-1.5",
          "bg-[color-mix(in_oklab,var(--f-card)_88%,transparent)]",
          "[backdrop-filter:blur(18px)_saturate(170%)] [-webkit-backdrop-filter:blur(18px)_saturate(170%)]",
          "border border-[var(--f-line)]",
          "shadow-[0_2px_6px_rgba(16,24,20,0.05),0_14px_34px_rgba(16,24,20,0.12)]",
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
                "group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-full px-1",
                "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc-600)]",
                isActive ? "text-white" : "text-[var(--f-muted)]",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,color-mix(in_oklab,var(--acc-700)_65%,var(--acc-800)),var(--acc-800))] shadow-[0_6px_14px_color-mix(in_oklab,var(--acc-800)_28%,transparent)]"
                />
              )}
              <span className="relative">
                <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2 : 1.75} />
                {showBadge && (
                  <span
                    className={cn(
                      "absolute -right-2.5 -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold ring-2",
                      isActive
                        ? "bg-white text-[var(--acc-900)] ring-[var(--acc-800)]"
                        : "bg-[var(--acc-900)] text-white ring-[var(--f-card)]",
                    )}
                    aria-label={`${item.badgeCount} elementi`}
                  >
                    {item.badgeCount! > 99 ? "99+" : item.badgeCount}
                  </span>
                )}
              </span>
              <span className="relative text-[10px] font-semibold leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
