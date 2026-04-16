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
      // Scroll top instant on route change.
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

      // Focus the h1 of the new page for screen readers.
      requestAnimationFrame(() => {
        const h1 = el.querySelector("h1");
        if (h1) {
          if (!h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
          (h1 as HTMLElement).focus({ preventScroll: true });
        }
      });

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
