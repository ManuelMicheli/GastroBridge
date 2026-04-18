"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Send, CheckCheck, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markThreadRead } from "@/lib/messages/actions";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/formatters";
import type { ChatThreadProps, PartnershipMessageRow } from "./types";

function groupByDay(messages: PartnershipMessageRow[]): { day: string; items: PartnershipMessageRow[] }[] {
  const groups = new Map<string, PartnershipMessageRow[]>();
  for (const m of messages) {
    const key = m.created_at.slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([day, items]) => ({ day, items }));
}

export function ChatThread({
  relationshipId,
  orderSplitId = null,
  currentUserId,
  viewpoint,
  counterpartyName,
  initialMessages,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<PartnershipMessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Initial scroll + when new messages arrive, keep anchored to bottom if user is near bottom.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mark thread as read on mount + whenever new messages appear (debounced a bit).
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      void markThreadRead(relationshipId, orderSplitId ?? null);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [relationshipId, orderSplitId, messages.length]);

  // Realtime: subscribe to inserts on partnership_messages for this relationship.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pm-${relationshipId}-${orderSplitId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "partnership_messages",
          filter: `relationship_id=eq.${relationshipId}`,
        },
        (payload) => {
          const row = payload.new as PartnershipMessageRow;
          // Enforce scope: only show messages matching our orderSplitId filter.
          const matchScope =
            orderSplitId == null
              ? row.order_split_id == null
              : row.order_split_id === orderSplitId;
          if (!matchScope) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [relationshipId, orderSplitId]);

  const groups = useMemo(() => groupByDay(messages), [messages]);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    const optimistic: PartnershipMessageRow = {
      id:              `optimistic-${Date.now()}`,
      relationship_id: relationshipId,
      sender_role:     viewpoint,
      sender_profile:  currentUserId,
      body,
      attachments:     null,
      order_split_id:  orderSplitId ?? null,
      read_at:         null,
      created_at:      new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    startTransition(async () => {
      const res = await sendMessage({
        relationship_id: relationshipId,
        body,
        order_split_id:  orderSplitId ?? null,
      });
      if (!res.ok) {
        // rollback optimistic + restore draft
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(body);
        return;
      }
      // Replace optimistic with persisted row.
      setMessages((prev) => {
        const withoutOpt = prev.filter((m) => m.id !== optimistic.id);
        if (withoutOpt.some((m) => m.id === res.data.id)) return withoutOpt;
        return [...withoutOpt, res.data];
      });
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-cream">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-sage-muted/30 bg-white/70 backdrop-blur px-5 py-3 shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-white text-sm font-bold shadow-sm"
          aria-hidden
        >
          {counterpartyName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-charcoal truncate">{counterpartyName}</h2>
          <p className="text-xs text-sage truncate">
            {orderSplitId ? "Chat su ordine specifico" : "Chat globale"}
          </p>
        </div>
      </header>

      {/* Scrollable message area */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-6 space-y-6">
        {groups.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-sm">
              <div className="mx-auto h-12 w-12 rounded-full bg-sage-muted/30 flex items-center justify-center mb-3" aria-hidden>
                <Send className="h-5 w-5 text-sage" />
              </div>
              <p className="text-sm font-medium text-charcoal">Inizia la conversazione</p>
              <p className="text-xs text-sage mt-1">
                I messaggi inviati qui sono visibili solo a te e a {counterpartyName}.
              </p>
            </div>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.day} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-sage-muted/30" />
                <span className="text-[10px] uppercase tracking-wider text-sage">
                  {formatRelativeTime(g.day)}
                </span>
                <div className="h-px flex-1 bg-sage-muted/30" />
              </div>
              <ul className="space-y-2">
                {g.items.map((m) => {
                  const mine = m.sender_profile === currentUserId;
                  return (
                    <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={[
                          "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                          mine
                            ? "bg-forest text-white rounded-br-sm"
                            : "bg-white text-charcoal rounded-bl-sm border border-sage-muted/30",
                        ].join(" ")}
                      >
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                        <div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-white/70 justify-end" : "text-sage"}`}>
                          <time dateTime={m.created_at} title={formatDateTime(m.created_at)}>
                            {new Date(m.created_at).toLocaleTimeString("it-IT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          {mine && (
                            m.read_at ? (
                              <CheckCheck className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-sage-muted/30 bg-white/80 backdrop-blur px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder={`Scrivi un messaggio a ${counterpartyName}…`}
            className="flex-1 resize-none rounded-2xl border border-sage-muted/40 bg-cream px-4 py-2.5 text-sm text-charcoal placeholder:text-sage focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 max-h-40"
          />
          <button
            onClick={handleSend}
            disabled={pending || draft.trim().length === 0}
            aria-label="Invia messaggio"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-forest text-white shadow-sm disabled:opacity-40 transition-transform active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 pl-4 text-[10px] text-sage">
          Invio: <kbd className="font-mono bg-sage-muted/30 rounded px-1">Enter</kbd> — a capo: <kbd className="font-mono bg-sage-muted/30 rounded px-1">Shift</kbd>+<kbd className="font-mono bg-sage-muted/30 rounded px-1">Enter</kbd>
        </p>
      </div>
    </div>
  );
}
