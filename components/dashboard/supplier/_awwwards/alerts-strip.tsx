// components/dashboard/supplier/_awwwards/alerts-strip.tsx
//
// Terminal-styled alert strip for the supplier dashboard. Mirrors the
// SavingsAlert pattern (border-l accent + diamond glyph + mono eyebrow +
// body text + CTA) but lists up to three actionable operational alerts.

import Link from "next/link";
import { AlertTriangle, Clock, PackageX } from "lucide-react";
import type { ComponentType } from "react";

type Alerts = {
  pendingOverdueCount: number;
  expiringLotsCount: number;
  failedDeliveriesCount: number;
};

type AlertItem = {
  key: string;
  tone: "amber" | "red";
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  body: string;
  cta: string;
  href: string;
};

function buildAlerts(alerts?: Alerts): AlertItem[] {
  if (!alerts) return [];
  const list: AlertItem[] = [];
  if (alerts.pendingOverdueCount > 0) {
    const n = alerts.pendingOverdueCount;
    list.push({
      key: "pending",
      tone: "amber",
      icon: Clock,
      eyebrow: "Alert · Ordini in attesa",
      body: `${n} ordin${n === 1 ? "e" : "i"} in attesa da oltre 24h — conferma o rifiuta.`,
      cta: "vai agli ordini →",
      href: "/supplier/ordini?state=submitted",
    });
  }
  if (alerts.expiringLotsCount > 0) {
    const n = alerts.expiringLotsCount;
    list.push({
      key: "expiring",
      tone: "amber",
      icon: AlertTriangle,
      eyebrow: "Alert · Lotti in scadenza",
      body: `${n} lott${n === 1 ? "o" : "i"} in scadenza entro 7 giorni — pianifica vendita o trasferimento.`,
      cta: "gestisci lotti →",
      href: "/supplier/magazzino/lotti?expiring=7",
    });
  }
  if (alerts.failedDeliveriesCount > 0) {
    const n = alerts.failedDeliveriesCount;
    list.push({
      key: "failed",
      tone: "red",
      icon: PackageX,
      eyebrow: "Alert · Consegne fallite",
      body: `${n} consegn${n === 1 ? "a fallita" : "e fallite"} questa settimana — rivedi motivazioni.`,
      cta: "rivedi consegne →",
      href: "/supplier/consegne?failed=1",
    });
  }
  return list.slice(0, 3);
}

export function SupplierAlertsStrip({ alerts }: { alerts?: Alerts }) {
  const items = buildAlerts(alerts);

  if (items.length === 0) {
    return (
      <p className="px-4 py-2 font-mono text-[11px] text-text-tertiary">
        Nessun alert operativo · tutto sotto controllo.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((a) => {
        const toneBorder =
          a.tone === "red" ? "border-accent-red" : "border-accent-amber";
        const toneText =
          a.tone === "red" ? "text-accent-red" : "text-accent-amber";
        const toneBg = a.tone === "red" ? "bg-accent-red/5" : "bg-accent-amber/5";
        const Icon = a.icon;
        return (
          <li key={a.key}>
            <Link
              href={a.href}
              className={`flex flex-wrap items-center gap-3 rounded-r-lg border-l-[3px] ${toneBorder} ${toneBg} px-4 py-3 transition-colors hover:bg-surface-hover`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${toneText}`} aria-hidden />
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.08em] ${toneText}`}
              >
                {a.eyebrow}
              </span>
              <span className="flex-1 min-w-[200px] text-[13px] text-text-secondary">
                {a.body}
              </span>
              <span
                className={`font-mono text-[11px] uppercase tracking-[0.08em] ${toneText} hover:text-text-primary transition-colors`}
              >
                {a.cta}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
