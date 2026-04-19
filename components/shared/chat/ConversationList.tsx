"use client";

import Link from "next/link";
import { Search, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { formatRelativeTime } from "@/lib/utils/formatters";
import type { ConversationSummary, ChatViewpoint } from "./types";

export function ConversationList({
  conversations,
  viewpoint,
  activeRelationshipId,
  baseHref,
}: {
  conversations: ConversationSummary[];
  viewpoint: ChatViewpoint;
  activeRelationshipId: string | null;
  baseHref: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => {
      const label = viewpoint === "restaurant" ? c.supplierName : c.restaurantName;
      return label.toLowerCase().includes(needle);
    });
  }, [q, conversations, viewpoint]);

  return (
    <aside className="w-full lg:w-80 max-w-full shrink-0 lg:border-r border-[color:var(--ios-separator)] bg-[color:var(--color-surface,#fff)] lg:bg-white/60 h-full flex flex-col">
      <div className="px-4 pt-4 pb-3 lg:px-5 lg:py-5 lg:border-b border-[color:var(--ios-separator)]">
        <h2
          className="font-serif text-[28px] lg:text-xl font-medium tracking-[-0.02em] text-[color:var(--color-text-primary)]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Messaggi
        </h2>
        <p className="mt-0.5 text-[13px] lg:text-xs text-[color:var(--color-text-tertiary,#6B6B6B)]">
          {viewpoint === "restaurant" ? "I tuoi fornitori" : "I tuoi clienti"}
        </p>
        <div className="mt-3 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--ios-chev-muted,#8e8e93)] pointer-events-none"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca…"
            className="w-full rounded-xl border border-[color:var(--ios-separator)] bg-[color:var(--ios-fill-tertiary,rgba(120,120,128,0.08))] pl-9 pr-3 py-2.5 text-[16px] lg:text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-tertiary,#8e8e93)] focus:outline-none focus:border-[color:var(--color-brand-primary)] focus:ring-2 focus:ring-[color:var(--color-brand-primary-subtle)]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 py-10 text-center">
          <div className="max-w-[240px]">
            <Inbox className="mx-auto h-7 w-7 text-[color:var(--color-text-tertiary,#8e8e93)]" />
            <p className="mt-3 text-sm font-medium text-[color:var(--color-text-primary)]">
              Nessuna conversazione
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-text-tertiary,#8e8e93)]">
              Le chat compaiono qui quando una partnership è attiva.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {filtered.map((c) => {
            const name = viewpoint === "restaurant" ? c.supplierName : c.restaurantName;
            const isActive = c.relationshipId === activeRelationshipId;
            const hasUnread = c.unreadCount > 0;
            return (
              <li key={c.relationshipId}>
                <Link
                  href={`${baseHref}/${c.relationshipId}`}
                  className={[
                    "flex items-center gap-3 px-4 py-3.5 lg:py-3 border-b border-[color:var(--ios-separator)] transition-colors",
                    isActive
                      ? "bg-[color:var(--color-brand-primary-subtle)]"
                      : "active:bg-[color:var(--ios-fill-tertiary,rgba(120,120,128,0.12))] lg:hover:bg-[color:var(--ios-fill-tertiary,rgba(120,120,128,0.08))]",
                  ].join(" ")}
                >
                  <div
                    className="flex h-12 w-12 lg:h-10 lg:w-10 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] text-white text-[15px] lg:text-sm font-semibold shrink-0 shadow-sm"
                    aria-hidden
                  >
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={[
                          "text-[15px] lg:text-sm truncate text-[color:var(--color-text-primary)]",
                          hasUnread ? "font-semibold" : "font-medium",
                        ].join(" ")}
                      >
                        {name}
                      </span>
                      {c.lastMessageAt && (
                        <span
                          className={[
                            "text-[11px] lg:text-[10px] shrink-0 tabular-nums",
                            hasUnread
                              ? "text-[color:var(--color-brand-primary)] font-medium"
                              : "text-[color:var(--color-text-tertiary,#8e8e93)]",
                          ].join(" ")}
                        >
                          {formatRelativeTime(c.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={[
                          "text-[13px] lg:text-xs truncate",
                          hasUnread
                            ? "text-[color:var(--color-text-primary)]"
                            : "text-[color:var(--color-text-tertiary,#8e8e93)]",
                        ].join(" ")}
                      >
                        {c.lastMessagePreview ?? (
                          <em className="text-[color:var(--color-text-tertiary,#8e8e93)] opacity-70">
                            Ancora nessun messaggio
                          </em>
                        )}
                      </p>
                      {hasUnread && (
                        <span className="inline-flex min-w-[20px] h-[20px] px-1.5 rounded-full bg-[color:var(--color-brand-primary)] text-white text-[11px] font-semibold items-center justify-center shrink-0 tabular-nums">
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
