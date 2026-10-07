"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

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
  nuovo: "Nuovo",
  import: "Importa CSV",
  clienti: "Clienti",
  recensioni: "Recensioni",
  zone: "Zone Consegna",
  cataloghi: "Cataloghi",
  confronta: "Confronta",
  messaggi: "Messaggi",
  finanze: "Finanze",
  scontrini: "Scontrini",
  integrazioni: "Integrazioni",
  csv: "CSV",
  "ordini-consigliati": "Ordini consigliati",
  "esigenze-fornitura": "Esigenze di fornitura",
  budget: "Budget",
  notifiche: "Notifiche",
  sicurezza: "Sicurezza",
  guida: "Guida",
  ordine: "Ordine",
  conferma: "Conferma",
  magazzino: "Magazzino",
  carichi: "Carichi",
  lotti: "Lotti",
  movimenti: "Movimenti",
  inventario: "Inventario",
  ddt: "DDT",
  templates: "Template",
  consegne: "Consegne",
  calendario: "Calendario",
  listini: "Listini",
  listino: "Listino",
  aggiungi: "Aggiungi",
  staff: "Staff",
  profilo: "Profilo",
  preparazione: "Preparazione",
  kanban: "Kanban",
  invito: "Invito",
  accetta: "Accetta",
};

// Same segment, different meaning depending on its parent ("parent/segment").
const CONTEXT_LABEL_MAP: Record<string, string> = {
  "catalogo/nuovo": "Nuovo Prodotto",
  "listini/nuovo": "Nuovo listino",
  "carichi/nuovo": "Nuovo carico",
  "staff/nuovo": "Nuovo membro",
  "templates/nuovo": "Nuovo template",
  "fornitori/cerca": "Cerca fornitori",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isSupplier = pathname.startsWith("/supplier/") || pathname === "/supplier";

  // Don't show breadcrumbs on the dashboard home
  if (segments.length <= 1 || (segments.length === 2 && segments[0] === "supplier" && segments[1] === "dashboard")) {
    return null;
  }

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const parent = i > 0 ? segments[i - 1] : undefined;
    const label =
      (parent && CONTEXT_LABEL_MAP[`${parent}/${segment}`]) ||
      LABEL_MAP[segment] ||
      segment;
    const isLast = i === segments.length - 1;
    // Skip UUID segments — show a shortened version
    const isUuid = /^[0-9a-f]{8}-/.test(segment);

    return { href, label: isUuid ? `#${segment.slice(0, 8)}` : label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && (
            isSupplier ? (
              <span className="text-brand-primary text-xs" aria-hidden="true">/</span>
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
            )
          )}
          {crumb.isLast ? (
            <span
              className={cn(
                isSupplier
                  ? "font-display text-sm text-text-primary"
                  : "text-text-primary font-medium",
              )}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className={cn(
                isSupplier
                  ? "font-mono text-[11px] text-text-tertiary hover:text-brand-primary hover:underline underline-offset-4 transition-colors"
                  : "text-text-tertiary hover:text-text-secondary transition-colors",
              )}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
