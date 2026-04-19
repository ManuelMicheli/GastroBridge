/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Bell, Mail, Smartphone, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { PushSubscriptionManager } from "@/components/supplier/notifications/push-subscription-manager";
import { RealtimeLivePrefs } from "@/components/supplier/notifications/live-prefs";
import { LargeTitle } from "@/components/ui/large-title";

export const metadata: Metadata = { title: "Notifiche — Impostazioni Fornitore" };

type ChannelKey = "in_app" | "email" | "push";

export default async function SupplierNotificationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Counters per current user: push subscriptions, email verified, preference overrides.
  let pushCount = 0;
  let memberRole: string | null = null;
  let overrides: Array<{ channel: string; enabled: boolean; event_type: string }> = [];
  const emailVerified = Boolean(user?.email_confirmed_at);

  if (user) {
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id);
    pushCount = count ?? 0;

    const { data: member } = await supabase
      .from("supplier_members")
      .select("id, role")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .not("accepted_at", "is", null)
      .limit(1)
      .maybeSingle<{ id: string; role: string }>();

    if (member) {
      memberRole = member.role;
      const { data: prefs } = await (supabase as any)
        .from("notification_preferences")
        .select("channel, enabled, event_type")
        .eq("supplier_member_id", member.id);
      overrides = (prefs as typeof overrides) ?? [];
    }
  }

  // Default-enabled channels per role (mirror of lib/notifications matrix).
  // Keep conservative: in_app on for everyone; email and push default on for
  // decision-making roles; disabled channels shown con badge "Spento".
  const defaults: Record<string, Record<ChannelKey, boolean>> = {
    admin: { in_app: true, email: true, push: true },
    sales: { in_app: true, email: true, push: true },
    warehouse: { in_app: true, email: false, push: true },
    driver: { in_app: true, email: false, push: true },
    accounting: { in_app: true, email: true, push: false },
  };
  const baseChannels: Record<ChannelKey, boolean> = memberRole
    ? defaults[memberRole] ?? { in_app: true, email: false, push: false }
    : { in_app: true, email: false, push: false };

  // Se esiste almeno un override positivo per un canale, considera il canale
  // come "parzialmente abilitato" anche se il default e' off.
  const hasOverrideEnabled = (c: ChannelKey) =>
    overrides.some((o) => o.channel === c && o.enabled);
  const hasOverrideDisabled = (c: ChannelKey) =>
    overrides.some((o) => o.channel === c && !o.enabled);

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
      enabled: baseChannels.in_app || hasOverrideEnabled("in_app"),
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      detail: emailVerified
        ? `Invio a ${user?.email ?? "indirizzo registrato"}`
        : "Email non verificata",
      enabled:
        (baseChannels.email || hasOverrideEnabled("email")) &&
        !hasOverrideDisabled("email"),
    },
    {
      key: "push",
      label: "Push browser",
      icon: Smartphone,
      detail:
        pushCount > 0
          ? `${pushCount} dispositivo${pushCount === 1 ? "" : "i"} registrato${pushCount === 1 ? "" : "i"}`
          : "Nessun dispositivo registrato",
      enabled:
        pushCount > 0 &&
        (baseChannels.push || hasOverrideEnabled("push")) &&
        !hasOverrideDisabled("push"),
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Mobile hero */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow="Impostazioni"
          title="Notifiche"
          subtitle="Canali per ordini e aggiornamenti"
        />
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block space-y-6">
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
      </div>

      <Card>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-forest" />
            <h2 className="font-bold text-charcoal">Canali attivi</h2>
          </div>
          <p className="text-sm text-sage">
            Riepilogo dei canali su cui ricevi notifiche in base al tuo ruolo
            {memberRole ? ` (${memberRole})` : ""} e alle preferenze personali.
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
