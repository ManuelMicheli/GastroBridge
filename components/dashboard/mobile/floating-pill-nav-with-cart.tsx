"use client";

import { useCart } from "@/lib/hooks/useCart";
import { FloatingPillNav, type PillNavItem } from "./floating-pill-nav";

type Props = {
  items: PillNavItem[];
  cartHref?: string;
};

export function FloatingPillNavWithCart({
  items,
  cartHref = "/carrello",
}: Props) {
  const { totalItems } = useCart();

  const itemsWithBadge = items.map((item) =>
    item.href === cartHref ? { ...item, badgeCount: totalItems } : item
  );

  return <FloatingPillNav items={itemsWithBadge} />;
}
