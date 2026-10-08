// lib/finance/server.ts
// Server read model of the unified "Stato collegamenti" (casse POS + SDI).
// Callers authorize first (getFinanceAccess).

import "server-only";
import { getFiscalEnabled, listIntegrations } from "@/lib/fiscal/queries";
import { activeProvider } from "@/lib/invoices/providers/registry";
import type { Db } from "@/lib/invoices/server/db";
import { getLastUploadAt } from "@/lib/invoices/server/queries";
import { getConnection, type SdiConnectionRow } from "@/lib/invoices/server/sdi";
import { overallHealth, posCard, posPlaceholderCard, sdiCard, type ConnectionCard, type Health } from "./connections";

export interface ConnectionsState {
  cards: ConnectionCard[];
  overall: Health;
  sdi: {
    providerConfigured: boolean;
    providerLabel: string;
    missing: string[];
    connection: SdiConnectionRow | null;
  };
  posCount: number;
  fiscalEnabled: boolean;
}

export async function getConnectionsState(db: Db, restaurantId: string): Promise<ConnectionsState> {
  const provider = activeProvider();
  const st = provider.status();
  const [integrations, fiscalEnabled, connection, lastUploadAt] = await Promise.all([
    listIntegrations(restaurantId).catch(() => []),
    getFiscalEnabled(restaurantId).catch(() => false),
    getConnection(db, restaurantId).catch(() => null),
    getLastUploadAt(db, restaurantId).catch(() => null),
  ]);
  const now = new Date();
  const placeholder = posPlaceholderCard(fiscalEnabled, integrations.length > 0);
  const cards: ConnectionCard[] = [
    sdiCard({ providerConfigured: st.configured, connection, lastUploadAt }, now),
    ...(placeholder ? [placeholder] : []),
    ...(fiscalEnabled ? integrations : []).map((i) =>
      posCard(
        {
          id: i.id,
          provider: i.provider,
          status: i.status,
          display_name: i.display_name,
          last_synced_at: i.last_synced_at,
          last_error: i.last_error,
        },
        now,
      ),
    ),
  ];
  return {
    cards,
    overall: overallHealth(cards),
    sdi: { providerConfigured: st.configured, providerLabel: provider.label, missing: st.missing, connection },
    posCount: integrations.length,
    fiscalEnabled,
  };
}
