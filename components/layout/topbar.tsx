"use client";

import { ShoppingCart, Bell, Menu } from "lucide-react";
import Link from "next/link";

interface TopBarProps {
  onMenuToggle?: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-sage-muted/30">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-sage-muted/30"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5 text-charcoal" />
          </button>
          <div className="lg:hidden">
            <span className="text-lg font-display text-charcoal">Gastro</span>
            <span className="text-lg font-body font-bold text-forest">Bridge</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="relative p-2 rounded-lg hover:bg-sage-muted/30 transition-colors">
            <Bell className="h-5 w-5 text-sage" />
          </button>
          <Link
            href="/carrello"
            className="relative p-2 rounded-lg hover:bg-sage-muted/30 transition-colors"
          >
            <ShoppingCart className="h-5 w-5 text-sage" />
          </Link>
        </div>
      </div>
    </header>
  );
}
