import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedProfile } from "@/lib/supabase/cached-user";
import { SidebarProvider } from "@/components/dashboard/sidebar/sidebar-provider";
import { DashboardShell } from "@/components/dashboard/shell";
import type { NavItem } from "@/components/dashboard/sidebar/sidebar-item";
import type { MobileNavItem } from "@/components/dashboard/mobile/dark-mobile-nav";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { getStockAlertCounts } from "@/lib/supplier/stock/queries";
import { getPendingOrdersCount } from "@/lib/supplier/orders/queries";
import { getTotalUnreadMessagesForCurrentUser } from "@/lib/messages/queries";
import { getSectionSeenAt } from "@/lib/nav/section-seen";
import { getRecentInAppNotifications } from "@/lib/notifications/queries";
import { SupplierRealtimeProvider } from "@/lib/realtime/supplier-provider";
import type { SupplierRole } from "@/types/database";

type GatedNavItem = NavItem & {
  roles?: SupplierRole[];
  requiresPhase1?: boolean;
};

const BASE_NAV: GatedNavItem[] = [
  { href: "/supplier/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/supplier/catalogo", label: "Catalogo", iconName: "Package" },
  { href: "/supplier/ordini", label: "Ordini", iconName: "ClipboardList" },
  { href: "/supplier/clienti", label: "Clienti", iconName: "Users" },
  { href: "/supplier/messaggi", label: "Messaggi", iconName: "MessageCircle" },
  { href: "/supplier/analytics", label: "Analytics", iconName: "BarChart3", section: "Insights" },
  { href: "/supplier/recensioni", label: "Recensioni", iconName: "Star", section: "Insights" },
  {
    href: "/supplier/magazzino",
    label: "Magazzino",
    iconName: "Warehouse",
    section: "Gestione",
    requiresPhase1: true,
  },
  {
    href: "/supplier/listini",
    label: "Listini",
    iconName: "Tag",
    section: "Gestione",
    roles: ["admin", "sales"],
    requiresPhase1: true,
  },
  {
    href: "/supplier/staff",
    label: "Staff",
    iconName: "UserCog",
    section: "Gestione",
    roles: ["admin"],
    requiresPhase1: true,
  },
  {
    href: "/supplier/impostazioni/sedi",
    label: "Sedi",
    iconName: "MapPin",
    section: "Gestione",
    roles: ["admin"],
    requiresPhase1: true,
  },
  {
    href: "/supplier/consegne",
    label: "Consegne",
    iconName: "Truck",
    section: "Gestione",
    roles: ["admin", "warehouse", "driver"],
    requiresPhase1: true,
  },
  {
    href: "/supplier/ddt",
    label: "DDT",
    iconName: "FileText",
    section: "Gestione",
    roles: ["admin", "warehouse", "sales"],
    requiresPhase1: true,
  },
  { href: "/supplier/impostazioni", label: "Impostazioni", iconName: "Settings", section: "Gestione" },
];

const MOBILE_NAV: MobileNavItem[] = [
  { href: "/supplier/dashboard", label: "Home", iconName: "LayoutDashboard" },
  { href: "/supplier/catalogo", label: "Catalogo", iconName: "Package" },
  { href: "/supplier/ordini", label: "Ordini", iconName: "ClipboardList" },
  { href: "/supplier/clienti", label: "Clienti", iconName: "Users" },
  { href: "/supplier/impostazioni", label: "Altro", iconName: "Settings" },
];

function buildNavItems(
  currentRole: SupplierRole | null,
  phase1Enabled: boolean,
  stockBadge = 0,
  ordersBadge = 0,
  messagesBadge = 0,
): NavItem[] {
  return BASE_NAV.filter((item) => {
    if (item.requiresPhase1 && !phase1Enabled) return false;
    if (item.roles && (!currentRole || !item.roles.includes(currentRole))) {
      return false;
    }
    return true;
  }).map(({ roles: _roles, requiresPhase1: _rp1, ...nav }) => {
    if (nav.href === "/supplier/magazzino" && stockBadge > 0) {
      return { ...nav, badge: stockBadge };
    }
    if (nav.href === "/supplier/ordini" && ordersBadge > 0) {
      return { ...nav, badge: ordersBadge };
    }
    if (nav.href === "/supplier/messaggi" && messagesBadge > 0) {
      return { ...nav, badge: messagesBadge };
    }
    return nav;
  });
}

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const user = await getCachedUser();

  // Anonymous: render empty shell.
  if (!user) {
    const navItems = buildNavItems(null, false);
    return (
      <SidebarProvider>
        <DashboardShell
          navItems={navItems}
          mobileNavItems={MOBILE_NAV}
          role="supplier"
          companyName="Fornitore"
          userEmail=""
        >
          {children}
        </DashboardShell>
      </SidebarProvider>
    );
  }

  const supabase = await createClient();

  // Tier 1 — independent queries (parallel)
  const messagesBadgePromise = getSectionSeenAt("supplier_messages")
    .then((seen) => getTotalUnreadMessagesForCurrentUser(seen))
    .catch(() => 0);

  const memberPromise = supabase
    .from("supplier_members")
    .select("role, supplier_id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle<{ role: SupplierRole; supplier_id: string }>();

  const notificationsPromise = getRecentInAppNotifications(20).catch(() => []);

  const [profile, messagesBadge, memberRes, initialNotifications] =
    await Promise.all([
      getCachedProfile(user.id),
      messagesBadgePromise,
      memberPromise,
      notificationsPromise,
    ]);

  const member = memberRes.data ?? null;
  const currentRole: SupplierRole | null = member?.role ?? null;
  const supplierId: string | null = member?.supplier_id ?? null;

  // Tier 2 — depends on supplier_id
  let phase1Enabled = false;
  let stockBadge = 0;
  let ordersBadge = 0;

  if (supplierId) {
    const [supplierRes, pendingOrders] = await Promise.all([
      supabase
        .from("suppliers")
        .select("feature_flags")
        .eq("id", supplierId)
        .maybeSingle<{ feature_flags: Record<string, unknown> }>(),
      getSectionSeenAt("supplier_orders")
        .then((seen) => getPendingOrdersCount(supplierId, seen))
        .catch(() => 0),
    ]);
    phase1Enabled = isPhase1Enabled(supplierRes.data);
    ordersBadge = pendingOrders;

    // Tier 3 — stock counts only when phase1 is enabled
    if (phase1Enabled) {
      try {
        const { lowStockCount, expiringCount } = await getStockAlertCounts(
          supplierId,
          7,
        );
        stockBadge = lowStockCount + expiringCount;
      } catch {
        stockBadge = 0;
      }
    }
  }

  const navItems = buildNavItems(
    currentRole,
    phase1Enabled,
    stockBadge,
    ordersBadge,
    messagesBadge,
  );

  const shell = (
    <SidebarProvider>
      <DashboardShell
        navItems={navItems}
        mobileNavItems={MOBILE_NAV}
        role="supplier"
        companyName={profile?.company_name || "Fornitore"}
        userEmail={user.email || ""}
      >
        {children}
      </DashboardShell>
    </SidebarProvider>
  );

  if (!supplierId) return shell;

  return (
    <SupplierRealtimeProvider
      supplierId={supplierId}
      profileId={user.id}
      initialBadges={{
        orders: ordersBadge,
        stock: stockBadge,
        messages: messagesBadge,
      }}
      initialNotifications={initialNotifications}
    >
      {shell}
    </SupplierRealtimeProvider>
  );
}
