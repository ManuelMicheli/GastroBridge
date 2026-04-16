"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function RestaurantRouteTemplate({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isRouteChange = prevPathname.current !== pathname;
    prevPathname.current = pathname;
    const el = wrapperRef.current;
    if (!el) return;

    if (isRouteChange) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      el.style.opacity = "0";
      el.style.transform = "translateY(4px)";
      requestAnimationFrame(() => {
        el.style.transition =
          "opacity var(--duration-page, 240ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)), transform var(--duration-page, 240ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1))";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    }
  }, [pathname]);

  return (
    <div
      ref={wrapperRef}
      key={pathname}
      style={{ opacity: 1, transform: "translateY(0)", willChange: "opacity, transform" }}
    >
      {children}
    </div>
  );
}
