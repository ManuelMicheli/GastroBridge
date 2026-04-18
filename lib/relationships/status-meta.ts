// lib/relationships/status-meta.ts
//
// Single source of truth for restaurant<->supplier relationship status.

import type { StatusTone } from "@/lib/ui/tones";

export type RelationshipStatusMeta = {
  label: string;
  tone: StatusTone;
};

export const RELATIONSHIP_STATUS_META: Record<string, RelationshipStatusMeta> = {
  pending:  { label: "In attesa",  tone: "amber" },
  active:   { label: "Attiva",     tone: "emerald" },
  paused:   { label: "In pausa",   tone: "neutral" },
  rejected: { label: "Rifiutata",  tone: "rose" },
  archived: { label: "Archiviata", tone: "neutral" },
};

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function getRelationshipStatusMeta(status: string): RelationshipStatusMeta {
  return (
    RELATIONSHIP_STATUS_META[status] ?? {
      label: capitalize(status),
      tone: "neutral",
    }
  );
}
