"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";
import { useSidebar } from "./sidebar-provider";
import { motion, AnimatePresence } from "motion/react";
import { resolveIcon } from "../icons";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

export type NavItem = {
  href: string;
  label: string;
  iconName: string;
  section?: string;
  /** Numero da mostrare come pallino rosso accanto all'icona (omesso se 0). */
  badge?: number;
};

type SidebarItemProps = NavItem & {
  role?: "restaurant" | "supplier";
};

function pickSupplierBadgeVariant(href: string): BadgeVariant {
  if (href.startsWith("/supplier/ordini")) return "highlight";
  if (href.startsWith("/supplier/magazzino")) return "warning";
  return "brand";
}

export function SidebarItem({ href, label, iconName, badge, role }: SidebarItemProps) {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const Icon = resolveIcon(iconName);
  const isSupplier = role === "supplier";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
        isCollapsed ? "justify-center px-3 py-2.5" : "px-3 py-2.5",
        isActive
          ? isSupplier
            ? "bg-brand-primary-subtle text-brand-primary"
            : "bg-accent-green-muted text-accent-green"
          : isSupplier
            ? "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
      )}
      title={isCollapsed ? label : undefined}
    >
      {/* Active indicator — left glow bar */}
      {isActive && (
        isSupplier ? (
          <motion.div
            layoutId="sidebar-active"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-brand-primary dark:[box-shadow:var(--glow-brand)]"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        ) : (
          <motion.div
            layoutId="sidebar-active"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-green"
            style={{ boxShadow: "var(--glow-forest-strong)" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )
      )}

      <div className="relative shrink-0">
        <Icon
          className={cn(
            "h-5 w-5 transition-colors duration-150",
            isSupplier && !isActive && "group-hover:text-brand-primary"
          )}
        />
        {badge !== undefined && badge > 0 && isCollapsed && (
          <span
            aria-label={`${badge} avvisi`}
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent-red shadow-[0_0_0_2px_var(--surface-base,#0b0b0b)]"
          />
        )}
      </div>

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

      {badge !== undefined && badge > 0 && !isCollapsed && (
        isSupplier ? (
          <span className="ml-auto" aria-label={`${badge} avvisi`}>
            <Badge variant={pickSupplierBadgeVariant(href)} size="xs" mono>
              {badge > 99 ? "99+" : badge}
            </Badge>
          </span>
        ) : (
          <span
            aria-label={`${badge} avvisi`}
            className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent-red px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none text-white"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-default text-xs text-text-primary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-elevated-dark">
          {label}
        </div>
      )}
    </Link>
  );
}
