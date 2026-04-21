"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pause, Play, Trash2, AlertTriangle, FileUp } from "lucide-react";
import {
  createFiscalIntegration,
  deleteFiscalIntegration,
  pauseFiscalIntegration,
  resumeFiscalIntegration,
  setFiscalEnabled,
} from "@/lib/fiscal/actions";
import type { IntegrationRow } from "@/lib/fiscal/queries";
import { providerLabel } from "@/lib/fiscal/format";
import type { FiscalProvider } from "@/lib/fiscal/types";

const CONNECTABLE: FiscalProvider[] = [
  "tilby",
  "cassa_in_cloud",
  "lightspeed",
  "scloby",
  "generic_webhook",
];

type Props = {
  restaurantId: string;
  fiscalEnabled: boolean;
  integrations: IntegrationRow[];
  webhookBaseUrl: string;
};

export function IntegrazioniClient({
  restaurantId,
  fiscalEnabled,
  integrations,
  webhookBaseUrl,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [secretJustShown, setSecretJustShown] = useState<{
    id: string;
    secret: string;
  } | null>(null);
  const [connectProvider, setConnectProvider] =
    useState<FiscalProvider | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function toggleEnabled(next: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setFiscalEnabled(restaurantId, next);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  async function submitConnect() {
    if (!connectProvider) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await createFiscalIntegration({
          restaurant_id: restaurantId,
          provider: connectProvider,
          display_name: displayName || undefined,
          device_id: deviceId || undefined,
        });
        if (res.webhook_secret) {
          setSecretJustShown({ id: res.id, secret: res.webhook_secret });
        }
        setConnectProvider(null);
        setDisplayName("");
        setDeviceId("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="bg-surface-card border border-border-subtle rounded-2xl p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-medium text-text-secondary">
              Stato Cassetto Fiscale
            </h2>
            <p className="text-xs text-text-tertiary mt-1 max-w-md">
              Quando attivo, la piattaforma riceve gli scontrini dalle
              integrazioni qui sotto e calcola food cost % e reorder suggestions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleEnabled(!fiscalEnabled)}
            disabled={pending}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              fiscalEnabled
                ? "bg-accent-orange/10 text-accent-orange hover:bg-accent-orange/20"
                : "bg-accent-green text-surface-base hover:bg-accent-green/90"
            }`}
          >
            {fiscalEnabled ? "Disattiva" : "Attiva"}
          </button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 bg-accent-orange/10 border border-accent-orange/30 rounded-xl px-4 py-3 text-sm text-accent-orange">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {secretJustShown && (
        <div className="bg-surface-card border border-accent-green/40 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-accent-green mb-2">
            Segreto webhook — salvalo ora
          </p>
          <p className="text-xs text-text-secondary mb-3">
            Non potrai più vederlo dopo aver chiuso questa card. Usa HMAC-SHA256
            su header <code>x-gb-signature</code>.
          </p>
          <code className="block bg-surface-base rounded-lg px-3 py-2 text-xs font-mono text-text-primary break-all">
            {secretJustShown.secret}
          </code>
          <p className="text-xs text-text-tertiary mt-2">
            Endpoint:{" "}
            <code className="font-mono">
              {webhookBaseUrl}/api/fiscal/webhooks/[provider]
            </code>
            <br />
            Header: <code className="font-mono">x-gb-integration-id: {secretJustShown.id}</code>
          </p>
          <button
            type="button"
            onClick={() => setSecretJustShown(null)}
            className="mt-3 text-xs text-accent-green hover:underline"
          >
            Ho salvato il segreto
          </button>
        </div>
      )}

      <section className="bg-surface-card border border-border-subtle rounded-2xl">
        <div className="p-5 lg:p-6 flex items-center justify-between border-b border-border-subtle">
          <div>
            <h2 className="text-sm font-medium text-text-secondary">
              Integrazioni collegate
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              {integrations.length} totali
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/finanze/integrazioni/csv?r=${restaurantId}`}
              aria-disabled={!fiscalEnabled}
              className={`inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-accent ${
                !fiscalEnabled ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <FileUp className="h-3.5 w-3.5" />
              Import CSV
            </Link>
            <button
              type="button"
              onClick={() => setConnectProvider("tilby")}
              disabled={!fiscalEnabled || pending}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-green px-3 py-1.5 text-xs font-medium text-surface-base disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi
            </button>
          </div>
        </div>

        {integrations.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-text-tertiary">
            Nessuna integrazione collegata.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {integrations.map((i) => (
              <li
                key={i.id}
                className="px-5 lg:px-6 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        i.status === "active"
                          ? "bg-accent-green"
                          : i.status === "error"
                            ? "bg-accent-orange"
                            : "bg-text-tertiary"
                      }`}
                      aria-hidden
                    />
                    <p className="text-sm text-text-primary truncate">
                      {i.display_name ?? providerLabel(i.provider)}
                    </p>
                    <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {providerLabel(i.provider)}
                    </span>
                  </div>
                  {i.last_error && (
                    <p className="text-xs text-accent-orange mt-1 truncate">
                      {i.last_error}
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary mt-1 font-mono">
                    {i.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {i.status === "paused" ? (
                    <button
                      type="button"
                      onClick={() =>
                        run(() => resumeFiscalIntegration(i.id))
                      }
                      disabled={pending}
                      className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
                      title="Riattiva"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => run(() => pauseFiscalIntegration(i.id))}
                      disabled={pending}
                      className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
                      title="Pausa"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          "Eliminare l'integrazione? Gli scontrini storici restano visibili.",
                        )
                      ) {
                        run(() => deleteFiscalIntegration(i.id));
                      }
                    }}
                    disabled={pending}
                    className="p-2 rounded-lg hover:bg-surface-hover text-accent-orange"
                    title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {connectProvider && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              Collega {providerLabel(connectProvider)}
            </h3>
            <p className="text-xs text-text-tertiary mb-5">
              Crea l&apos;integrazione. I POS OAuth richiedono un passaggio di
              autorizzazione separato al prossimo step.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                  Provider
                </label>
                <select
                  value={connectProvider}
                  onChange={(e) =>
                    setConnectProvider(e.target.value as FiscalProvider)
                  }
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                >
                  {CONNECTABLE.map((p) => (
                    <option key={p} value={p}>
                      {providerLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                  Nome
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder='es. "Cassa sala principale"'
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                  Device ID (opzionale)
                </label>
                <input
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="serial POS o codice device"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConnectProvider(null)}
                className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={submitConnect}
                disabled={pending}
                className="bg-accent-green text-surface-base text-sm font-medium rounded-lg px-4 py-2 hover:bg-accent-green/90 disabled:opacity-50"
              >
                Crea integrazione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
