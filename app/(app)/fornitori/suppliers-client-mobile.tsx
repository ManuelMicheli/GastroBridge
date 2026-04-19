"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { RelationshipRow } from "./_lib/types";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { RelationshipStatusBadge } from "@/components/ui/relationship-status-badge";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

type Filter = "attivi" | "pending" | "altri";

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("it")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const COLORS = ["#8B2A30", "#2B6F42", "#1E3A8A", "#7A5B18", "#6B5D5F"];

function colorFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

export function SuppliersClientMobile({
  relationships,
}: {
  relationships: RelationshipRow[];
}) {
  const [filter, setFilter] = useState<Filter>("attivi");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => relationships.filter((r) => r.supplier !== null),
    [relationships],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    return rows.filter((r) => {
      if (filter === "attivi" && r.status !== "active") return false;
      if (filter === "pending" && r.status !== "pending") return false;
      if (
        filter === "altri" &&
        (r.status === "active" || r.status === "pending")
      )
        return false;
      if (!q) return true;
      return normalize(r.supplier!.company_name).includes(q);
    });
  }, [rows, filter, query]);

  const activeCount = rows.filter((r) => r.status === "active").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const othersCount = rows.length - activeCount - pendingCount;

  async function handleRefresh() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.pathname + url.search);
    }
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-4">
        <LargeTitle
          eyebrow={
            pendingCount > 0
              ? `${pendingCount} richieste in attesa`
              : "Partnership attive"
          }
          title={`${activeCount} fornitori`}
          actions={
            <Link
              href="/fornitori/cerca"
              className="rounded-lg p-2 text-[color:var(--color-brand-primary)] transition active:bg-black/5"
              aria-label="Cerca nuovi fornitori"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          }
        />

        <div className="mx-3 mt-3 flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search
              aria-hidden
              className="absolute left-2.5 h-4 w-4 text-[color:var(--ios-chev-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca fornitore…"
              className="h-9 w-full rounded-lg bg-[color:var(--ios-fill-quinary)] pl-8 pr-8 text-[color:var(--color-text-primary)] placeholder:text-[color:var(--ios-chev-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]"
              style={{ fontSize: "16px" }}
              aria-label="Cerca fornitori"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 rounded-full p-0.5 text-[color:var(--ios-chev-muted)] active:bg-black/10"
                aria-label="Pulisci"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mx-3 mt-3">
          <SegmentedControl
            options={[
              { value: "attivi", label: "Attivi", count: activeCount },
              { value: "pending", label: "Richieste", count: pendingCount },
              { value: "altri", label: "Altri", count: othersCount },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            ariaLabel="Filtra fornitori"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 px-6 text-center text-[color:var(--text-muted-light)]">
            Nessun fornitore corrisponde.
          </div>
        ) : (
          <GroupedList
            className="mt-4"
            label={
              filter === "attivi"
                ? `Attivi · ${filtered.length}`
                : filter === "pending"
                  ? `Richieste · ${filtered.length}`
                  : `Altri · ${filtered.length}`
            }
          >
            {filtered.map((r) => {
              const s = r.supplier!;
              return (
                <GroupedListRow
                  key={r.id}
                  href={`/fornitori/${s.id}`}
                  leading={
                    s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.logo_url}
                        alt=""
                        className="h-[28px] w-[28px] rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-[28px] w-[28px] items-center justify-center rounded-full font-serif text-[11px] font-medium text-white"
                        style={{
                          background: colorFor(s.id),
                          fontFamily: "Georgia, serif",
                        }}
                      >
                        {initials(s.company_name)}
                      </div>
                    )
                  }
                  title={
                    <span className="flex items-center gap-1.5">
                      {s.company_name}
                      {s.is_verified && (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3 w-3 text-[color:var(--color-brand-primary)]"
                          aria-label="verificato"
                        >
                          <path
                            d="M8 1l1.5 1.5L11 2l1 1.5L13.5 4v2L15 7l-.5 1.5L15 10l-1.5.5-.5 2-1.5-.5L10 13l-1.5-.5L8 14l-1.5-1.5L5 13l-1-1.5L2.5 11l-.5-2-1.5-.5L1 7 .5 5.5 1 4l1.5-.5L3 2l1.5.5L5 1l1.5 1.5z"
                            fill="currentColor"
                            opacity="0.15"
                          />
                          <path
                            d="m5 8 2 2 4-4"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  }
                  subtitle={
                    <span>
                      {s.city ?? "—"}
                      {s.rating_avg
                        ? ` · ★ ${s.rating_avg.toFixed(1)}`
                        : ""}
                    </span>
                  }
                  trailing={
                    <RelationshipStatusBadge status={r.status} size="xs" />
                  }
                />
              );
            })}
          </GroupedList>
        )}
      </div>
    </PullToRefresh>
  );
}
