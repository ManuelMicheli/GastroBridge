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
