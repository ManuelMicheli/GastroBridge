"use client";

import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { signOut } from "@/app/(auth)/actions";
import { resolveIcon } from "../icons";
import type { NavItem } from "../sidebar/sidebar-item";

type Props = {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  role: "restaurant" | "supplier";
  companyName: string;
};

export function SidebarDrawer({ open, onClose, navItems, role, companyName }: Props) {
  const pathname = usePathname();

  const initials = companyName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed left-0 top-0 bottom-0 w-72 bg-surface-sidebar border-r border-border-subtle z-50 flex flex-col lg:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 h-16 border-b border-border-subtle">
              <div className="flex items-center gap-1">
                <span className="text-lg font-display text-text-primary">Gastro</span>
                <span className="text-lg font-bold text-accent-green">Bridge</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Role badge */}
            <div className="px-5 py-3">
              <span className="text-[10px] uppercase tracking-widest font-bold text-text-tertiary">
                {role === "supplier" ? "Area Fornitore" : "Area Ristorante"}
              </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = resolveIcon(item.iconName);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent-green-muted text-accent-green"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User + Logout */}
            <div className="border-t border-border-subtle p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-accent-green-muted flex items-center justify-center">
                  <span className="text-xs font-bold text-accent-green">{initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{companyName}</p>
                </div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-tertiary hover:text-text-warning hover:bg-surface-hover transition-colors w-full"
                >
                  <LogOut className="h-5 w-5" />
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
