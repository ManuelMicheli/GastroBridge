"use client";

import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils/formatters";
import { signOut } from "@/app/(auth)/actions";
import { resolveIcon } from "../icons";
import type { NavItem } from "../sidebar/sidebar-item";
import { BrandMark, BrandWordmark } from "@/components/fernly/brand-mark";
import { Avatar } from "@/components/fernly/primitives";

type Props = {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  role: "restaurant" | "supplier";
  companyName: string;
};

export function SidebarDrawer({ open, onClose, navItems, role, companyName }: Props) {
  const pathname = usePathname();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx < -80 && Math.abs(dx) > Math.abs(dy)) {
      onClose();
    }
  }


  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden bg-[rgba(20,24,22,0.30)] backdrop-blur-[4px]"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="fixed left-2 top-2 bottom-2 w-[min(288px,calc(100vw-48px))] rounded-[24px] bg-[var(--f-panel)] shadow-[0_24px_60px_rgba(16,24,20,0.22)] z-50 flex flex-col overflow-hidden lg:hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-[72px]">
              <div className="flex items-center gap-2.5">
                <BrandMark size={32} />
                <BrandWordmark />
              </div>
              <button
                onClick={onClose}
                aria-label="Chiudi menu"
                className="f-icon-btn !h-9 !w-9"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Role badge */}
            <div className="px-6 pb-1.5">
              <span className="f-eyebrow !font-medium !tracking-[0.1em] !text-[var(--f-faint)]">
                {role === "supplier" ? "Area fornitore" : "Menu"}
              </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
                // Most specific match wins (/finanze vs /finanze/ordini-consigliati).
                const isActive =
                  matches(item.href) &&
                  !navItems.some((n) => n.href.length > item.href.length && matches(n.href));
                const Icon = resolveIcon(item.iconName);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
                      isActive
                        ? "font-semibold text-[var(--f-ink)] bg-[var(--f-card)] shadow-[0_1px_2px_rgba(16,24,20,0.05)]"
                        : "font-medium text-[var(--f-muted)] hover:text-[var(--f-ink)]"
                    )}
                  >
                    {isActive && (
                      <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--acc-600)]" />
                    )}
                    <Icon className={cn("h-5 w-5", isActive && "text-[var(--acc-600)]")} strokeWidth={isActive ? 2 : 1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User + Logout */}
            <div className="m-3 rounded-[18px] bg-[var(--f-card)] p-3">
              <div className="flex items-center gap-3 mb-2">
                <Avatar name={companyName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{companyName}</p>
                </div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="f-btn f-btn-sm f-btn-soft w-full"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </button>
              </form>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
