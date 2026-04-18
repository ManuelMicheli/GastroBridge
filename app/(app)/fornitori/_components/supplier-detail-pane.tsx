// app/(app)/fornitori/_components/supplier-detail-pane.tsx
"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin, Search, Shield, Star, X } from "lucide-react";
import { RelationshipStatusBadge } from "@/components/ui/relationship-status-badge";
import { Button } from "@/components/ui/button";
import { ratingColorClass, type RelationshipRow } from "../_lib/types";

export function SupplierDetailPane({
  relationship,
  onClose,
}: {
  relationship: RelationshipRow | null;
  onClose: () => void;
}) {
  if (!relationship || !relationship.supplier) {
    return (
      <aside
        className="hidden h-full border-l border-border-subtle bg-surface-card lg:block"
        role="region"
        aria-label="Dettagli fornitore"
      >
        <div className="flex h-full items-center justify-center p-10 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          ← seleziona un fornitore dalla lista
        </div>
      </aside>
    );
  }

  const s = relationship.supplier;
  const rating = s.rating_avg ?? 0;
  const ratingCls = ratingColorClass(rating);

  return (
    <aside
      className="flex h-full flex-col border-l border-border-subtle bg-surface-card"
      role="region"
      aria-label={`Dettagli ${s.company_name}`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sage-muted/30">
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logo_url}
                alt={s.company_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-base font-semibold text-sage">
                {s.company_name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[17px] font-semibold text-text-primary">
                {s.company_name}
              </h3>
              {s.is_verified && (
                <Shield
                  className="h-4 w-4 shrink-0 text-accent-green"
                  aria-label="Verificato"
                />
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <RelationshipStatusBadge status={relationship.status} size="md" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                invitato {formatDate(relationship.invited_at)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
          aria-label="Chiudi dettagli"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-border-subtle px-4 py-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Rating
          </p>
          <div className="flex items-baseline gap-2">
            <Star className={`h-5 w-5 ${ratingCls}`} />
            <span
              className={`font-mono text-[28px] font-semibold tabular-nums ${ratingCls}`}
            >
              {rating.toFixed(1)}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-text-tertiary">
              / 5 · {s.rating_count ?? 0} recensioni
            </span>
          </div>
        </section>

        {s.city && (
          <section className="border-b border-border-subtle px-4 py-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              Sede
            </p>
            <p className="flex items-center gap-1.5 text-[13px] text-text-primary">
              <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
              {s.city}
              {s.province ? ` (${s.province})` : ""}
            </p>
          </section>
        )}

        {s.description && (
          <section className="border-b border-border-subtle px-4 py-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              Descrizione
            </p>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {s.description}
            </p>
          </section>
        )}

        {(s.certifications ?? []).length > 0 && (
          <section className="border-b border-border-subtle px-4 py-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              Certificazioni
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(s.certifications ?? []).map((cert) => (
                <span
                  key={cert}
                  className="rounded bg-accent-green/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-green"
                >
                  {cert}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-border-subtle p-3">
        <div className="flex flex-col gap-2">
          <Link href={`/fornitori/${s.id}`} className="w-full">
            <Button
              variant="primary"
              size="md"
              density="compact"
              className="w-full justify-center"
            >
              <ArrowUpRight className="h-4 w-4" /> Vai al profilo completo
            </Button>
          </Link>
          <Link href={`/cataloghi/${s.id}`} className="w-full">
            <Button
              variant="secondary"
              size="md"
              density="compact"
              className="w-full justify-center"
            >
              <Search className="h-4 w-4" /> Cerca nei suoi prodotti
            </Button>
          </Link>
        </div>
      </footer>
    </aside>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
