"use client";

/**
 * RestaurantRealtimeProvider — reactive notifications for the restaurant area.
 *
 * Mirrors SupplierRealtimeProvider structurally but keeps the surface minimal:
 * the restaurant area only needs the user-scoped `in_app_notifications` stream.
 * (Supplier-specific tables like `order_splits` filtered by supplier_id and
 * `partnership_messages` filtered by supplier_id don't make sense here.) The
 * provider is responsible for:
 *   - subscribing to INSERT on in_app_notifications where recipient = me
 *   - maintaining a ring buffer of recent notifications + unread count
 *   - toast + chime + browser-push side effects (identical UX to supplier)
 *   - mark-read / mark-all-read helpers
 *
 * Kept intentionally separate from the supplier provider to avoid refactor
 * risk — the supplier area already works in production.
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
import type { InAppNotification } from "./supplier-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RestaurantRealtimeValue {
  connectionState: "connecting" | "connected" | "disconnected";
  recentNotifications: InAppNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  requestBrowserPushPermission: () => Promise<NotificationPermission>;
  setChimeEnabled: (enabled: boolean) => void;
  chimeEnabled: boolean;
}

const RestaurantRealtimeContext = createContext<RestaurantRealtimeValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RING_BUFFER_MAX = 20;
const ROUTER_REFRESH_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface RestaurantRealtimeProviderProps {
  profileId: string;
  initialNotifications?: InAppNotification[];
  children: React.ReactNode;
}

export function RestaurantRealtimeProvider({
  profileId,
  initialNotifications = [],
  children,
}: RestaurantRealtimeProviderProps) {
  const router = useRouter();
  const [recentNotifications, setRecentNotifications] =
    useState<InAppNotification[]>(initialNotifications);
  const [connectionState, setConnectionState] =
    useState<RestaurantRealtimeValue["connectionState"]>("connecting");
  const [chimeEnabled, setChimeEnabledState] = useState<boolean>(true);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load chime pref from localStorage once on mount.
  useEffect(() => {
    setChimeEnabledState(getChimePref());
  }, []);

  // Debounced router refresh — bursty events collapse into one RSC refetch.
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, ROUTER_REFRESH_DEBOUNCE_MS);
  }, [router]);

  // ---- Main effect: open channel and wire the notification listener
  useEffect(() => {
    if (!profileId) return;

    const supabase = createClient();
    const channelName = `restaurant:${profileId}`;
    const channel: RealtimeChannel = supabase.channel(channelName);

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

        // 2. Toast (sonner)
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

        // 3. Chime (only if visible + pref on)
        if (
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
          playChime();
        }

        // 4. Browser Notification when hidden
        if (typeof document !== "undefined" && document.hidden) {
          const splitId = (notif.metadata?.splitId as string | undefined) ?? notif.id;
          showBrowserNotification({
            title: notif.title,
            body: notif.body ?? "",
            link: notif.link ?? undefined,
            tag: `${notif.eventType}:${splitId}`,
          });
        }

        // 5. Debounced RSC refetch
        scheduleRefresh();
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
  }, [profileId, router, scheduleRefresh]);

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

  const value = useMemo<RestaurantRealtimeValue>(
    () => ({
      connectionState,
      recentNotifications,
      unreadCount,
      markNotificationRead,
      markAllRead,
      requestBrowserPushPermission,
      setChimeEnabled,
      chimeEnabled,
    }),
    [
      connectionState,
      recentNotifications,
      unreadCount,
      markNotificationRead,
      markAllRead,
      requestBrowserPushPermission,
      setChimeEnabled,
      chimeEnabled,
    ],
  );

  return (
    <RestaurantRealtimeContext.Provider value={value}>
      {children}
    </RestaurantRealtimeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook (raw)
// ---------------------------------------------------------------------------

export function useRestaurantRealtime(): RestaurantRealtimeValue | null {
  return useContext(RestaurantRealtimeContext);
}
