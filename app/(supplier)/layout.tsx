import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider } from "@/components/dashboard/sidebar/sidebar-provider";
import { DashboardShell } from "@/components/dashboard/shell";
import type { NavItem } from "@/components/dashboard/sidebar/sidebar-item";
import type { MobileNavItem } from "@/components/dashboard/mobile/dark-mobile-nav";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
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
  { href: "/supplier/analytics", label: "Analytics", iconName: "BarChart3", section: "Insights" },
  { href: "/supplier/recensioni", label: "Recensioni", iconName: "Star", section: "Insights" },
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
): NavItem[] {
  return BASE_NAV.filter((item) => {
    if (item.requiresPhase1 && !phase1Enabled) return false;
    if (item.roles && (!currentRole || !item.roles.includes(currentRole))) {
      return false;
    }
    return true;
  }).map(({ roles: _roles, requiresPhase1: _rp1, ...nav }) => nav);
}

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", user?.id ?? "")
    .single<{ company_name: string }>();

  // Carica il primo supplier_member attivo del profilo. Il supplier-switcher
  // multi-tenant è rinviato a Fase 1B — per ora scegliamo il primo disponibile.
  let currentRole: SupplierRole | null = null;
  let phase1Enabled = false;

  if (user) {
    const { data: member } = await supabase
      .from("supplier_members")
      .select("role, supplier_id")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .not("accepted_at", "is", null)
      .limit(1)
      .maybeSingle<{ role: SupplierRole; supplier_id: string }>();

    if (member) {
      currentRole = member.role;
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("feature_flags")
        .eq("id", member.supplier_id)
        .maybeSingle<{ feature_flags: Record<string, unknown> }>();
      phase1Enabled = isPhase1Enabled(supplier);
    }
  }

  const navItems = buildNavItems(currentRole, phase1Enabled);

  return (
    <SidebarProvider>
      <DashboardShell
        navItems={navItems}
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
