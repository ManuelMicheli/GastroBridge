"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PulseDot } from "@/components/supplier/signature";
import { useRecentNotifications } from "@/lib/realtime/supplier-hooks";

type Props = {
  /** Legacy prop — ignored when the supplier realtime provider is mounted. */
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
  const pathname = usePathname();
  const router = useRouter();
  const isSupplier = pathname.startsWith("/supplier");
  const { notifications, unreadCount, markRead, markAllRead } = useRecentNotifications();

  const effectiveCount = isSupplier ? unreadCount : legacyCount;

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (isSupplier) {
    const hasUnread = effectiveCount > 0;
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="relative h-10 w-10 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors inline-flex items-center justify-center"
          aria-label={`Notifiche (${effectiveCount} non lette)`}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <>
              <span className="absolute -top-1 -right-1">
                <Badge variant="highlight" size="xs" mono>
                  {effectiveCount > 9 ? "9+" : effectiveCount}
                </Badge>
              </span>
              <span className="absolute -top-1.5 -right-1.5 pointer-events-none">
                <PulseDot variant="brand" size={6} />
              </span>
            </>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-96 max-h-[32rem] overflow-hidden bg-surface-elevated border border-border-default rounded-xl shadow-elevated-dark z-50 flex flex-col">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Notifiche</h3>
              {hasUnread && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs text-accent-green hover:underline inline-flex items-center gap-1"
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
        aria-label="Notifiche"
      >
        <Bell className="h-5 w-5" />
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
