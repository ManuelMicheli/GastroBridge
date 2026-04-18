"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { ChatThread } from "./ChatThread";
import type { PartnershipMessageRow, ChatViewpoint } from "./types";

/**
 * Slide-in drawer with per-order chat thread. Fetches messages on open.
 * Strictly scoped to the given order_split_id — no other-order leak.
 */
export function OrderChatDrawer({
  relationshipId,
  orderSplitId,
  currentUserId,
  viewpoint,
  counterpartyName,
  initialUnread = 0,
}: {
  relationshipId: string;
  orderSplitId: string;
  currentUserId: string;
  viewpoint: ChatViewpoint;
  counterpartyName: string;
  initialUnread?: number;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PartnershipMessageRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || messages !== null) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/messages?relationshipId=${encodeURIComponent(relationshipId)}&orderSplitId=${encodeURIComponent(orderSplitId)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (res.ok && Array.isArray(data.messages)) {
          setMessages(data.messages as PartnershipMessageRow[]);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, messages, relationshipId, orderSplitId]);

  // Close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-forest px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-forest/30 hover:bg-forest-dark focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 transition-transform active:scale-95"
      >
        <MessageCircle className="h-4 w-4" />
        Chat ordine
        {initialUnread > 0 && (
          <span className="inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-terracotta text-[10px] font-bold">
            {initialUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Chat ordine"
        >
          <button
            type="button"
            aria-label="Chiudi chat"
            onClick={() => setOpen(false)}
            className="flex-1 bg-charcoal/40 backdrop-blur-sm animate-in fade-in"
          />
          <section className="w-full max-w-md h-full bg-cream shadow-2xl border-l border-sage-muted/30 flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-sage-muted/30 bg-white">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-sage">Chat ordine</p>
                <p className="font-semibold text-charcoal truncate">{counterpartyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
                className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-sage-muted/30 text-sage"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {loading || messages === null ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-sage animate-spin" />
                </div>
              ) : (
                <ChatThread
                  relationshipId={relationshipId}
                  orderSplitId={orderSplitId}
                  currentUserId={currentUserId}
                  viewpoint={viewpoint}
                  counterpartyName={counterpartyName}
                  initialMessages={messages}
                />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
