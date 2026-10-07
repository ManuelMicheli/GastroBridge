"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRecentNotifications } from "@/lib/realtime/supplier-hooks";

type Props = {
  /** Legacy prop — ignored when a realtime provider is mounted. */
  count?: number;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}g`;
}

export function NotificationBell({ count: legacyCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useRecentNotifications();

  // Prefer the live unread count from whichever provider is mounted.
  // `legacyCount` only kicks in when no provider is present (SSR fallback).
  const effectiveCount = unreadCount > 0 ? unreadCount : legacyCount;
  const hasUnread = effectiveCount > 0;

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Fernly round icon button for both areas (the dropdown is shared too).
  const buttonClasses = "f-icon-btn";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={buttonClasses}
        aria-label={`Notifiche (${effectiveCount} non lette)`}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {hasUnread && (
          <span
            aria-hidden
            className="absolute right-[10px] top-[9px] h-2 w-2 rounded-full bg-[#E5484D] ring-2 ring-[var(--f-card)]"
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 flex max-h-[32rem] w-96 flex-col overflow-hidden rounded-[20px] border border-[var(--f-line)] bg-[var(--f-card)] shadow-[0_2px_6px_rgba(16,24,20,0.06),0_24px_56px_rgba(16,24,20,0.16)]">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Notifiche</h3>
            {hasUnread && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-[var(--acc-700)] hover:underline inline-flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Segna tutte lette
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-8">
                Nessuna nuova notifica
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {notifications.map((n) => {
                  const isUnread = !n.readAt;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          void markRead(n.id);
                          setOpen(false);
                          if (n.link) router.push(n.link);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors ${
                          isUnread ? "bg-brand-primary-subtle/30" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {isUnread && (
                            <span
                              className="mt-1.5 h-2 w-2 rounded-full bg-accent-green shrink-0"
                              aria-hidden
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-text-primary line-clamp-1">
                                {n.title}
                              </p>
                              <span className="text-[10px] text-text-tertiary whitespace-nowrap mt-0.5">
                                {formatRelative(n.createdAt)}
                              </span>
                            </div>
                            {n.body && (
                              <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                                {n.body}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
