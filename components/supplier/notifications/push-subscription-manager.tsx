"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getExistingSubscription,
  isPushSupported,
  registerPushSubscription,
  unregisterPushSubscription,
} from "@/lib/push/client";

type Status = "loading" | "unsupported" | "denied" | "disabled" | "enabled";

export function PushSubscriptionManager() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setStatus("denied");
      return;
    }

    const sub = await getExistingSubscription();
    if (sub && permission === "granted") {
      setStatus("enabled");
      // Refresh last_used_at server-side (best-effort, fire-and-forget).
      fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        /* ignore */
      });
    } else {
      setStatus("disabled");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await registerPushSubscription();
      setStatus("enabled");
      setMessage("Notifiche push abilitate su questo dispositivo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
      // Sync status in case permission changed.
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await unregisterPushSubscription();
      setStatus("disabled");
      setMessage("Notifiche push disattivate su questo dispositivo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="text-sm text-sage">Verifica stato notifiche in corso...</div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          Il tuo browser non supporta le notifiche push. Prova con Chrome, Edge o
          Firefox desktop aggiornati.
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            Hai negato il permesso per le notifiche. Per riabilitarle, apri le
            impostazioni del browser per questo sito e consenti le notifiche,
            poi ricarica la pagina.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {status === "enabled" ? (
          <>
            <div className="flex items-center gap-2 text-sm font-medium text-forest">
              <Bell className="h-4 w-4" />
              Notifiche push attive su questo dispositivo
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDisable}
              isLoading={busy}
              disabled={busy}
            >
              Disattiva
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-sage">
              <BellOff className="h-4 w-4" />
              Notifiche push disattivate
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnable}
              isLoading={busy}
              disabled={busy}
            >
              Attiva notifiche
            </Button>
          </>
        )}
      </div>

      {message && (
        <div className="text-sm text-forest">{message}</div>
      )}
      {error && (
        <div className="text-sm text-red-700">{error}</div>
      )}
      <p className="text-xs text-sage">
        Le notifiche vengono inviate solo a questo browser/dispositivo. Attivale
        anche sugli altri dispositivi in cui vuoi riceverle.
      </p>
    </div>
  );
}
