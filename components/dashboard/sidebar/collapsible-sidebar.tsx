"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LogOut, PanelLeftClose, PanelLeft } from "lucide-react";
import { useSidebar } from "./sidebar-provider";
import { SidebarItem, type NavItem } from "./sidebar-item";
import { IdlePrefetch } from "@/components/shared/idle-prefetch";
import { signOut } from "@/app/(auth)/actions";
import { BrandMark, BrandWordmark } from "@/components/fernly/brand-mark";
import { InstallPromo } from "@/components/fernly/install-promo";
import { cn } from "@/lib/utils/formatters";

type Props = {
  navItems: NavItem[];
  role: "restaurant" | "supplier";
  companyName: string;
  userEmail: string;
};

/** Uppercase group label: the unnamed first group is "MENU". */
function groupLabel(section: string): string {
  return section === "main" ? "Menu" : section;
}

/**
 * Fernly sidebar — floating panel with logo, uppercase group labels, line
 * icons, an accent bar that slides to the active item, and the install promo
 * at the bottom. Ctrl/⌘+B still collapses it to an icon rail.
 */
export function CollapsibleSidebar({ navItems, role }: Props) {
  const { isCollapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const homeHref = role === "supplier" ? "/supplier/dashboard" : "/dashboard";

  const sections = useMemo(() => {
    const out: Record<string, NavItem[]> = {};
    for (const item of navItems) {
      const section = item.section || "main";
      (out[section] ??= []).push(item);
    }
    return out;
  }, [navItems]);

  const prefetchHrefs = useMemo(() => navItems.map((n) => n.href), [navItems]);

  // Sliding active indicator — measured from the item SidebarItem marks with
  // data-active (the active-route logic lives in SidebarItem).
  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ y: number; visible: boolean }>({ y: 0, visible: false });

  const measure = useCallback(() => {
    const aside = asideRef.current;
    const nav = navRef.current;
    if (!aside || !nav) return;
    const active = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return setBar((b) => ({ ...b, visible: false }));
    const a = aside.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    setBar({ y: r.top - a.top + r.height / 2 - 12, visible: true });
  }, []);

  useLayoutEffect(() => {
    measure();
    const id = window.setTimeout(measure, 280); // after the width animation
    const nav = navRef.current;
    nav?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      nav?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [pathname, isCollapsed, measure, navItems]);

  return (
    <aside
      ref={asideRef}
      className={cn(
        "relative z-30 hidden shrink-0 flex-col lg:flex",
        "sticky top-2.5 h-[calc(100vh-20px)] rounded-[24px] bg-[var(--f-panel)]",
        "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isCollapsed ? "w-[84px]" : "w-[248px]",
      )}
    >
      {/* Active indicator glued to the panel's left edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-6 w-[3px] rounded-r-full bg-[var(--acc-600)] transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(${bar.y}px)`, opacity: bar.visible ? 1 : 0 }}
      />

      {/* Logo */}
      <div className={cn("group/logo flex h-[72px] items-center px-5", isCollapsed ? "justify-center px-0" : "justify-between")}>
        <Link href={homeHref} className="flex items-center gap-2.5 overflow-hidden" aria-label="GastroBridge — Dashboard">
          <BrandMark />
          {!isCollapsed && <BrandWordmark />}
        </Link>
        {!isCollapsed && (
          <button
            onClick={toggle}
            className="rounded-full p-1.5 text-[var(--f-faint)] opacity-0 transition-opacity hover:bg-[var(--f-fill-2)] hover:text-[var(--f-ink)] focus-visible:opacity-100 group-hover/logo:opacity-100"
            title="Comprimi sidebar (Ctrl+B)"
            aria-label="Comprimi sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>
      {isCollapsed && (
        <div className="flex justify-center pb-1">
          <button
            onClick={toggle}
            className="rounded-full p-1.5 text-[var(--f-faint)] hover:bg-[var(--f-fill-2)] hover:text-[var(--f-ink)]"
            title="Espandi sidebar (Ctrl+B)"
            aria-label="Espandi sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav ref={navRef} className="f-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3" aria-label="Navigazione">
        {Object.entries(sections).map(([section, items], sIdx) => (
          <div key={section} className={cn(sIdx > 0 && "mt-5")}>
            {isCollapsed ? (
              sIdx > 0 ? <div className="mx-3 mb-3 border-t border-[var(--f-line)]" /> : null
            ) : (
              <p className="f-eyebrow mb-1.5 px-3 !font-medium !tracking-[0.1em] !text-[var(--f-faint)]">{groupLabel(section)}</p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => (
                <SidebarItem key={item.href} {...item} role={role} />
              ))}
              {/* Logout lives at the end of the last group, like the reference */}
              {sIdx === Object.keys(sections).length - 1 && (
                <form action={signOut}>
                  <button
                    type="submit"
                    title={isCollapsed ? "Esci" : undefined}
                    className={cn(
                      "group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium text-[var(--f-muted)] transition-colors hover:text-[var(--f-ink)]",
                      isCollapsed && "justify-center",
                    )}
                  >
                    <LogOut className="h-[19px] w-[19px] shrink-0" strokeWidth={1.75} />
                    {!isCollapsed && <span>Esci</span>}
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("p-3", isCollapsed && "pb-4")}>
        <InstallPromo collapsed={isCollapsed} />
      </div>

      <IdlePrefetch hrefs={prefetchHrefs} />
    </aside>
  );
}
