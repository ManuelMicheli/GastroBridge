"use client";

import { useSidebar } from "./sidebar-provider";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { AnimatePresence, motion } from "motion/react";

type Props = {
  companyName: string;
  userEmail: string;
};

export function SidebarUserCard({ companyName, userEmail }: Props) {
  const { isCollapsed } = useSidebar();

  const initials = companyName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border-t border-border-subtle p-3">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="shrink-0 h-9 w-9 rounded-lg bg-accent-green-muted flex items-center justify-center">
          <span className="text-xs font-bold text-accent-green">{initials}</span>
        </div>

        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-hidden min-w-0"
            >
              <p className="text-sm font-medium text-text-primary truncate">
                {companyName}
              </p>
              <p className="text-xs text-text-tertiary truncate">{userEmail}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.form
              action={signOut}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="submit"
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-warning hover:bg-surface-hover transition-colors"
                title="Esci"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Collapsed: just avatar with logout on hover */}
      {isCollapsed && (
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="w-full flex justify-center p-1.5 rounded-lg text-text-tertiary hover:text-text-warning hover:bg-surface-hover transition-colors"
            title="Esci"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
