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

// Parent route for detail paths — clicking "< label" goes back here.
const BACK_MAP: Array<[RegExp, string, string]> = [
  [/^\/ordini\/[^/]+/, "/ordini", "Ordini"],
  [/^\/fornitori\/[^/]+/, "/fornitori", "Fornitori"],
  [/^\/cataloghi\/[^/]+/, "/cataloghi", "Cataloghi"],
  [/^\/impostazioni\/[^/]+/, "/impostazioni", "Account"],
  [/^\/cerca\/ordine/, "/cerca", "Cerca"],
  [/^\/carrello\/conferma/, "/carrello", "Carrello"],
];

// Top-level route title
const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/cerca": "Cerca",
  "/fornitori": "Fornitori",
  "/cataloghi": "Cataloghi",
  "/ordini": "Ordini",
  "/carrello": "Carrello",
  "/analytics": "Analytics",
  "/impostazioni": "Account",
  "/messaggi": "Messaggi",
};

function resolveTitle(pathname: string): {
  title?: string;
  back?: { href: string; label: string };
} {
  for (const [re, href, label] of BACK_MAP) {
    if (re.test(pathname)) return { back: { href, label } };
  }
  const base = "/" + (pathname.split("/")[1] ?? "");
  return { title: TITLE_MAP[base] ?? TITLE_MAP[pathname] };
}

type Props = {
  onMenuToggle: () => void;
};

export function MobileRestaurantTopbar({ onMenuToggle }: Props) {
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
            onClick={() => router.push("/cerca")}
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
