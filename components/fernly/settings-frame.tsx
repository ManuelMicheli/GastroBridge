"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  MapPin,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  Wallet,
  Map as MapIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/formatters";

export type SettingsNavIcon =
  | "profilo"
  | "notifiche"
  | "aspetto"
  | "sedi"
  | "esigenze"
  | "budget"
  | "sicurezza"
  | "abbonamento"
  | "team"
  | "zone"
  | "azienda";

const ICONS: Record<SettingsNavIcon, LucideIcon> = {
  profilo: User,
  notifiche: Bell,
  aspetto: Palette,
  sedi: MapPin,
  esigenze: SlidersHorizontal,
  budget: Wallet,
  sicurezza: ShieldCheck,
  abbonamento: CreditCard,
  team: Users,
  zone: MapIcon,
  azienda: Building2,
};

export type SettingsNavItem = {
  href: string;
  label: string;
  icon: SettingsNavIcon;
  /** Exact match only (used for the settings index). */
  exact?: boolean;
};

/**
 * Settings frame (Fernly): left sub-nav with a sliding tinted active pill,
 * content on the right. Mobile keeps each page's own navigation; only the
 * new "Aspetto" entry is surfaced as a row on the settings index.
 */
export function SettingsFrame({
  items,
  rootHref,
  appearanceHref,
  children,
}: {
  items: SettingsNavItem[];
  rootHref: string;
  appearanceHref: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || rootHref;
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ y: number; h: number } | null>(null);

  const activeHref =
    items
      .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/")))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const el = nav.querySelector<HTMLElement>('[data-active="true"]');
    setPill(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, [activeHref]);

  return (
    <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start lg:gap-5">
      <aside className="hidden lg:block lg:sticky lg:top-[96px]">
        <p className="f-eyebrow mb-2 px-1">Impostazioni</p>
        <nav ref={navRef} aria-label="Sezioni impostazioni" className="f-card relative p-2">
          <span
            aria-hidden
            className="pointer-events-none absolute left-2 right-2 rounded-[12px] bg-[var(--acc-50)] transition-[transform,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ transform: `translateY(${pill?.y ?? 0}px)`, height: pill?.h ?? 0, opacity: pill ? 1 : 0, top: 0 }}
          />
          <ul className="relative flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2.5 rounded-[12px] px-3 text-[14px] transition-colors",
                      active ? "font-semibold text-[var(--acc-700)]" : "font-medium text-[var(--f-ink-2)] hover:text-[var(--f-ink)]",
                    )}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2 : 1.75} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0">
        {pathname === rootHref ? (
          <Link
            href={appearanceHref}
            className="f-card mx-3 mt-3 flex items-center gap-3 px-4 py-3 lg:hidden"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--acc-50)] text-[var(--acc-700)]">
              <Palette className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[var(--f-ink)]">Aspetto</span>
              <span className="block text-[12px] text-[var(--f-muted)]">Colore d&apos;accento e inizio settimana</span>
            </span>
            <ChevronRight className="h-4 w-4 text-[var(--f-faint)]" />
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}
