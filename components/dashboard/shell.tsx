"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { CollapsibleSidebar } from "./sidebar/collapsible-sidebar";
import { DarkTopbar } from "./topbar/dark-topbar";
import { type MobileNavItem } from "./mobile/dark-mobile-nav";
import { FloatingPillNav } from "./mobile/floating-pill-nav";
import { FloatingPillNavWithCart } from "./mobile/floating-pill-nav-with-cart";
import { MobileRestaurantTopbar } from "./mobile/mobile-restaurant-topbar";
import { MobileSupplierTopbar } from "./mobile/mobile-supplier-topbar";
import { SidebarDrawer } from "./mobile/sidebar-drawer";
import { CommandPaletteProvider } from "./command-palette/command-palette-provider";
import { CommandPalette } from "./command-palette/command-palette";
import type { NavItem } from "./sidebar/sidebar-item";
import { AppearanceProvider } from "@/components/fernly/appearance-provider";
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

/**
 * Fernly app shell: three floating panels on a light canvas — sidebar,
 * topbar, content (spec §1). The page keeps window scrolling (sticky
 * sidebar/topbar) so every existing page layout keeps working; mobile keeps
 * its own topbar, drawer and floating pill nav.
 */
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const messagesHref = role === "supplier" ? "/supplier/messaggi" : "/messaggi";
  const unreadMessages = navItems.find((n) => n.href === messagesHref)?.badge ?? 0;
  const settingsHref = role === "supplier" ? "/supplier/impostazioni" : "/impostazioni";

  return (
    <AppearanceProvider area={role}>
      <CommandPaletteProvider navItems={navItems} role={role}>
        <div
          data-area={role}
          style={{ ["--chrome-top" as string]: "86px" }}
          className={cn(
            "flex min-h-screen bg-[var(--f-canvas)] text-text-primary lg:gap-2.5 lg:px-2.5",
            isDark && "dark dashboard-dark",
          )}
        >
          {/* Desktop sidebar panel */}
          <div className="hidden pt-2.5 lg:block">
            <CollapsibleSidebar
              navItems={navItems}
              role={role}
              companyName={companyName}
              userEmail={userEmail}
            />
          </div>

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            {role === "restaurant" ? (
              <div className="lg:hidden">
                <MobileRestaurantTopbar onMenuToggle={() => setDrawerOpen(true)} />
              </div>
            ) : (
              <div className="lg:hidden">
                <MobileSupplierTopbar onMenuToggle={() => setDrawerOpen(true)} />
              </div>
            )}
            <div className="hidden lg:block">
              <DarkTopbar
                onMenuToggle={() => setDrawerOpen(true)}
                companyName={companyName}
                userEmail={userEmail}
                messagesHref={messagesHref}
                unreadMessages={unreadMessages}
                settingsHref={settingsHref}
              />
            </div>
            <main
              className={cn(
                "cq-shell w-full flex-1",
                "bg-[color:var(--ios-grouped-bg)] lg:mb-2.5 lg:rounded-[24px] lg:bg-[var(--f-panel)]",
              )}
              style={{
                paddingBottom:
                  "max(92px, calc(92px + env(safe-area-inset-bottom, 0px)))",
              }}
            >
              <div
                className="mx-auto w-full py-1 lg:px-0 lg:py-6"
                style={{
                  paddingLeft: "var(--page-gutter, 0px)",
                  paddingRight: "var(--page-gutter, 0px)",
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

          {/* Mobile bottom nav — both areas get the floating pill */}
          {role === "restaurant" ? (
            <FloatingPillNavWithCart items={mobileNavItems} />
          ) : (
            <FloatingPillNav items={mobileNavItems} />
          )}

          <CommandPalette />

          {/* Overlay root (modals, drawers) — inside the area scope so
              portals inherit accent + font tokens. */}
          <div id="f-portal" />
        </div>
      </CommandPaletteProvider>
    </AppearanceProvider>
  );
}
