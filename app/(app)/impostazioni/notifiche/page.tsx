/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Bell, Mail, Smartphone, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { PushSubscriptionManager } from "@/components/supplier/notifications/push-subscription-manager";
import { RealtimeLivePrefs } from "@/components/supplier/notifications/live-prefs";

export const metadata: Metadata = { title: "Notifiche - Impostazioni" };

type ChannelKey = "in_app" | "email" | "push";

/**
 * Restaurant-side notification settings. Mirrors the supplier page structurally
 * but without the member-level `notification_preferences` overrides (those are
 * keyed by supplier_member_id and don't apply here). Restaurants get:
 *   - in-app notifications (always on — toast + bell)
 *   - email (on when user email is verified)
 *   - browser push (opt-in via the subscription manager)
 * plus the live prefs card (chime + browser Notification API toggle).
 */
export default async function RestaurantNotificationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pushCount = 0;
  const emailVerified = Boolean(user?.email_confirmed_at);

  if (user) {
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id);
    pushCount = count ?? 0;
  }

  const channels: Array<{
    key: ChannelKey;
    label: string;
    icon: typeof Bell;
    detail: string;
    enabled: boolean;
  }> = [
    {
      key: "in_app",
      label: "Dashboard (in-app)",
      icon: Inbox,
      detail: "Sempre attiva nel centro notifiche",
      enabled: true,
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      detail: emailVerified
        ? `Invio a ${user?.email ?? "indirizzo registrato"}`
        : "Email non verificata",
      enabled: emailVerified,
    },
    {
      key: "push",
      label: "Push browser",
      icon: Smartphone,
      detail:
        pushCount > 0
          ? `${pushCount} dispositivo${pushCount === 1 ? "" : "i"} registrato${pushCount === 1 ? "" : "i"}`
          : "Nessun dispositivo registrato",
      enabled: pushCount > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/impostazioni"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-forest"
      >
        <ChevronLeft className="h-4 w-4" />
        Torna a Impostazioni
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-charcoal">Notifiche</h1>
        <p className="text-sm text-sage mt-1">
          Gestisci i canali di notifica per i tuoi ordini e aggiornamenti dai fornitori.
        </p>
      </div>

      <Card>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-forest" />
            <h2 className="font-bold text-charcoal">Canali attivi</h2>
          </div>
          <p className="text-sm text-sage">
            Riepilogo dei canali su cui ricevi notifiche quando un fornitore
            accetta, spedisce o consegna un tuo ordine.
          </p>
        </div>
        <ul className="mt-4 space-y-2">
          {channels.map((c) => {
            const Icon = c.icon;
            return (
              <li
                key={c.key}
                className="flex items-center justify-between rounded-lg border border-charcoal/10 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-sage" />
                  <div>
                    <div className="text-sm font-medium text-charcoal">{c.label}</div>
                    <div className="text-xs text-sage">{c.detail}</div>
                  </div>
                </div>
                <Badge variant={c.enabled ? "success" : "outline"}>
                  {c.enabled ? "Attivo" : "Spento"}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      <RealtimeLivePrefs />

      <Card>
        <div className="space-y-2">
          <h2 className="font-bold text-charcoal">Notifiche push del browser</h2>
          <p className="text-sm text-sage">
            Ricevi un avviso in tempo reale quando un fornitore aggiorna lo stato
            di un ordine, anche con la scheda chiusa.
          </p>
        </div>
        <div className="mt-4">
          <PushSubscriptionManager />
        </div>
      </Card>
    </div>
  );
}
