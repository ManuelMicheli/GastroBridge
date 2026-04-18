import type { ReactNode } from "react";
import { CartProvider } from "@/lib/hooks/useCart";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider } from "@/components/dashboard/sidebar/sidebar-provider";
import { DashboardShell } from "@/components/dashboard/shell";
import type { NavItem } from "@/components/dashboard/sidebar/sidebar-item";
import type { MobileNavItem } from "@/components/dashboard/mobile/dark-mobile-nav";
import { getTotalUnreadMessagesForCurrentUser } from "@/lib/messages/queries";
import { getSectionSeenAt } from "@/lib/nav/section-seen";
import { getRecentInAppNotifications } from "@/lib/notifications/queries";
import { RestaurantRealtimeProvider } from "@/lib/realtime/restaurant-provider";

// Force dynamic rendering for all restaurant pages — data must always be
// fresh (dashboard KPIs, analytics, orders, cart totals, unread badges).
// Disables full-route cache + data cache for the entire /(app) segment.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",    label: "Dashboard",       iconName: "LayoutDashboard" },
  { href: "/cerca",        label: "Cerca Prodotti",  iconName: "Search" },
  { href: "/fornitori",    label: "Fornitori",       iconName: "Store" },
  { href: "/cataloghi",    label: "Cataloghi",       iconName: "BookMarked" },
  { href: "/ordini",       label: "Ordini",          iconName: "ClipboardList" },
  { href: "/carrello",     label: "Carrello",        iconName: "ShoppingCart" },
  { href: "/messaggi",     label: "Messaggi",        iconName: "MessageCircle" },
  { href: "/analytics",    label: "Analytics",       iconName: "BarChart3",     section: "Gestione" },
  { href: "/impostazioni", label: "Impostazioni",    iconName: "Settings",      section: "Gestione" },
];

const MOBILE_NAV: MobileNavItem[] = [
  { href: "/dashboard",    label: "Home",     iconName: "LayoutDashboard" },
  { href: "/cerca",        label: "Cerca",    iconName: "Search" },
  { href: "/carrello",     label: "Carrello", iconName: "ShoppingCart" },
  { href: "/ordini",       label: "Ordini",   iconName: "ClipboardList" },
  { href: "/impostazioni", label: "Account",  iconName: "Settings" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", user?.id ?? "")
    .single<{ company_name: string }>();

  let messagesBadge = 0;
  try {
    const seenAt = await getSectionSeenAt("restaurant_messages");
    messagesBadge = await getTotalUnreadMessagesForCurrentUser(seenAt);
  } catch {
    messagesBadge = 0;
  }

  const navItems: NavItem[] = NAV_ITEMS.map((item) =>
    item.href === "/messaggi" && messagesBadge > 0
      ? { ...item, badge: messagesBadge }
      : item,
  );

  const initialNotifications = user ? await getRecentInAppNotifications(20) : [];

  const shell = (
    <CartProvider>
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
          companyName={profile?.company_name || "Ristorante"}
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
