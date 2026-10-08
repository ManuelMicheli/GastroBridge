"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/formatters";

const TABS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: "/finanze", label: "Panoramica", match: (p) => p === "/finanze" },
  { href: "/finanze/fatture", label: "Fatture fornitori", match: (p) => p.startsWith("/finanze/fatture") },
  { href: "/finanze/ricette", label: "Food cost", match: (p) => p.startsWith("/finanze/ricette") },
  { href: "/finanze/scontrini", label: "Scontrini", match: (p) => p.startsWith("/finanze/scontrini") },
  {
    href: "/finanze/collegamenti",
    label: "Collegamenti",
    match: (p) =>
      p.startsWith("/finanze/collegamenti") || p.startsWith("/finanze/integrazioni") || p.startsWith("/finanze/guida"),
  },
];

/** Section tabs shared by every Finanze page. */
export function FinanzeNav() {
  const pathname = usePathname() ?? "/finanze";
  if (pathname.startsWith("/finanze/ordini-consigliati")) return null;
  return (
    <nav aria-label="Sezioni Finanze" className="mb-4 px-1 pt-3 lg:px-0 lg:pt-0">
      <div className="f-chips">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              data-active={active}
              aria-current={active ? "page" : undefined}
              className={cn(
                "f-chip",
                active &&
                  "bg-[linear-gradient(180deg,color-mix(in_oklab,var(--acc-700)_65%,var(--acc-800)),var(--acc-800))] shadow-[0_4px_10px_color-mix(in_oklab,var(--acc-800)_22%,transparent)]",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
