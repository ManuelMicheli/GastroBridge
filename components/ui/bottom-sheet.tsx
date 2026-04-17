"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Snap height: "auto" (content), "half" (50vh), "full" (90vh) */
  snap?: "auto" | "half" | "full";
  /** Show drag handle (default true) */
  showHandle?: boolean;
}

const snapHeights = {
  auto: "auto",
  half: "50vh",
  full: "90vh",
};

/**
 * BottomSheet — mobile-first drawer modal.
 * Slides up from bottom, supports swipe-to-dismiss, safe-area aware.
 * Use as alternative to Modal on viewports < md.
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
  snap = "auto",
  showHandle = true,
}: BottomSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
        >
          <motion.div
            className={cn(
              "w-full bg-white rounded-t-2xl shadow-elevated overflow-hidden",
              "pb-[var(--safe-bottom)]",
              className
            )}
            style={{ maxHeight: snapHeights[snap] }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                <div className="h-1 w-10 rounded-full bg-sage-muted" />
              </div>
            )}
            {title && (
              <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-sage-muted/40">
                <h2 className="text-lg font-semibold text-charcoal font-body">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-sage-muted/50 transition-colors focus-ring"
                  aria-label="Chiudi"
                >
                  <X className="h-5 w-5 text-sage" />
                </button>
              </div>
            )}
            <div
              className="px-6 py-4 overflow-y-auto"
              style={{ maxHeight: snap === "auto" ? "75vh" : undefined }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
