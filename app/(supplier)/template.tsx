"use client";

import { MobileRouteTransition } from "@/components/shared/mobile-route-transition";

export default function SupplierRouteTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MobileRouteTransition>{children}</MobileRouteTransition>;
}
