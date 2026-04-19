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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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

  function autosize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

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
    requestAnimationFrame(autosize);
    startTransition(async () => {
      const res = await sendMessage({
        relationship_id: relationshipId,
        body,
        order_split_id:  orderSplitId ?? null,
      });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(body);
        return;
      }
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
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--color-surface-muted,#faf7ef)] lg:bg-cream">
      <header className="hidden lg:flex items-center gap-3 border-b border-[color:var(--ios-separator)] bg-white/70 backdrop-blur px-5 py-3 shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] text-white text-sm font-semibold shadow-sm"
          aria-hidden
        >
          {counterpartyName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-[color:var(--color-text-primary)] truncate">
            {counterpartyName}
          </h2>
          <p className="text-xs text-[color:var(--color-text-tertiary,#8e8e93)] truncate">
            {orderSplitId ? "Chat su ordine specifico" : "Chat globale"}
          </p>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 lg:px-5 lg:py-6 space-y-5 lg:space-y-6 [overscroll-behavior:contain]"
      >
        {groups.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-sm">
              <div
                className="mx-auto h-14 w-14 rounded-full bg-[color:var(--color-brand-primary-subtle)] flex items-center justify-center mb-3"
                aria-hidden
              >
                <Send className="h-5 w-5 text-[color:var(--color-brand-primary)]" />
              </div>
              <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
                Inizia la conversazione
              </p>
              <p className="text-xs text-[color:var(--color-text-tertiary,#8e8e93)] mt-1">
                I messaggi inviati qui sono visibili solo a te e a {counterpartyName}.
              </p>
            </div>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.day} className="space-y-2">
              <div className="flex justify-center">
                <span className="inline-flex items-center rounded-full bg-[color:var(--ios-fill-tertiary,rgba(120,120,128,0.12))] px-3 py-1 text-[11px] font-medium text-[color:var(--color-text-tertiary,#6b6b6b)] uppercase tracking-wide">
                  {formatRelativeTime(g.day)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {g.items.map((m, i) => {
                  const mine = m.sender_profile === currentUserId;
                  const prev = g.items[i - 1];
                  const next = g.items[i + 1];
                  const samePrev = prev && (prev.sender_profile === currentUserId) === mine;
                  const sameNext = next && (next.sender_profile === currentUserId) === mine;
                  const cornerMine = [
                    "rounded-2xl",
                    samePrev ? "rounded-tr-md" : "",
                    sameNext ? "rounded-br-md" : "rounded-br-sm",
                  ].join(" ");
                  const cornerTheirs = [
                    "rounded-2xl",
                    samePrev ? "rounded-tl-md" : "",
                    sameNext ? "rounded-bl-md" : "rounded-bl-sm",
                  ].join(" ");
                  return (
                    <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={[
                          "max-w-[78%] lg:max-w-[72%] px-3.5 py-2 text-[15px] lg:text-sm leading-[1.35] shadow-sm",
                          mine
                            ? `bg-[color:var(--color-brand-primary)] text-white ${cornerMine}`
                            : `bg-white text-[color:var(--color-text-primary)] border border-[color:var(--ios-separator)] ${cornerTheirs}`,
                        ].join(" ")}
                      >
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                        <div
                          className={`mt-1 flex items-center gap-1 text-[10.5px] ${
                            mine
                              ? "text-white/75 justify-end"
                              : "text-[color:var(--color-text-tertiary,#8e8e93)]"
                          }`}
                        >
                          <time
                            dateTime={m.created_at}
                            title={formatDateTime(m.created_at)}
                            className="tabular-nums"
                          >
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

      <div
        className="border-t border-[color:var(--ios-separator)] bg-[color:var(--ios-chrome-bg,rgba(255,255,255,0.85))] [backdrop-filter:saturate(1.6)_blur(18px)] [-webkit-backdrop-filter:saturate(1.6)_blur(18px)] px-2.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:px-3 lg:py-3 shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              autosize();
            }}
            onKeyDown={handleKey}
            rows={1}
            placeholder={`Messaggio…`}
            className="flex-1 resize-none rounded-[22px] border border-[color:var(--ios-separator)] bg-[color:var(--color-surface-card,#fff)] px-4 py-2.5 text-[16px] lg:text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-tertiary,#8e8e93)] focus:outline-none focus:border-[color:var(--color-brand-primary)] focus:ring-2 focus:ring-[color:var(--color-brand-primary-subtle)] max-h-[140px]"
            style={{ minHeight: 40 }}
            aria-label={`Messaggio per ${counterpartyName}`}
          />
          <button
            onClick={handleSend}
            disabled={pending || draft.trim().length === 0}
            aria-label="Invia messaggio"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] text-white shadow-sm disabled:opacity-40 disabled:scale-95 transition-transform active:scale-90"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="hidden lg:block mt-1.5 pl-4 text-[10px] text-[color:var(--color-text-tertiary,#8e8e93)]">
          Invio:{" "}
          <kbd className="font-mono bg-[color:var(--ios-fill-tertiary,rgba(120,120,128,0.12))] rounded px-1">
            Enter
          </kbd>{" "}
          — a capo:{" "}
          <kbd className="font-mono bg-[color:var(--ios-fill-tertiary,rgba(120,120,128,0.12))] rounded px-1">
            Shift
          </kbd>
          +
          <kbd className="font-mono bg-[color:var(--ios-fill-tertiary,rgba(120,120,128,0.12))] rounded px-1">
            Enter
          </kbd>
        </p>
      </div>
    </div>
  );
}
