"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/formatters";
import { useSidebar } from "./sidebar-provider";
import { motion, AnimatePresence } from "motion/react";
import { resolveIcon } from "../icons";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { useSupplierRealtime } from "@/lib/realtime/supplier-provider";
import type { Badges } from "@/lib/realtime/supplier-provider";

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

function pickBadgeKey(href: string): keyof Badges | null {
  if (href === "/supplier/ordini" || href.startsWith("/supplier/ordini")) return "orders";
  if (href === "/supplier/magazzino" || href.startsWith("/supplier/magazzino")) return "stock";
  if (href === "/supplier/messaggi" || href.startsWith("/supplier/messaggi")) return "messages";
  return null;
}

export function SidebarItem({ href, label, iconName, badge, role }: SidebarItemProps) {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const Icon = resolveIcon(iconName);
  const isSupplier = role === "supplier";

  // Prefer live badge from provider context when the item is a known supplier badge slot.
  // When the provider is not mounted (e.g. restaurant area, unauthenticated) we
  // fall back to the SSR-seeded `badge` prop.
  const realtime = useSupplierRealtime();
  const badgeKey = isSupplier ? pickBadgeKey(href) : null;
  const liveBadge =
    realtime && badgeKey ? realtime.badges[badgeKey] : undefined;
  const effectiveBadge = liveBadge !== undefined ? liveBadge : badge;

  // Pulse animation on value bump
  const prevBadge = useRef(effectiveBadge ?? 0);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    const current = effectiveBadge ?? 0;
    if (current > prevBadge.current) setPulseKey((k) => k + 1);
    prevBadge.current = current;
  }, [effectiveBadge]);

  // Hide the notification badge when the user is already inside that section —
  // the counter is intended to pull attention, not decorate the active item.
  const badgeVisible = effectiveBadge !== undefined && effectiveBadge > 0 && !isActive;

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
        {badgeVisible && isCollapsed && (
          <span
            key={`dot-${pulseKey}`}
            aria-label={`${effectiveBadge} avvisi`}
            className="rt-badge-pulse absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent-red shadow-[0_0_0_2px_var(--surface-base,#0b0b0b)]"
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

      {badgeVisible && !isCollapsed && (
        isSupplier ? (
          <span
            key={`b-${pulseKey}`}
            className="rt-badge-pulse ml-auto"
            aria-label={`${effectiveBadge} avvisi`}
          >
            <Badge variant={pickSupplierBadgeVariant(href)} size="xs" mono>
              {(effectiveBadge ?? 0) > 99 ? "99+" : effectiveBadge}
            </Badge>
          </span>
        ) : (
          <span
            key={`b-${pulseKey}`}
            aria-label={`${effectiveBadge} avvisi`}
            className="rt-badge-pulse ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent-red px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none text-white"
          >
            {(effectiveBadge ?? 0) > 99 ? "99+" : effectiveBadge}
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
