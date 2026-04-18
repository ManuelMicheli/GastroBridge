"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX, BellRing, BellOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotificationPrefs } from "@/lib/realtime/supplier-hooks";
import {
  getBrowserPushPref,
  setBrowserPushPref,
  getNotificationPermission,
} from "@/lib/realtime/browser-push";
import { playChime } from "@/components/supplier/realtime/chime";

/**
 * Live preferences for the realtime layer:
 *   - chime (plays on incoming events while tab is visible)
 *   - browser Notification API (shown when tab is hidden)
 *
 * State is persisted in localStorage via the helpers in lib/realtime.
 */
export function RealtimeLivePrefs() {
  const { chimeEnabled, setChimeEnabled, requestBrowserPushPermission } = useNotificationPrefs();
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setPushEnabled(getBrowserPushPref());
    setPermission(getNotificationPermission());
  }, []);

  const handleToggleChime = () => {
    const next = !chimeEnabled;
    setChimeEnabled(next);
    if (next) playChime();
  };

  const handleTogglePush = async () => {
    const next = !pushEnabled;
    setBrowserPushPref(next);
    setPushEnabled(next);
    if (next && permission === "default") {
      setRequesting(true);
      const p = await requestBrowserPushPermission();
      setPermission(p);
      setRequesting(false);
    }
  };

  const handleAskPermission = async () => {
    setRequesting(true);
    const p = await requestBrowserPushPermission();
    setPermission(p);
    setRequesting(false);
  };

  return (
    <Card>
      <div className="space-y-2">
        <h2 className="font-bold text-charcoal">Avvisi in tempo reale</h2>
        <p className="text-sm text-sage">
          Quando sei collegato alla piattaforma, ricevi un avviso immediato
          all&apos;arrivo di nuovi ordini o aggiornamenti.
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        <li className="flex items-center justify-between gap-3 rounded-lg border border-charcoal/10 px-3 py-3">
          <div className="flex items-center gap-3">
            {chimeEnabled ? (
              <Volume2 className="h-5 w-5 text-forest" />
            ) : (
              <VolumeX className="h-5 w-5 text-sage" />
            )}
            <div>
              <div className="text-sm font-medium text-charcoal">Suono notifiche</div>
              <div className="text-xs text-sage">
                Un breve beep quando arriva un nuovo ordine (solo a scheda attiva).
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant={chimeEnabled ? "primary" : "secondary"}
            size="sm"
            onClick={handleToggleChime}
          >
            {chimeEnabled ? "Attivo" : "Spento"}
          </Button>
        </li>

        <li className="flex items-center justify-between gap-3 rounded-lg border border-charcoal/10 px-3 py-3">
          <div className="flex items-center gap-3">
            {pushEnabled && permission === "granted" ? (
              <BellRing className="h-5 w-5 text-forest" />
            ) : (
              <BellOff className="h-5 w-5 text-sage" />
            )}
            <div>
              <div className="text-sm font-medium text-charcoal">
                Notifiche browser (scheda in background)
              </div>
              <div className="text-xs text-sage">
                {permission === "unsupported"
                  ? "Non supportato da questo browser"
                  : permission === "denied"
                    ? "Permesso negato — abilitare nelle impostazioni del browser"
                    : permission === "granted"
                      ? "Permesso concesso"
                      : "Richiede permesso del browser"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permission === "granted" ? (
              <Button
                type="button"
                variant={pushEnabled ? "primary" : "secondary"}
                size="sm"
                onClick={handleTogglePush}
              >
                {pushEnabled ? "Attivo" : "Spento"}
              </Button>
            ) : permission === "default" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAskPermission}
                disabled={requesting}
              >
                {requesting ? "Attesa…" : "Abilita"}
              </Button>
            ) : permission === "denied" ? (
              <Badge variant="outline">Bloccato</Badge>
            ) : (
              <Badge variant="outline">N/D</Badge>
            )}
          </div>
        </li>
      </ul>
    </Card>
  );
}
