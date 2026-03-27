"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  cerca: "Cerca Prodotti",
  fornitori: "Fornitori",
  ordini: "Ordini",
  carrello: "Carrello",
  analytics: "Analytics",
  impostazioni: "Impostazioni",
  sedi: "Sedi",
  team: "Team",
  abbonamento: "Abbonamento",
  supplier: "Fornitore",
  catalogo: "Catalogo",
  nuovo: "Nuovo Prodotto",
  import: "Importa CSV",
  clienti: "Clienti",
  recensioni: "Recensioni",
  zone: "Zone Consegna",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on the dashboard home
  if (segments.length <= 1 || (segments.length === 2 && segments[0] === "supplier" && segments[1] === "dashboard")) {
    return null;
  }

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = LABEL_MAP[segment] || segment;
    const isLast = i === segments.length - 1;
    // Skip UUID segments — show a shortened version
    const isUuid = /^[0-9a-f]{8}-/.test(segment);

    return { href, label: isUuid ? `#${segment.slice(0, 8)}` : label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />}
          {crumb.isLast ? (
            <span className="text-text-primary font-medium">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
