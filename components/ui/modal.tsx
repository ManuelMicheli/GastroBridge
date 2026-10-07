"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFocusTrap } from "./use-focus-trap";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Optional muted line under the title. */
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "max-w-[420px]",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Portal target: the app shell renders `#f-portal` inside its `[data-area]`
 * root so overlays keep the area tokens (accent, font). Falls back to body.
 */
export function usePortalTarget(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.getElementById("f-portal") ?? document.body);
  }, []);
  return el;
}

/**
 * Fernly modal — dimmed + blurred backdrop, panel scales in from .96 with a
 * short content stagger (spec §5: backdrop ≈120 ms, panel ≈260 ms, close
 * ≈120 ms). Escape and backdrop click close it; body scroll is locked.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const target = usePortalTarget();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Keep Tab inside the dialog while it is open.
  useFocusTrap(contentRef, isOpen, { autoFocus: false });

  // Move focus into the dialog when it opens (a11y), restore on close.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => {
      const node = contentRef.current;
      if (!node) return;
      const first = node.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type=hidden]), select, textarea, button:not([aria-label='Chiudi'])",
      );
      (first ?? node).focus({ preventScroll: true });
    }, 30);
    return () => {
      window.clearTimeout(id);
      prev?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  if (!target) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-4"
          style={{
            background: "rgba(20, 24, 22, 0.28)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.14 } }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
          onMouseDown={handleOverlayClick}
        >
          <motion.div
            ref={contentRef}
            tabIndex={-1}
            className={cn(
              "w-full max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[20px] bg-[var(--f-card)] p-6 text-[var(--f-ink)] outline-none",
              "shadow-[0_2px_6px_rgba(16,24,20,0.06),0_28px_64px_rgba(16,24,20,0.20)]",
              sizeStyles[size],
              className,
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: reduce ? 0 : 0.26, ease: EASE },
            }}
            exit={{
              opacity: 0,
              scale: reduce ? 1 : 0.98,
              transition: { duration: reduce ? 0 : 0.12 },
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {title && (
              <motion.div
                className="mb-5 flex items-start justify-between gap-4"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.06, duration: 0.24, ease: EASE } }}
              >
                <div className="min-w-0">
                  <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">
                    {title}
                  </h2>
                  {description ? (
                    <p className="mt-1 text-[13.5px] text-[var(--f-muted)]">{description}</p>
                  ) : null}
                </div>
                <button
                  onClick={onClose}
                  className="f-icon-btn !h-8 !w-8 !border-0 !bg-[var(--f-fill)] hover:!bg-[var(--f-fill-2)]"
                  aria-label="Chiudi"
                >
                  <X className="h-4 w-4 text-[var(--f-ink-2)]" />
                </button>
              </motion.div>
            )}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.26, ease: EASE } }}
            >
              {children}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    target,
  );
}

/** Right-aligned footer row with pill buttons (Cancel / primary). */
export function ModalActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-6 flex flex-wrap items-center justify-end gap-2", className)}>
      {children}
    </div>
  );
}
