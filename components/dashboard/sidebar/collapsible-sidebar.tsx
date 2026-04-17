"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useSidebar } from "./sidebar-provider";
import { SidebarItem, type NavItem } from "./sidebar-item";
import { SidebarUserCard } from "./sidebar-user-card";

type Props = {
  navItems: NavItem[];
  role: "restaurant" | "supplier";
  companyName: string;
  userEmail: string;
};

export function CollapsibleSidebar({ navItems, role, companyName, userEmail }: Props) {
  const { isCollapsed, toggle } = useSidebar();

  const homeHref = role === "supplier" ? "/supplier/dashboard" : "/dashboard";

  // Group items by section
  const sections: Record<string, NavItem[]> = {};
  for (const item of navItems) {
    const section = item.section || "main";
    if (!sections[section]) sections[section] = [];
    sections[section]!.push(item);
  }

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 72 : 256 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex flex-col bg-surface-sidebar border-r border-border-subtle h-screen sticky top-0 overflow-hidden z-30"
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 h-16 border-b border-border-subtle">
        <Link href={homeHref} className="flex items-center gap-1 overflow-hidden">
          {isCollapsed ? (
            <>
              <span className="text-lg font-bold text-accent-green tracking-tight">GB</span>
              {role === "supplier" && (
                <span className="font-display text-lg text-brand-primary">.</span>
              )}
            </>
          ) : (
            <>
              <span className="text-lg font-display text-text-primary">Gastro</span>
              <span className="text-lg font-bold text-accent-green">Bridge</span>
              {role === "supplier" && (
                <span className="font-display text-lg text-brand-primary">.</span>
              )}
            </>
          )}
        </Link>

        {!isCollapsed && (
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
            title="Comprimi sidebar (Ctrl+B)"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapsed toggle */}
      {isCollapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
            title="Espandi sidebar (Ctrl+B)"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Role badge */}
      {!isCollapsed && (
        <div className="px-4 py-2">
          {role === "supplier" ? (
            <span className="inline-flex items-center rounded-full border border-brand-primary-border bg-brand-primary-subtle px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-depth">
              Area Fornitore
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest font-bold text-text-tertiary">
              Area Ristorante
            </span>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {Object.entries(sections).map(([section, items], sIdx) => (
          <div key={section}>
            {sIdx > 0 && (
              <div className="my-3 border-t border-border-subtle" />
            )}
            {section !== "main" && !isCollapsed && (
              <p className="px-3 mb-1.5 text-[10px] uppercase tracking-widest font-bold text-text-tertiary">
                {section}
              </p>
            )}
            {items.map((item) => (
              <SidebarItem key={item.href} {...item} role={role} />
            ))}
          </div>
        ))}
      </nav>

      {/* User card */}
      <SidebarUserCard companyName={companyName} userEmail={userEmail} role={role} />
    </motion.aside>
  );
}
