import type { ReactNode } from "react";
import { SettingsFrame, type SettingsNavItem } from "@/components/fernly/settings-frame";

const ITEMS: SettingsNavItem[] = [
  { href: "/supplier/impostazioni", label: "Panoramica", icon: "azienda", exact: true },
  { href: "/supplier/impostazioni/profilo", label: "Profilo", icon: "profilo" },
  { href: "/supplier/impostazioni/notifiche", label: "Notifiche", icon: "notifiche" },
  { href: "/supplier/impostazioni/aspetto", label: "Aspetto", icon: "aspetto" },
  { href: "/supplier/impostazioni/sedi", label: "Sedi", icon: "sedi" },
  { href: "/supplier/impostazioni/zone", label: "Zone consegna", icon: "zone" },
  { href: "/supplier/impostazioni/abbonamento", label: "Abbonamento", icon: "abbonamento" },
];

export default function SupplierSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsFrame
      items={ITEMS}
      rootHref="/supplier/impostazioni"
      appearanceHref="/supplier/impostazioni/aspetto"
    >
      {children}
    </SettingsFrame>
  );
}
