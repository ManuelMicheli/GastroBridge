"use client";

import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  MobileTopbar,
  TopbarIconButton,
  TopbarHamburger,
  TopbarBack,
} from "@/components/ui/mobile-topbar";
import { NotificationBell } from "@/components/dashboard/topbar/notification-bell";

const BACK_MAP: Array<[RegExp, string, string]> = [
  [/^\/supplier\/ordini\/[^/]+/, "/supplier/ordini", "Ordini"],
  [/^\/supplier\/catalogo\/[^/]+/, "/supplier/catalogo", "Catalogo"],
  [/^\/supplier\/clienti\/[^/]+/, "/supplier/clienti", "Clienti"],
  [/^\/supplier\/impostazioni\/[^/]+/, "/supplier/impostazioni", "Impostazioni"],
  [/^\/supplier\/magazzino\/[^/]+/, "/supplier/magazzino", "Magazzino"],
  [/^\/supplier\/consegne\/[^/]+/, "/supplier/ordini", "Ordini"],
  [/^\/supplier\/listini\/[^/]+/, "/supplier/listini", "Listini"],
  [/^\/supplier\/staff\/[^/]+/, "/supplier/staff", "Staff"],
  [/^\/supplier\/ddt\/[^/]+/, "/supplier/ddt", "DDT"],
];

const TITLE_MAP: Record<string, string> = {
  "/supplier/dashboard": "Dashboard",
  "/supplier/catalogo": "Catalogo",
  "/supplier/ordini": "Ordini",
  "/supplier/ordini/kanban": "Kanban",
  "/supplier/clienti": "Clienti",
  "/supplier/impostazioni": "Impostazioni",
  "/supplier/messaggi": "Messaggi",
  "/supplier/magazzino": "Magazzino",
  "/supplier/analytics": "Analytics",
  "/supplier/listini": "Listini",
  "/supplier/staff": "Staff",
  "/supplier/ddt": "DDT",
  "/supplier/recensioni": "Recensioni",
  "/supplier/consegne": "Consegne",
  "/supplier/invito": "Invito",
};

function resolveTitle(pathname: string): {
  title?: string;
  back?: { href: string; label: string };
} {
  for (const [re, href, label] of BACK_MAP) {
    if (re.test(pathname)) return { back: { href, label } };
  }
  const exactHit = TITLE_MAP[pathname];
  if (exactHit) return { title: exactHit };
  const segs = pathname.split("/").filter(Boolean);
  const first = segs.length >= 2 ? `/${segs[0]}/${segs[1]}` : pathname;
  return { title: TITLE_MAP[first] };
}

type Props = {
  onMenuToggle: () => void;
};

export function MobileSupplierTopbar({ onMenuToggle }: Props) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { title, back } = resolveTitle(pathname);

  return (
    <MobileTopbar
      leading={
        back ? (
          <TopbarBack label={back.label} href={back.href} />
        ) : (
          <TopbarHamburger onClick={onMenuToggle} />
        )
      }
      title={back ? undefined : title}
      trailing={
        <>
          <TopbarIconButton
            onClick={() => router.push("/supplier/catalogo")}
            ariaLabel="Cerca"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </TopbarIconButton>
          <NotificationBell />
        </>
      }
    />
  );
}
