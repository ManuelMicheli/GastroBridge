"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/formatters";
import { useSidebar } from "./sidebar-provider";
import { resolveIcon } from "../icons";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { useSupplierRealtime } from "@/lib/realtime/supplier-provider";
import type { Badges } from "@/lib/realtime/supplier-provider";

export type NavItem = {
  href: string;
  label: string;
  iconName: string;
  section?: string;
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

function SidebarItemBase({ href, label, iconName, badge, role }: SidebarItemProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const Icon = resolveIcon(iconName);
  const isSupplier = role === "supplier";

  const realtime = useSupplierRealtime();
  const badgeKey = isSupplier ? pickBadgeKey(href) : null;
  const liveBadge =
    realtime && badgeKey ? realtime.badges[badgeKey] : undefined;
  const effectiveBadge = liveBadge !== undefined ? liveBadge : badge;

  const prevBadge = useRef(effectiveBadge ?? 0);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    const current = effectiveBadge ?? 0;
    if (current > prevBadge.current) setPulseKey((k) => k + 1);
    prevBadge.current = current;
  }, [effectiveBadge]);

  const badgeVisible = effectiveBadge !== undefined && effectiveBadge > 0 && !isActive;

  // Eagerly prime the route on intent (hover / touch). Next prefetches links
  // when visible, but warming on hover halves perceived latency on first click.
  const primeRoute = useCallback(() => {
    if (!isActive) router.prefetch(href);
  }, [href, isActive, router]);

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={primeRoute}
      onTouchStart={primeRoute}
      onFocus={primeRoute}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-150",
        isCollapsed ? "justify-center px-3 py-2.5" : "px-3 py-2.5",
        isActive
          ? isSupplier
            ? "bg-brand-primary-subtle text-brand-primary"
            : "bg-accent-green-muted text-accent-green"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
      )}
      title={isCollapsed ? label : undefined}
    >
      {isActive && (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-5 rounded-r-full",
            isSupplier
              ? "w-0.5 bg-brand-primary dark:[box-shadow:var(--glow-brand)]"
              : "w-[3px] bg-accent-green [box-shadow:var(--glow-forest-strong)]",
          )}
        />
      )}

      <div className="relative shrink-0">
        <Icon
          className={cn(
            "h-5 w-5 transition-colors duration-150",
            isSupplier && !isActive && "group-hover:text-brand-primary",
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

      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200",
          isCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100",
        )}
      >
        {label}
      </span>

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

      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-default text-xs text-text-primary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-elevated-dark">
          {label}
        </div>
      )}
    </Link>
  );
}

export const SidebarItem = memo(SidebarItemBase);
