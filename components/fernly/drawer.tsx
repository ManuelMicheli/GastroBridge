"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { usePortalTarget } from "@/components/ui/modal";
import { cn } from "@/lib/utils/formatters";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Right side drawer — floating panel inset 8 px from the viewport edges,
 * dimmed backdrop, panel slides in from the right (≈380 ms) and its direct
 * <DrawerItem> children stagger in (spec §5 "drawer").
 */
export function Drawer({
  open,
  onClose,
  label,
  children,
  className,
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  width?: number;
}) {
  const target = usePortalTarget();
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => panel.current?.focus({ preventScroll: true }), 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  if (!target) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[65]">
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(20,24,22,0.30)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.2 } }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.18 } }}
            onClick={onClose}
          />
          <motion.aside
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={cn(
              "absolute bottom-2 right-2 top-2 flex flex-col overflow-hidden rounded-[24px] bg-[var(--f-card)] text-[var(--f-ink)] outline-none",
              "shadow-[0_2px_6px_rgba(16,24,20,0.06),0_28px_70px_rgba(16,24,20,0.22)]",
              className,
            )}
            style={{ width: `min(${width}px, calc(100vw - 16px))` }}
            initial={reduce ? { opacity: 0 } : { x: "105%" }}
            animate={{ x: 0, opacity: 1, transition: { duration: reduce ? 0 : 0.38, ease: EASE } }}
            exit={reduce ? { opacity: 0 } : { x: "105%", transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="f-icon-btn absolute right-4 top-4 z-10 !h-9 !w-9 !border-0 !bg-[var(--f-fill)] hover:!bg-[var(--f-fill-2)]"
            >
              <X className="h-4 w-4" />
            </button>
            <motion.div
              className="f-scroll flex-1 overflow-y-auto px-6 pb-6 pt-8"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: reduce ? 0 : 0.05, delayChildren: reduce ? 0 : 0.15 } },
              }}
            >
              {children}
            </motion.div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    target,
  );
}

/** Direct child of <Drawer> that takes part in the stagger. */
export function DrawerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}
