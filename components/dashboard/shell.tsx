"use client";

import { useState, type ReactNode } from "react";
import { CollapsibleSidebar } from "./sidebar/collapsible-sidebar";
import { DarkTopbar } from "./topbar/dark-topbar";
import { DarkMobileNav, type MobileNavItem } from "./mobile/dark-mobile-nav";
import { SidebarDrawer } from "./mobile/sidebar-drawer";
import { CommandPaletteProvider } from "./command-palette/command-palette-provider";
import { CommandPalette } from "./command-palette/command-palette";
import type { NavItem } from "./sidebar/sidebar-item";

type Props = {
  children: ReactNode;
  navItems: NavItem[];
  mobileNavItems: MobileNavItem[];
  role: "restaurant" | "supplier";
  companyName: string;
  userEmail: string;
};

export function DashboardShell({
  children,
  navItems,
  mobileNavItems,
  role,
  companyName,
  userEmail,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <CommandPaletteProvider navItems={navItems} role={role}>
      <div className="dashboard-dark flex min-h-screen bg-surface-base text-text-primary">
        {/* Desktop sidebar */}
        <CollapsibleSidebar
          navItems={navItems}
          role={role}
          companyName={companyName}
          userEmail={userEmail}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <DarkTopbar onMenuToggle={() => setDrawerOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6">{children}</main>
        </div>

        {/* Mobile drawer */}
        <SidebarDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          navItems={navItems}
          role={role}
          companyName={companyName}
        />

        {/* Mobile bottom nav */}
        <DarkMobileNav items={mobileNavItems} />

        {/* Command Palette overlay */}
        <CommandPalette />
      </div>
    </CommandPaletteProvider>
  );
}
