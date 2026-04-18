"use client";

import { useEffect, useRef } from "react";
import {
  useSupplierRealtime,
  type Badges,
  type InAppNotification,
  type RealtimeEvent,
  type SupplierEventType,
} from "./supplier-provider";
import { useRestaurantRealtime } from "./restaurant-provider";

/**
 * Live badge counts. Safe to call outside the supplier area — returns zeroes.
 */
export function useBadges(): Badges {
  const ctx = useSupplierRealtime();
  return ctx?.badges ?? { orders: 0, stock: 0, messages: 0 };
}

/**
 * Ring buffer of recent in-app notifications + read helpers. Universal across
 * the restaurant and supplier areas — reads from whichever provider is mounted.
 * Returns empty defaults if neither is present (safe to call anywhere).
 */
export function useRecentNotifications(): {
  notifications: InAppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
} {
  const supplier = useSupplierRealtime();
  const restaurant = useRestaurantRealtime();
  // If both are mounted (shouldn't happen), supplier wins — the supplier area
  // is the more data-rich context.
  const ctx = supplier ?? restaurant;
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      markRead: async () => {},
      markAllRead: async () => {},
    };
  }
  // Supplier ctx shape: { recentNotifications, unreadCount, markNotificationRead, markAllRead, ... }
  // Restaurant ctx shape: { recentNotifications, unreadCount, markNotificationRead, markAllRead, ... }
  return {
    notifications: ctx.recentNotifications,
    unreadCount: ctx.unreadCount,
    markRead: ctx.markNotificationRead,
    markAllRead: ctx.markAllRead,
  };
}

/**
 * Subscribe to the realtime event stream. The handler is invoked for every
 * event fired by the provider — optionally filter by `types`.
 *
 * The handler ref pattern keeps the subscription stable: we attach once and
 * always dispatch to the current handler without re-subscribing.
 */
export function useOnEvent(
  handler: (event: RealtimeEvent) => void,
  types?: SupplierEventType[],
): void {
  const ctx = useSupplierRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    const wrapped = (event: RealtimeEvent) => {
      if (types && !types.includes(event.type)) return;
      handlerRef.current(event);
    };
    return ctx.onEvent(wrapped);
    // stringify types so the effect doesn't re-subscribe on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, types?.join(",") ?? ""]);
}

/**
 * Connection status (connecting/connected/disconnected). Useful for a topbar
 * live indicator dot.
 */
export function useRealtimeStatus(): "connecting" | "connected" | "disconnected" | "offline" {
  const ctx = useSupplierRealtime();
  return ctx?.connectionState ?? "offline";
}

/**
 * Preferences accessor — used by the notifications settings pages. Reads from
 * whichever provider is mounted (supplier or restaurant).
 */
export function useNotificationPrefs(): {
  chimeEnabled: boolean;
  setChimeEnabled: (enabled: boolean) => void;
  requestBrowserPushPermission: () => Promise<NotificationPermission>;
} {
  const supplier = useSupplierRealtime();
  const restaurant = useRestaurantRealtime();
  const ctx = supplier ?? restaurant;
  return {
    chimeEnabled: ctx?.chimeEnabled ?? true,
    setChimeEnabled: ctx?.setChimeEnabled ?? (() => {}),
    requestBrowserPushPermission:
      ctx?.requestBrowserPushPermission ?? (async () => "default" as NotificationPermission),
  };
}
