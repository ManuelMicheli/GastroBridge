"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/formatters";
import { useSidebar } from "./sidebar-provider";
import { resolveIcon } from "../icons";
import type { BadgeVariant } from "@/components/ui/badge";
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
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-xl text-[14.5px] transition-colors duration-150",
        isCollapsed ? "justify-center px-3" : "px-3",
        isActive
          ? "font-semibold text-[var(--f-ink)]"
          : "font-medium text-[var(--f-muted)] hover:text-[var(--f-ink)]",
      )}
      title={isCollapsed ? label : undefined}
    >
      <div className="relative shrink-0">
        <Icon
          className={cn(
            "h-[19px] w-[19px] transition-colors duration-150",
            isActive ? "text-[var(--acc-600)]" : "group-hover:text-[var(--f-ink)]",
          )}
          strokeWidth={isActive ? 2 : 1.75}
        />
        {badgeVisible && isCollapsed && (
          <span
            key={`dot-${pulseKey}`}
            aria-label={`${effectiveBadge} avvisi`}
            className="rt-badge-pulse absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--acc-800)] ring-2 ring-[var(--f-panel)]"
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
        <span
          key={`b-${pulseKey}`}
          aria-label={`${effectiveBadge} avvisi`}
          data-variant={isSupplier ? pickSupplierBadgeVariant(href) : "brand"}
          className="rt-badge-pulse ml-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-[6px] bg-[var(--acc-900)] px-1.5 text-[11px] font-semibold leading-none text-white tabular-nums"
        >
          {(effectiveBadge ?? 0) > 99 ? "99+" : effectiveBadge}
        </span>
      )}

      {isCollapsed && (
        <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-full bg-[var(--f-ink)] px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {label}
        </div>
      )}
    </Link>
  );
}

export const SidebarItem = memo(SidebarItemBase);
