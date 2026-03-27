"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";
import { useSidebar } from "./sidebar-provider";
import { motion, AnimatePresence } from "motion/react";
import { resolveIcon } from "../icons";

export type NavItem = {
  href: string;
  label: string;
  iconName: string;
  section?: string;
};

export function SidebarItem({ href, label, iconName }: NavItem) {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const Icon = resolveIcon(iconName);

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
        isCollapsed ? "justify-center px-3 py-2.5" : "px-3 py-2.5",
        isActive
          ? "bg-accent-green-muted text-accent-green"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
      )}
      title={isCollapsed ? label : undefined}
    >
      {/* Active indicator — left glow bar */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-green"
          style={{ boxShadow: "var(--glow-forest-strong)" }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}

      <Icon className="h-5 w-5 shrink-0" />

      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-default text-xs text-text-primary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-elevated-dark">
          {label}
        </div>
      )}
    </Link>
  );
}
