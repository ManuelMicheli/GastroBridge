"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";
import { LayoutDashboard, Search, ShoppingCart, ClipboardList, Settings } from "lucide-react";

const MOBILE_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/cerca", label: "Cerca", icon: Search },
  { href: "/carrello", label: "Carrello", icon: ShoppingCart },
  { href: "/ordini", label: "Ordini", icon: ClipboardList },
  { href: "/impostazioni", label: "Altro", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-sage-muted/30 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {MOBILE_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors min-w-[60px]",
                isActive ? "text-forest" : "text-sage"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
