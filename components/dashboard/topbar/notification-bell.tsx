"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PulseDot } from "@/components/supplier/signature";

type Props = {
  /** Number of unread notifications. Defaults to 0 (no real count wired yet). */
  count?: number;
};

export function NotificationBell({ count = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isSupplier = pathname.startsWith("/supplier");

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (isSupplier) {
    const hasUnread = count > 0;
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="relative h-10 w-10 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors inline-flex items-center justify-center"
          aria-label={`Notifiche (${count} non lette)`}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <>
              <span className="absolute -top-1 -right-1">
                <Badge variant="highlight" size="xs" mono>
                  {count > 9 ? "9+" : count}
                </Badge>
              </span>
              <span className="absolute -top-1.5 -right-1.5 pointer-events-none">
                <PulseDot variant="brand" size={6} />
              </span>
            </>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-border-default rounded-xl shadow-elevated-dark z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle">
              <h3 className="text-sm font-semibold text-text-primary">Notifiche</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-text-tertiary text-center py-6">
                Nessuna nuova notifica
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
        aria-label="Notifiche"
      >
        <Bell className="h-5 w-5" />
        {/* Notification dot */}
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent-green ring-2 ring-surface-base" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-border-default rounded-xl shadow-elevated-dark z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h3 className="text-sm font-semibold text-text-primary">Notifiche</h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-text-tertiary text-center py-6">
              Nessuna nuova notifica
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
