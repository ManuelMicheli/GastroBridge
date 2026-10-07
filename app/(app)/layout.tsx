import type { ReactNode } from "react";
import { CartProvider } from "@/lib/hooks/useCart";
import { getCachedUser, getCachedProfile } from "@/lib/supabase/cached-user";
import { SidebarProvider } from "@/components/dashboard/sidebar/sidebar-provider";
import { DashboardShell } from "@/components/dashboard/shell";
import type { NavItem } from "@/components/dashboard/sidebar/sidebar-item";
import type { MobileNavItem } from "@/components/dashboard/mobile/dark-mobile-nav";
import { getTotalUnreadMessagesForCurrentUser } from "@/lib/messages/queries";
import { getSectionSeenAt } from "@/lib/nav/section-seen";
import { getRecentInAppNotifications } from "@/lib/notifications/queries";
import { RestaurantRealtimeProvider } from "@/lib/realtime/restaurant-provider";
import { accentBootScript } from "@/lib/appearance";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",    label: "Dashboard",       iconName: "LayoutDashboard" },
  { href: "/cerca",        label: "Cerca Prodotti",  iconName: "Search" },
  { href: "/fornitori",    label: "Fornitori",       iconName: "Store" },
  { href: "/cataloghi",    label: "Cataloghi",       iconName: "BookMarked" },
  { href: "/ordini",       label: "Ordini",          iconName: "ClipboardList" },
  { href: "/carrello",     label: "Carrello",        iconName: "ShoppingCart" },
  { href: "/messaggi",     label: "Messaggi",        iconName: "MessageCircle" },
  { href: "/analytics",    label: "Analytics",       iconName: "BarChart3",     section: "Generale" },
  { href: "/finanze",      label: "Finanze",         iconName: "Receipt",       section: "Generale" },
  { href: "/finanze/ordini-consigliati", label: "Ordini consigliati", iconName: "Bell", section: "Generale" },
  { href: "/impostazioni", label: "Impostazioni",    iconName: "Settings",      section: "Generale" },
];

const MOBILE_NAV: MobileNavItem[] = [
  { href: "/dashboard",    label: "Home",     iconName: "LayoutDashboard" },
  { href: "/cerca",        label: "Cerca",    iconName: "Search" },
  { href: "/carrello",     label: "Carrello", iconName: "ShoppingCart" },
  { href: "/ordini",       label: "Ordini",   iconName: "ClipboardList" },
  { href: "/impostazioni", label: "Account",  iconName: "Settings" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCachedUser();
  const userId = user?.id ?? "";

  const messagesBadgePromise = getSectionSeenAt("restaurant_messages")
    .then((seen) => getTotalUnreadMessagesForCurrentUser(seen))
    .catch(() => 0);

  const [profile, initialNotifications, messagesBadge, ctx] = await Promise.all([
    userId ? getCachedProfile(userId) : Promise.resolve(null),
    user ? getRecentInAppNotifications(20).catch(() => []) : Promise.resolve([]),
    messagesBadgePromise,
    user ? getRestaurantContext() : Promise.resolve(null),
  ]);

  // Team members (restaurant_members) work on someone else's restaurant:
  // show its name and hide sections their role cannot use. Finanze (fiscal
  // drawer) stays owner-only.
  const isMember = !!ctx && !ctx.isOwner;
  const hidden = new Set<string>();
  if (ctx && !contextCan(ctx, "analytics.financial")) hidden.add("/analytics");
  if (isMember) {
    hidden.add("/finanze");
    hidden.add("/finanze/ordini-consigliati");
  }
  const companyName = (isMember ? ctx.restaurantName : profile?.company_name) || "Ristorante";

  const navItems: NavItem[] = NAV_ITEMS.filter((item) => !hidden.has(item.href)).map((item) =>
    item.href === "/messaggi" && messagesBadge > 0
      ? { ...item, badge: messagesBadge }
      : item,
  );

  const shell = (
    <CartProvider userId={userId}>
      {/* Applies the saved workspace accent before first paint (no flash). */}
      <script dangerouslySetInnerHTML={{ __html: accentBootScript("restaurant") }} />

      <SidebarProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-[color:var(--color-brand-primary)] focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)] focus:ring-offset-2"
        >
          Vai al contenuto
        </a>
        <DashboardShell
          navItems={navItems}
          mobileNavItems={MOBILE_NAV}
          role="restaurant"
          companyName={companyName}
          userEmail={user?.email || ""}
        >
          <div id="main-content" tabIndex={-1} className="outline-none">
            {children}
          </div>
        </DashboardShell>
      </SidebarProvider>
    </CartProvider>
  );

  if (!user) return shell;

  return (
    <RestaurantRealtimeProvider
      profileId={user.id}
      initialNotifications={initialNotifications}
    >
      {shell}
    </RestaurantRealtimeProvider>
  );
}
