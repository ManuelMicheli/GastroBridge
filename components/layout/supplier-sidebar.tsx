"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";
import {
  LayoutDashboard, Package, ClipboardList, Users,
  BarChart3, Star, Settings, LogOut,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

const NAV_ITEMS = [
  { href: "/supplier/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/supplier/catalogo", label: "Catalogo", icon: Package },
  { href: "/supplier/ordini", label: "Ordini", icon: ClipboardList },
  { href: "/supplier/clienti", label: "Clienti", icon: Users },
  { href: "/supplier/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/supplier/recensioni", label: "Recensioni", icon: Star },
  { href: "/supplier/impostazioni", label: "Impostazioni", icon: Settings },
];

export function SupplierSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-sage-muted/30 h-screen sticky top-0">
      <div className="p-6 border-b border-sage-muted/30">
        <Link href="/supplier/dashboard" className="flex items-center">
          <span className="text-xl font-display text-charcoal">Gastro</span>
          <span className="text-xl font-body font-bold text-forest">Bridge</span>
        </Link>
        <span className="text-xs text-sage mt-1 block">Area Fornitore</span>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-forest-light text-forest-dark"
                  : "text-sage hover:text-charcoal hover:bg-sage-muted/30"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sage-muted/30">
        <form action={signOut}>
          <button type="submit" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sage hover:text-red-600 hover:bg-red-50 transition-colors w-full">
            <LogOut className="h-5 w-5" /> Esci
          </button>
        </form>
      </div>
    </aside>
  );
}
