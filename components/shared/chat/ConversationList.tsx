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
    <aside className="w-full lg:w-80 max-w-full shrink-0 lg:border-r border-sage-muted/30 bg-white/60 h-full flex flex-col">
      <div className="px-5 py-5 lg:border-b border-sage-muted/30">
        <h2
          className="font-serif text-[26px] lg:text-xl font-medium tracking-[-0.02em] text-[color:var(--color-text-primary)]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Messaggi
        </h2>
        <p className="mt-0.5 text-[12px] lg:text-xs text-[color:var(--text-muted-light,#6B6B6B)]">
          {viewpoint === "restaurant" ? "I tuoi fornitori" : "I tuoi clienti"}
        </p>
        <div className="mt-3 relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--ios-chev-muted)] pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca…"
            className="w-full rounded-lg border border-sage-muted/40 bg-cream pl-8 pr-3 py-2 text-sm text-charcoal placeholder:text-sage focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
            style={{ fontSize: "16px" }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 py-10 text-center">
          <div className="max-w-[220px]">
            <Inbox className="mx-auto h-7 w-7 text-sage" />
            <p className="mt-3 text-sm text-charcoal">Nessuna conversazione</p>
            <p className="mt-1 text-xs text-sage">
              Le chat compaiono qui quando una partnership è attiva.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const name = viewpoint === "restaurant" ? c.supplierName : c.restaurantName;
            const isActive = c.relationshipId === activeRelationshipId;
            return (
              <li key={c.relationshipId}>
                <Link
                  href={`${baseHref}/${c.relationshipId}`}
                  className={[
                    "flex items-center gap-3 px-4 py-3 border-b border-sage-muted/20 transition-colors",
                    isActive ? "bg-forest-light/40" : "hover:bg-sage-muted/20",
                  ].join(" ")}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-white text-sm font-bold shrink-0 shadow-sm"
                    aria-hidden
                  >
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-charcoal text-sm truncate">{name}</span>
                      {c.lastMessageAt && (
                        <span className="text-[10px] text-sage shrink-0">
                          {formatRelativeTime(c.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-sage truncate">
                        {c.lastMessagePreview ?? (
                          <em className="text-sage/70">Ancora nessun messaggio</em>
                        )}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="inline-flex min-w-[18px] h-[18px] px-1.5 rounded-full bg-terracotta text-white text-[10px] font-bold items-center justify-center shrink-0">
                          {c.unreadCount}
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
