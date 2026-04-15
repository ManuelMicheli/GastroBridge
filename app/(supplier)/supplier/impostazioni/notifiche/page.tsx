import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PushSubscriptionManager } from "@/components/supplier/notifications/push-subscription-manager";

export const metadata: Metadata = { title: "Notifiche — Impostazioni Fornitore" };

export default function SupplierNotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/supplier/impostazioni"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-forest"
      >
        <ChevronLeft className="h-4 w-4" />
        Torna a Impostazioni
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-charcoal">Notifiche</h1>
        <p className="text-sm text-sage mt-1">
          Gestisci i canali di notifica per nuovi ordini e aggiornamenti.
        </p>
      </div>

      <Card>
        <div className="space-y-2">
          <h2 className="font-bold text-charcoal">Notifiche push del browser</h2>
          <p className="text-sm text-sage">
            Ricevi un avviso in tempo reale quando arriva un nuovo ordine o una
            modifica richiede la tua attenzione, anche con la scheda chiusa.
          </p>
        </div>
        <div className="mt-4">
          <PushSubscriptionManager />
        </div>
      </Card>
    </div>
  );
}
