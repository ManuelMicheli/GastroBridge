"use client";

import { Menu } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { SearchTrigger } from "./search-trigger";
import { NotificationBell } from "./notification-bell";

type Props = {
  onMenuToggle?: () => void;
};

export function DarkTopbar({ onMenuToggle }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-surface-base/80 backdrop-blur-xl border-b border-border-subtle">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        {/* Left: mobile menu + breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-0.5">
            <span className="text-base font-display text-text-primary">Gastro</span>
            <span className="text-base font-bold text-accent-green">Bridge</span>
          </div>

          {/* Desktop breadcrumbs */}
          <div className="hidden lg:block">
            <Breadcrumbs />
          </div>
        </div>

        {/* Right: search + notifications */}
        <div className="flex items-center gap-2">
          <SearchTrigger />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
