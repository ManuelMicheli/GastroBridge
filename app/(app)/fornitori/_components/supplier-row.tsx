// app/(app)/fornitori/_components/supplier-row.tsx
"use client";

import { ChevronRight, Shield, Star } from "lucide-react";
import { ratingColorClass, type RelationshipRow } from "../_lib/types";
import { RelationshipStatusBadge } from "@/components/ui/relationship-status-badge";

export function SupplierRow({
  rel,
  selected,
  onSelect,
  index,
}: {
  rel: RelationshipRow;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const s = rel.supplier;
  if (!s) return null;

  const rating = s.rating_avg ?? 0;
  const ratingCls = ratingColorClass(rating);;

  return (
    <button
      type="button"
      onClick={onSelect}
      id={`supplier-row-${index}`}
      data-selected={selected ? "true" : undefined}
      className={`flex h-14 w-full items-center gap-3 border-l-2 px-4 text-left transition-colors duration-75 ${
        selected
          ? "border-accent-green bg-accent-green/[0.06]"
          : "border-transparent hover:bg-surface-hover"
      }`}
      aria-selected={selected}
      role="option"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sage-muted/30">
        {s.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.logo_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-semibold text-[11px] text-sage">
            {s.company_name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
        <span className="truncate text-[14px] text-text-primary">
          {s.company_name}
        </span>
        {s.is_verified && (
          <Shield className="h-3.5 w-3.5 shrink-0 text-accent-green" />
        )}
        <RelationshipStatusBadge status={rel.status} size="xs" />
      </span>

      <span className="hidden shrink-0 truncate font-mono text-[11px] text-text-tertiary md:inline max-w-[140px]">
        {s.city ? (s.province ? `${s.city} · ${s.province}` : s.city) : "—"}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <Star className={`h-3.5 w-3.5 ${ratingCls}`} />
        <span
          className={`font-mono text-[12px] tabular-nums ${ratingCls}`}
        >
          {rating.toFixed(1)}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
          ({s.rating_count ?? 0})
        </span>
      </span>

      <span className="hidden shrink-0 gap-1 lg:flex">
        {(s.certifications ?? []).slice(0, 2).map((cert) => (
          <span
            key={cert}
            className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-text-secondary"
          >
            {cert}
          </span>
        ))}
      </span>

      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
    </button>
  );
}
