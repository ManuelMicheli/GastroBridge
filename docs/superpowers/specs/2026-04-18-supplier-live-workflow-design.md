# Supplier Live Workflow — Design

**Date:** 2026-04-18
**Branch:** feat/awwwards-redesign
**Scope:** make the entire `app/(supplier)` area reactive — when a new order (or any workflow event) lands, every mounted section updates and the supplier is actively notified.

## Goal

When a workflow event fires on the server (new order, status change, new message, stock threshold crossed), the supplier's browser tab should:

1. Update sidebar badges (orders / stock / messages) live.
2. Surface a toast + optional chime + browser Notification (when tab hidden).
3. Reactively refresh the section currently in view (list, kanban, detail, dashboard KPIs).
4. Not require a manual page reload anywhere.

Minimum bar agreed with user: **A + B + C + D** full tier (live counters, active notifications, live data everywhere, cross-page handoff). Event scope: orders + stock + messages (tier C).

## Non-goals

- Multi-supplier switcher (deferred — Fase 1B).
- Quiet-hours / do-not-disturb (deferred).
- Low-frequency events (reviews, staff invites, DDT generation) — page refresh is fine.
- Chat thread realtime (`ChatThread` already has its own subscription — we reuse, don't touch).

## Existing primitives we build on

- `lib/notifications/dispatcher.ts` — fans out event → `in_app_notifications` row + email + web-push. Already called by `emitOrderEvent` in `lib/orders/events.ts`.
- `lib/hooks/useRealtime.ts` + `useRealtimeRefresh.ts` — generic postgres_changes wrappers.
- `components/dashboard/topbar/notification-bell.tsx` — bell UI (to be wired to context).
- `public/sw.js` or equivalent — web-push service worker (see `lib/notifications/push.ts`).
- Tables in `supabase_realtime` publication: `orders`, `order_splits`, `restaurant_suppliers`, `partnership_messages`. **Missing:** `in_app_notifications`.

## Architecture

### Single provider, one channel

```
app/(supplier)/layout.tsx  (server component, existing)
  └─ <SupplierRealtimeProvider
        supplierId={…}
        profileId={…}
        initialBadges={{ orders, stock, messages }}
        notificationPrefs={{ chimeEnabled, pushEnabled }}
     >
        <DashboardShell>{children}</DashboardShell>
     </SupplierRealtimeProvider>
```

The provider opens a **single** Supabase realtime channel `supplier:{supplierId}` that subscribes to:

| table | filter | purpose |
| --- | --- | --- |
| `in_app_notifications` | `recipient_profile_id=eq.{profileId}` | canonical fan-out — every workflow event already inserts a row here |
| `order_splits` | `supplier_id=eq.{supplierId}` | row-level UPDATE events for list/kanban/detail auto-refresh |
| `partnership_messages` | `supplier_id=eq.{supplierId}` | messages badge + topbar indicator (ChatThread keeps its own) |

Stock alerts do **not** fire postgres_changes (they live in a materialized view `mv_stock_at_risk`). Stock badge is recomputed by calling `getStockAlertCounts` after any `order_splits` update or every 60s idle poll.

### Context shape

```ts
type SupplierRealtimeContext = {
  // Live badges (seeded from server, updated optimistically + reconciled)
  badges: { orders: number; stock: number; messages: number };

  // Last N in-app notifications (ring buffer, 20 max) for the bell dropdown
  recentNotifications: InAppNotification[];

  // Last event (for components that want to react without subscribing)
  lastEvent: { type: NotificationEventType; splitId?: string; at: number } | null;

  // Subscribe to event stream (for flash-highlight in list/kanban)
  onEvent: (handler: (ev: RealtimeEvent) => void) => () => void;

  // Explicit controls
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  requestBrowserPushPermission: () => Promise<NotificationPermission>;
};
```

### Side effects triggered inside the provider

On `in_app_notifications` INSERT for the current profile:

1. **Increment badge** for the event category (orders / messages / stock).
2. **Prepend to `recentNotifications`** ring buffer.
3. **Show toast** (top-right, 6s auto-dismiss) with `title`, `body`, `link`. Click → navigate.
4. **Play chime** (`<audio>` with `/sounds/notification.mp3`) — only if `chimeEnabled` pref is on and `document.visibilityState === 'visible'`. (If hidden, the browser push notification covers alerting.)
5. **Fire browser Notification** (via `Notification API`) only when `document.hidden` is true AND permission granted.
6. **Flash event** — emit via `onEvent` for any subscribed component (e.g. list row flash-highlight).
7. **Debounced `router.refresh()`** (500ms) so the current RSC page re-fetches.

On `order_splits` UPDATE:

- Increment/decrement affected badges (e.g. status transition from `submitted` → `preparing` decrements "nuovi ordini" badge).
- Emit `onEvent({ type: 'order_split_updated', splitId, new, old })`.
- Debounced `router.refresh()`.

### Consumers

| Consumer | How it reacts |
| --- | --- |
| `components/dashboard/sidebar/sidebar-item.tsx` | Reads badges from `useBadges()`. Pulse animation on badge increment. |
| `components/dashboard/topbar/notification-bell.tsx` | Reads `recentNotifications`. Click → dropdown. |
| `app/(supplier)/supplier/ordini/orders-client.tsx` | Subscribes via `useOnEvent('order_received' \| 'order_split_updated')`. New row → flash-highlight for 1.5s. `router.refresh` is handled by provider. |
| `app/(supplier)/supplier/ordini/kanban/kanban-client.tsx` | Same as list; also optimistic column move on status change. |
| `app/(supplier)/supplier/ordini/[id]/order-detail-client.tsx` | Subscribes filtered to `splitId`. Shows inline "Updated 3s ago" indicator. |
| `app/(supplier)/supplier/dashboard/page.tsx` | KPI section keyed by `lastEvent.at` for auto-recompute (server component — relies on `router.refresh`). |
| `app/(supplier)/supplier/magazzino/*` | Subscribes to `order_split_updated` — re-fetches stock alerts. |
| `app/(supplier)/supplier/messaggi/*` | Already live via `ChatThread`; sidebar badge now also live. |

## Implementation units

Each unit = one file (or small group) with clear responsibility. Designed for isolation so they can be tested/modified independently.

### U1. DB migration — enable realtime publication

**File:** `supabase/migrations/20260418000000_supplier_realtime_publication.sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
```

(`order_splits`, `partnership_messages` already enabled.)

### U2. Realtime provider

**File:** `lib/realtime/supplier-provider.tsx`

- Single React Context + Provider.
- Opens/manages ONE Supabase channel per supplier.
- Owns badge state, ring buffer, event bus (simple `Set<Handler>`).
- Debounces `router.refresh()` to avoid thrash (500ms trailing).

### U3. Hooks

**File:** `lib/realtime/supplier-hooks.ts`

- `useSupplierRealtime()` — raw context access.
- `useBadges()` — `{ orders, stock, messages }`.
- `useOnEvent(handler, deps)` — subscribes to event bus, unsubscribes on unmount.
- `useRecentNotifications()` — ring buffer + mark-read helpers.

### U4. Toast host

**File:** `components/supplier/realtime/toast-host.tsx`

- Top-right stack. Max 3 visible, queued beyond.
- Uses existing design tokens (surface-card, accent-green/amber/red).
- Click → `router.push(link)` then dismiss.
- No new dependency — simple `useState<Toast[]>` + CSS transition.

### U5. Chime

**File:** `components/supplier/realtime/chime.ts`

- Singleton `<audio>` element (lazy-created). Source: `/sounds/notification.mp3`.
- `play()` checks pref + `visibilityState`.
- No autoplay-unlock dance needed — first user interaction on the page (they must have interacted to be logged in) satisfies Chrome's policy.

### U6. Browser push (foreground)

**File:** `lib/realtime/browser-push.ts`

- Wraps `Notification` API.
- `requestPermission()` helper (called lazy on first hidden-tab event, or via settings toggle).
- `showNotification({ title, body, link, tag })` — only called when `document.hidden`. `tag` dedupes (same splitId won't spam).

Background push (when tab closed) keeps flowing through existing `sendPush` + service worker path.

### U7. Flash-highlight utility

**File:** `components/supplier/realtime/flash-highlight.tsx`

- `useFlashOnSplitUpdate(splitId: string): string` returns a className that applies a 1.5s pulse.
- CSS token: `@keyframes flash-highlight` on `bg-accent-green/10 → transparent`.

### U8. Sidebar wiring

**Edit:** `components/dashboard/sidebar/sidebar-item.tsx` (+ sidebar-provider if needed)

- Badge prop becomes **fallback** (SSR seed). When `useBadges()` available, prefer context value.
- Pulse animation on value change (via `useEffect` watching `badge`).

### U9. Notification bell wiring

**Edit:** `components/dashboard/topbar/notification-bell.tsx`

- Replace initial-only fetch with `useRecentNotifications()` + initial SSR seed.
- Unread dot becomes reactive.

### U10. List / Kanban / Detail subscriptions

**Edits:**
- `app/(supplier)/supplier/ordini/orders-client.tsx`
- `app/(supplier)/supplier/ordini/kanban/kanban-client.tsx`
- `app/(supplier)/supplier/ordini/[id]/order-detail-client.tsx`

Add:
```tsx
useOnEvent((ev) => {
  if (ev.type === 'order_split_updated' || ev.type === 'order_received') {
    // provider already calls router.refresh(), nothing else to do except flash
  }
}, []);
```

Plus `data-split-id` on rows so flash-highlight CSS can target.

### U11. Dashboard KPI live refresh

**Edit:** `app/(supplier)/supplier/dashboard/page.tsx` (+ small client wrapper)

- Wrap dashboard body in a thin client component that subscribes and calls `router.refresh()` on relevant events (already done by provider — but we can also key important KPI blocks by `lastEvent.at` to force remount if stale data is visible briefly).

### U12. Settings — notification preferences UI

**Edit:** `app/(supplier)/supplier/impostazioni/notifiche/page.tsx`

- Add toggles: "Suono notifiche" (chime), "Notifiche browser" (permission button).
- Persist in `localStorage` (`supplier.notifications.chime`, `supplier.notifications.browserPush`) — survive reloads. Read by provider on mount.

### U13. Assets

- `public/sounds/notification.mp3` — short (<1s) royalty-free chime. Volume normalized to −6dB.

## Data flow walkthrough — "new order arrives"

1. Restaurant checkout calls `submitOrder` → splits saved → `emitOrderEvent('received')` for each split.
2. `emitSplitEvent` inserts into `order_split_events` (audit log).
3. `dispatchEvent('order_received', supplierId, { splitId, orderNumber })`:
   - For each admin/sales supplier member: insert `in_app_notifications` row + send email + send web-push.
4. Supabase publishes INSERT on `in_app_notifications` filtered by `recipient_profile_id`.
5. Supplier provider receives the event:
   - `badges.orders++` (optimistic, pulse).
   - Ring buffer prepends the row.
   - Toast shows `"Nuovo ordine #1024 da Ristorante Roma"` with link `/supplier/ordini/{splitId}`.
   - Chime plays (if enabled, tab visible).
   - If tab hidden → `Notification API` surfaces banner.
   - `onEvent('order_received', { splitId })` fires for subscribed components.
   - `router.refresh()` after 500ms debounce.
6. Kanban (if mounted) re-renders with the new split via RSC refetch. Row picks up `data-split-id`, applies `flash-highlight` class for 1.5s.
7. Dashboard KPIs (if mounted) recompute via RSC refetch.
8. Sidebar badge increments immediately, re-seeds from server on next refresh.

## Error handling

- Channel subscription error → silent retry every 5s with exponential backoff up to 60s. Provider exposes `connectionState` (`connecting | connected | error`) — topbar can show a small dot for disconnection.
- Notification permission denied → no retry; future events skip `Notification API` silently.
- Toast stack overflow → queue up to 10, drop oldest over that.
- Chime `play()` rejection (autoplay policy) → swallowed, no UI error.
- `in_app_notifications` insert failures on server are already swallowed by `dispatchEvent`.

## Testing

- Unit: debounce behavior, ring buffer cap, badge increment/decrement on UPDATE transitions.
- Manual E2E:
  1. Open supplier tab on `/supplier/dashboard`.
  2. From second browser, submit order as restaurant.
  3. Verify: toast, chime, badge increment, dashboard KPI bump — all within 2s.
  4. Repeat with supplier tab hidden → Notification API banner.
  5. Accept order from detail page → kanban in other tab shifts column + flashes.

## Trade-offs acknowledged

- **1 channel per supplier**: broadcast from server always filtered by `supplier_id`, but `in_app_notifications` filter is by `recipient_profile_id` so only this user gets noise. Good.
- **router.refresh() debounce**: in bursty moments (e.g. mass import), debounce collapses to one refetch. Acceptable.
- **Stock reactivity via side-door**: materialized view can't push; we recompute on `order_splits` update. Minor latency (≤1s) vs real realtime. Acceptable; alternative would be a real table which is out of scope here.
- **Chime asset**: adds 1 file to `/public/sounds/`. Tiny (<20KB).

## Open items for plan phase

- Exact debounce value (500ms vs 750ms).
- Whether to move sidebar badge prop API entirely to context (cleaner) vs keep SSR seed (safer for first paint).
- Whether Notification API permission auto-prompt on first hidden-tab event, or only from settings page (UX — default to settings, no surprise prompts).

## Next step

Invoke `superpowers:writing-plans` to produce an implementation plan broken into reviewable chunks.
