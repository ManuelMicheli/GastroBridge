"use client";

import { useCart } from "@/lib/hooks/useCart";
import { DarkMobileNav, type MobileNavItem } from "./dark-mobile-nav";

type Props = {
  items: MobileNavItem[];
  /** Which item's href should display the cart count badge */
  cartHref?: string;
};

/**
 * Client wrapper that reads cart context and injects badgeCount
 * into the matching nav item. Used only in restaurant area.
 */
export function DarkMobileNavWithCart({
  items,
  cartHref = "/carrello",
}: Props) {
  const { totalItems } = useCart();

  const itemsWithBadge = items.map((item) =>
    item.href === cartHref ? { ...item, badgeCount: totalItems } : item
  );

  return <DarkMobileNav items={itemsWithBadge} />;
}
