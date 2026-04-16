import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { RelationshipStatus } from "@/lib/relationships/types";

const MAP: Record<RelationshipStatus, { label: string; variant: BadgeVariant }> = {
  pending:  { label: "In attesa",  variant: "warning" },
  active:   { label: "Attivo",     variant: "success" },
  paused:   { label: "In pausa",   variant: "info" },
  rejected: { label: "Rifiutato",  variant: "outline" },
  archived: { label: "Archiviato", variant: "outline" },
};

export function RelationshipStatusBadge({ status }: { status: RelationshipStatus }) {
  const { label, variant } = MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
