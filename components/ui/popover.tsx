"use client";

import {
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useId,
  useRef,
  useState,
  cloneElement,
  isValidElement,
} from "react";
import { cn } from "@/lib/utils/formatters";

type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  placement?: PopoverPlacement;
  className?: string;
  contentClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  trigger,
  children,
  placement = "bottom-start",
  className,
  contentClassName,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        contentRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const placementClass: Record<PopoverPlacement, string> = {
    "bottom-start": "top-full left-0 mt-1.5",
    "bottom-end": "top-full right-0 mt-1.5",
    "top-start": "bottom-full left-0 mb-1.5",
    "top-end": "bottom-full right-0 mb-1.5",
  };

  const triggerProps = {
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el;
    },
    "aria-expanded": open,
    "aria-controls": id,
    "aria-haspopup": "dialog" as const,
    onClick: (e: ReactMouseEvent) => {
      e.stopPropagation();
      setOpen(!open);
    },
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {isValidElement(trigger) ? (
        cloneElement(
          trigger as React.ReactElement<Record<string, unknown>>,
          triggerProps as Record<string, unknown>
        )
      ) : (
        <button {...triggerProps} type="button">
          {trigger}
        </button>
      )}
      {open && (
        <div
          id={id}
          ref={contentRef}
          role="dialog"
          className={cn(
            "absolute z-50 min-w-[180px] motion-spring",
            "rounded-lg border border-[color:var(--color-border-default)]",
            "bg-[color:var(--color-surface-card)] p-1",
            placementClass[placement],
            contentClassName
          )}
          style={{ boxShadow: "var(--elevation-modal-active)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface PopoverItemProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  shortcut?: string;
  destructive?: boolean;
  className?: string;
}

export function PopoverItem({
  children,
  onClick,
  disabled,
  shortcut,
  destructive,
  className,
}: PopoverItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors",
        "hover:bg-[color:var(--color-surface-hover)]",
        "focus-visible:outline-none focus-visible:bg-[color:var(--color-surface-hover)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        destructive
          ? "text-[color:var(--color-error)]"
          : "text-[color:var(--color-text-primary)]",
        className
      )}
      style={{
        fontSize: "var(--text-body)",
        lineHeight: "var(--text-body--line-height)",
      }}
    >
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span
          className="text-[color:var(--color-text-tertiary)]"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

export function PopoverDivider() {
  return <div className="my-1 h-px bg-[color:var(--color-border-subtle)]" />;
}

export type { PopoverPlacement, PopoverProps };
