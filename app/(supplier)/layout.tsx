import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider } from "@/components/dashboard/sidebar/sidebar-provider";
import { DashboardShell } from "@/components/dashboard/shell";
import type { NavItem } from "@/components/dashboard/sidebar/sidebar-item";
import type { MobileNavItem } from "@/components/dashboard/mobile/dark-mobile-nav";

const NAV_ITEMS: NavItem[] = [
  { href: "/supplier/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/supplier/catalogo", label: "Catalogo", iconName: "Package" },
  { href: "/supplier/ordini", label: "Ordini", iconName: "ClipboardList" },
  { href: "/supplier/clienti", label: "Clienti", iconName: "Users" },
  { href: "/supplier/analytics", label: "Analytics", iconName: "BarChart3", section: "Insights" },
  { href: "/supplier/recensioni", label: "Recensioni", iconName: "Star", section: "Insights" },
  { href: "/supplier/impostazioni", label: "Impostazioni", iconName: "Settings", section: "Gestione" },
];

const MOBILE_NAV: MobileNavItem[] = [
  { href: "/supplier/dashboard", label: "Home", iconName: "LayoutDashboard" },
  { href: "/supplier/catalogo", label: "Catalogo", iconName: "Package" },
  { href: "/supplier/ordini", label: "Ordini", iconName: "ClipboardList" },
  { href: "/supplier/clienti", label: "Clienti", iconName: "Users" },
  { href: "/supplier/impostazioni", label: "Altro", iconName: "Settings" },
];

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", user?.id ?? "")
    .single<{ company_name: string }>();

  return (
    <SidebarProvider>
      <DashboardShell
        navItems={NAV_ITEMS}
        mobileNavItems={MOBILE_NAV}
        role="supplier"
        companyName={profile?.company_name || "Fornitore"}
        userEmail={user?.email || ""}
      >
        {children}
      </DashboardShell>
    </SidebarProvider>
  );
}
