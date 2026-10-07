import type { ReactNode } from "react";
import { SettingsFrame, type SettingsNavItem } from "@/components/fernly/settings-frame";

const ITEMS: SettingsNavItem[] = [
  { href: "/impostazioni", label: "Profilo", icon: "profilo", exact: true },
  { href: "/impostazioni/notifiche", label: "Notifiche", icon: "notifiche" },
  { href: "/impostazioni/aspetto", label: "Aspetto", icon: "aspetto" },
  { href: "/impostazioni/sedi", label: "Sedi", icon: "sedi" },
  { href: "/impostazioni/esigenze-fornitura", label: "Esigenze fornitura", icon: "esigenze" },
  { href: "/impostazioni/budget", label: "Budget", icon: "budget" },
  { href: "/impostazioni/sicurezza", label: "Sicurezza", icon: "sicurezza" },
  { href: "/impostazioni/abbonamento", label: "Abbonamento", icon: "abbonamento" },
  { href: "/impostazioni/team", label: "Team", icon: "team" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsFrame items={ITEMS} rootHref="/impostazioni" appearanceHref="/impostazioni/aspetto">
      {children}
    </SettingsFrame>
  );
}
