"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { CollapsibleSidebar } from "./sidebar/collapsible-sidebar";
import { DarkTopbar } from "./topbar/dark-topbar";
import { DarkMobileNav, type MobileNavItem } from "./mobile/dark-mobile-nav";
import { FloatingPillNavWithCart } from "./mobile/floating-pill-nav-with-cart";
import { MobileRestaurantTopbar } from "./mobile/mobile-restaurant-topbar";
import { SidebarDrawer } from "./mobile/sidebar-drawer";
import { CommandPaletteProvider } from "./command-palette/command-palette-provider";
import { CommandPalette } from "./command-palette/command-palette";
import type { NavItem } from "./sidebar/sidebar-item";
import { cn } from "@/lib/utils/formatters";

type Props = {
  children: ReactNode;
  navItems: NavItem[];
  mobileNavItems: MobileNavItem[];
  role: "restaurant" | "supplier";
  companyName: string;
  userEmail: string;
  hero?: ReactNode;
};

export function DashboardShell({
  children,
  navItems,
  mobileNavItems,
  role,
  companyName,
  userEmail,
  hero,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  // Avoid hydration mismatch: theme is unknown on first render.
  // Default to light before mount so restaurant area opens with the
  // brand-correct white surface (carmine palette via [data-area]).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <CommandPaletteProvider navItems={navItems} role={role}>
      <div
        data-area={role}
        className={cn(
          "flex min-h-screen bg-surface-base text-text-primary",
          isDark && "dark dashboard-dark"
        )}
      >
        {/* Desktop sidebar */}
        <CollapsibleSidebar
          navItems={navItems}
          role={role}
          companyName={companyName}
          userEmail={userEmail}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {role === "restaurant" ? (
            <>
              {/* Restaurant: mobile gets iOS-style translucent topbar, desktop keeps DarkTopbar */}
              <div className="lg:hidden">
                <MobileRestaurantTopbar
                  onMenuToggle={() => setDrawerOpen(true)}
                />
              </div>
              <div className="hidden lg:block">
                <DarkTopbar onMenuToggle={() => setDrawerOpen(true)} />
              </div>
            </>
          ) : (
            <DarkTopbar onMenuToggle={() => setDrawerOpen(true)} />
          )}
          <main
            className={cn(
              "flex-1 w-full cq-shell lg:pb-6",
              role === "restaurant" && "bg-[color:var(--ios-grouped-bg)] lg:bg-transparent"
            )}
            style={{
              paddingBottom:
                "max(92px, calc(92px + env(safe-area-inset-bottom, 0px)))",
            }}
          >
            <div
              className={cn(
                "w-full mx-auto",
                role === "restaurant"
                  ? "lg:py-6 py-1"
                  : "py-6"
              )}
              style={{
                paddingLeft:
                  role === "restaurant"
                    ? "var(--page-gutter, 0px)"
                    : "var(--page-gutter, 16px)",
                paddingRight:
                  role === "restaurant"
                    ? "var(--page-gutter, 0px)"
                    : "var(--page-gutter, 16px)",
                maxWidth: "var(--page-max-width, 100%)",
              }}
            >
              {hero ? <div className="mb-8">{hero}</div> : null}
              {children}
            </div>
          </main>
        </div>

        {/* Mobile drawer */}
        <SidebarDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          navItems={navItems}
          role={role}
          companyName={companyName}
        />

        {/* Mobile bottom nav — restaurant gets floating-pill variant with cart badge */}
        {role === "restaurant" ? (
          <FloatingPillNavWithCart items={mobileNavItems} />
        ) : (
          <DarkMobileNav items={mobileNavItems} />
        )}

        {/* Command Palette overlay */}
        <CommandPalette />
      </div>
    </CommandPaletteProvider>
  );
}
