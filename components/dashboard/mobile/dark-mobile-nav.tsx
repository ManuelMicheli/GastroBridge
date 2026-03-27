"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";
import { resolveIcon } from "../icons";

export type MobileNavItem = {
  href: string;
  label: string;
  iconName: string;
};

type Props = {
  items: MobileNavItem[];
};

export function DarkMobileNav({ items }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-surface-sidebar/95 backdrop-blur-xl border-t border-border-subtle z-40 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = resolveIcon(item.iconName);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 transition-colors",
                isActive ? "text-accent-green" : "text-text-tertiary"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
