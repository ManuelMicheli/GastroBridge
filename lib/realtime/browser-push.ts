"use client";

/**
 * Foreground browser Notification API helper — used when the supplier's tab is
 * hidden/backgrounded. Background pushes (tab closed) go through the existing
 * service-worker + web-push path in lib/notifications/push.ts.
 */

const PUSH_PREF_KEY = "supplier.notifications.browserPush";

export function getBrowserPushPref(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(PUSH_PREF_KEY);
  if (raw === null) return true;
  return raw === "1";
}

export function setBrowserPushPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PUSH_PREF_KEY, enabled ? "1" : "0");
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function ensureBrowserPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export interface ShowNotificationInput {
  title: string;
  body?: string;
  link?: string;
  tag?: string;
}

export function showBrowserNotification(input: ShowNotificationInput): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!getBrowserPushPref()) return;

  try {
    const n = new Notification(input.title, {
      body: input.body,
      tag: input.tag,
      icon: "/favicon.ico",
    });
    if (input.link) {
      n.onclick = () => {
        try {
          window.focus();
          window.location.href = input.link!;
        } catch {
          /* ignore */
        }
        n.close();
      };
    }
  } catch {
    // Some browsers throw when constructing Notification from an insecure context
    // or when quota is exceeded — swallow quietly.
  }
}
