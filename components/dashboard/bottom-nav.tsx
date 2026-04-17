"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  ShoppingCart,
  Package,
  User,
} from "lucide-react";
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
 * Hidden on md+. 5 primary routes: dashboard, cerca, carrello, ordini, impostazioni.
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
          const showBadge =
            item.href === "/carrello" && cartCount && cartCount > 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1",
                  "min-h-[56px] px-2 pt-2 pb-1.5 transition-colors",
                  "focus-ring",
                  active
                    ? "text-[color:var(--color-brand-primary)]"
                    : "text-sage hover:text-charcoal"
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
