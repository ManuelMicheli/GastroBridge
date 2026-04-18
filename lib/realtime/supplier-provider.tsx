"use client";

/**
 * SupplierRealtimeProvider — single-channel reactivity for the supplier area.
 *
 * Listens to postgres_changes on:
 *   - in_app_notifications (filter: recipient_profile_id) → toast + badge + chime + push
 *   - order_splits         (filter: supplier_id)          → list/kanban/detail live data
 *   - partnership_messages (filter: supplier_id)          → messages badge
 *
 * Exposes a React Context consumed by sidebar badges, topbar bell, ordini pages,
 * dashboard, and any section that wants to react. Side effects (toast/chime/push)
 * are owned by the provider so consumers can stay declarative.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { playChime, setChimePref, getChimePref } from "@/components/supplier/realtime/chime";
import { showBrowserNotification, ensureBrowserPushPermission } from "./browser-push";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupplierEventType =
  | "order_received"
  | "order_accepted"
  | "order_shipped"
  | "order_delivered"
  | "stock_low"
  | "lot_expiring"
  | "delivery_failed"
  | "order_split_updated"
  | "message_received";

export interface InAppNotification {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface RealtimeEvent {
  type: SupplierEventType;
  splitId?: string;
  notificationId?: string;
  at: number;
  payload?: Record<string, unknown>;
}

export interface Badges {
  orders: number;
  stock: number;
  messages: number;
}

type EventHandler = (event: RealtimeEvent) => void;

export interface SupplierRealtimeValue {
  connectionState: "connecting" | "connected" | "disconnected";
  badges: Badges;
  recentNotifications: InAppNotification[];
  unreadCount: number;
  lastEvent: RealtimeEvent | null;
  onEvent: (handler: EventHandler) => () => void;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  requestBrowserPushPermission: () => Promise<NotificationPermission>;
  setChimeEnabled: (enabled: boolean) => void;
  chimeEnabled: boolean;
}

const SupplierRealtimeContext = createContext<SupplierRealtimeValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RING_BUFFER_MAX = 20;
const ROUTER_REFRESH_DEBOUNCE_MS = 500;

// Map event_type (DB enum) → badge to bump
function badgeKeyForEvent(eventType: string): keyof Badges | null {
  switch (eventType) {
    case "order_received":
    case "order_accepted":
    case "order_shipped":
    case "order_delivered":
    case "delivery_failed":
      return "orders";
    case "stock_low":
    case "lot_expiring":
      return "stock";
    case "message_received":
      return "messages";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface SupplierRealtimeProviderProps {
  supplierId: string;
  profileId: string;
  initialBadges: Badges;
  initialNotifications?: InAppNotification[];
  children: React.ReactNode;
}

export function SupplierRealtimeProvider({
  supplierId,
  profileId,
  initialBadges,
  initialNotifications = [],
  children,
}: SupplierRealtimeProviderProps) {
  const router = useRouter();
  const [badges, setBadges] = useState<Badges>(initialBadges);
  const [recentNotifications, setRecentNotifications] =
    useState<InAppNotification[]>(initialNotifications);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [connectionState, setConnectionState] =
    useState<SupplierRealtimeValue["connectionState"]>("connecting");
  const [chimeEnabled, setChimeEnabledState] = useState<boolean>(true);

  const handlersRef = useRef<Set<EventHandler>>(new Set());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load chime pref from localStorage once on mount.
  useEffect(() => {
    setChimeEnabledState(getChimePref());
  }, []);

  // Keep initial badges in sync if parent re-seeds (e.g. after full refresh).
  // We intentionally depend only on the primitive values so a new object
  // reference with identical counts does not trigger a re-sync.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setBadges(initialBadges);
  }, [initialBadges.orders, initialBadges.stock, initialBadges.messages]);

  // Debounced router refresh — bursty events collapse into one RSC refetch.
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, ROUTER_REFRESH_DEBOUNCE_MS);
  }, [router]);

  const emitEvent = useCallback((event: RealtimeEvent) => {
    setLastEvent(event);
    handlersRef.current.forEach((h) => {
      try {
        h(event);
      } catch (err) {
        console.error("[supplier-realtime] handler threw", err);
      }
    });
  }, []);

  const onEvent = useCallback((handler: EventHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  // ---- Main effect: open channel and wire all listeners
  useEffect(() => {
    if (!supplierId || !profileId) return;

    const supabase = createClient();
    const channelName = `supplier:${supplierId}:${profileId}`;
    const channel: RealtimeChannel = supabase.channel(channelName);

    // ----- in_app_notifications: canonical fan-out
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "in_app_notifications",
        filter: `recipient_profile_id=eq.${profileId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row) return;

        const notif: InAppNotification = {
          id: String(row.id),
          eventType: String(row.event_type ?? "unknown"),
          title: String(row.title ?? ""),
          body: (row.body as string | null) ?? null,
          link: (row.link as string | null) ?? null,
          metadata: (row.metadata as Record<string, unknown> | null) ?? null,
          readAt: (row.read_at as string | null) ?? null,
          createdAt: String(row.created_at ?? new Date().toISOString()),
        };

        // 1. Prepend to ring buffer (cap RING_BUFFER_MAX)
        setRecentNotifications((prev) =>
          [notif, ...prev].slice(0, RING_BUFFER_MAX),
        );

        // 2. Increment the right badge
        const key = badgeKeyForEvent(notif.eventType);
        if (key) {
          setBadges((prev) => ({ ...prev, [key]: prev[key] + 1 }));
        }

        // 3. Toast (sonner)
        toast(notif.title, {
          description: notif.body ?? undefined,
          action: notif.link
            ? {
                label: "Apri",
                onClick: () => router.push(notif.link!),
              }
            : undefined,
          duration: 6000,
        });

        // 4. Chime (only if visible + pref on)
        if (
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
          playChime();
        }

        // 5. Browser Notification when hidden
        if (typeof document !== "undefined" && document.hidden) {
          const splitId = (notif.metadata?.splitId as string | undefined) ?? notif.id;
          showBrowserNotification({
            title: notif.title,
            body: notif.body ?? "",
            link: notif.link ?? undefined,
            tag: `${notif.eventType}:${splitId}`,
          });
        }

        // 6. Fire event for consumers
        const splitId = notif.metadata?.splitId as string | undefined;
        emitEvent({
          type: (notif.eventType as SupplierEventType) ?? "order_received",
          splitId,
          notificationId: notif.id,
          at: Date.now(),
          payload: notif.metadata ?? undefined,
        });

        // 7. Debounced RSC refetch
        scheduleRefresh();
      },
    );

    // ----- order_splits: status transitions for list/kanban
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_splits",
        filter: `supplier_id=eq.${supplierId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const newRow = payload.new as Record<string, unknown> | null;
        const oldRow = payload.old as Record<string, unknown> | null;
        const splitId = String(newRow?.id ?? oldRow?.id ?? "");

        // If a split transitions OUT of `submitted`, decrement orders badge.
        // If it transitions INTO `submitted`, increment (new order landed via INSERT path).
        if (payload.eventType === "UPDATE" && newRow && oldRow) {
          const wasSubmitted = oldRow.status === "submitted";
          const isSubmitted = newRow.status === "submitted";
          if (wasSubmitted && !isSubmitted) {
            setBadges((prev) => ({ ...prev, orders: Math.max(0, prev.orders - 1) }));
          } else if (!wasSubmitted && isSubmitted) {
            setBadges((prev) => ({ ...prev, orders: prev.orders + 1 }));
          }
        }

        emitEvent({
          type: "order_split_updated",
          splitId,
          at: Date.now(),
          payload: {
            status: newRow?.status,
            previousStatus: oldRow?.status,
            eventName: payload.eventType,
          },
        });

        scheduleRefresh();
      },
    );

    // ----- partnership_messages: unread badge hint (the chat thread keeps its own subscription)
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "partnership_messages",
        filter: `supplier_id=eq.${supplierId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row) return;
        // Only count messages where the sender is NOT the current profile.
        if (row.sender_profile_id && row.sender_profile_id !== profileId) {
          setBadges((prev) => ({ ...prev, messages: prev.messages + 1 }));
          emitEvent({
            type: "message_received",
            at: Date.now(),
            payload: row,
          });
        }
      },
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setConnectionState("connected");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionState("disconnected");
      } else if (status === "CLOSED") {
        setConnectionState("disconnected");
      }
    });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [supplierId, profileId, router, emitEvent, scheduleRefresh]);

  // ---- Public actions
  const markNotificationRead = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("in_app_notifications")
        .update({ read_at: now })
        .eq("id", id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: now } : n)),
      );
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    const supabase = createClient();
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("in_app_notifications")
      .update({ read_at: now })
      .eq("recipient_profile_id", profileId)
      .is("read_at", null);
    setRecentNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: now })),
    );
  }, [profileId]);

  const requestBrowserPushPermission = useCallback(async () => {
    return ensureBrowserPushPermission();
  }, []);

  const setChimeEnabled = useCallback((enabled: boolean) => {
    setChimePref(enabled);
    setChimeEnabledState(enabled);
  }, []);

  const unreadCount = useMemo(
    () => recentNotifications.filter((n) => !n.readAt).length,
    [recentNotifications],
  );

  const value = useMemo<SupplierRealtimeValue>(
    () => ({
      connectionState,
      badges,
      recentNotifications,
      unreadCount,
      lastEvent,
      onEvent,
      markNotificationRead,
      markAllRead,
      requestBrowserPushPermission,
      setChimeEnabled,
      chimeEnabled,
    }),
    [
      connectionState,
      badges,
      recentNotifications,
      unreadCount,
      lastEvent,
      onEvent,
      markNotificationRead,
      markAllRead,
      requestBrowserPushPermission,
      setChimeEnabled,
      chimeEnabled,
    ],
  );

  return (
    <SupplierRealtimeContext.Provider value={value}>
      {children}
    </SupplierRealtimeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook (raw)
// ---------------------------------------------------------------------------

export function useSupplierRealtime(): SupplierRealtimeValue | null {
  return useContext(SupplierRealtimeContext);
}
