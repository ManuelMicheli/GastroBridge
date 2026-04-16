"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendMessage } from "@/lib/messages/actions";
import { markThreadRead } from "@/lib/messages/actions";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/formatters";
import type { PartnershipMessageRow } from "@/lib/messages/types";

type Props = {
  relationshipId: string;
  currentUserId: string;
  initialMessages: PartnershipMessageRow[];
  disabled?: boolean;
  disabledReason?: string;
};

export function MessageThread({
  relationshipId,
  currentUserId,
  initialMessages,
  disabled = false,
  disabledReason,
}: Props) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement | null>(null);

  // Realtime: any change on partnership_messages triggers router.refresh()
  // which re-fetches the server component and passes new initialMessages down.
  useRealtimeRefresh([
    { table: "partnership_messages", filter: `relationship_id=eq.${relationshipId}` },
  ]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [initialMessages.length]);

  // Mark thread as read on mount and whenever messages change
  useEffect(() => {
    const unread = initialMessages.some(
      (m) => !m.read_at && m.sender_profile !== currentUserId,
    );
    if (unread) {
      void markThreadRead(relationshipId);
    }
  }, [relationshipId, currentUserId, initialMessages]);

  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || disabled) return;

    startTransition(async () => {
      const res = await sendMessage({ relationship_id: relationshipId, body: trimmed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
    });
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-[480px] rounded-xl border border-sage-muted/30 bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {initialMessages.length === 0 ? (
          <p className="text-sm text-sage text-center py-8">
            Nessun messaggio. Avvia la conversazione.
          </p>
        ) : (
          initialMessages.map((m) => {
            const mine = m.sender_profile === currentUserId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                    mine
                      ? "bg-forest text-white rounded-br-sm"
                      : "bg-sage-muted/40 text-charcoal rounded-bl-sm",
                  )}
                >
                  <p>{m.body}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1 opacity-70",
                      mine ? "text-right" : "text-left",
                    )}
                  >
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-sage-muted/30 p-3 bg-gray-50">
        {disabled ? (
          <p className="text-sm text-sage text-center py-2">
            {disabledReason ?? "Messaggistica non disponibile."}
          </p>
        ) : (
          <div className="flex gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Scrivi un messaggio… (Invio per inviare, Shift+Invio per a capo)"
              rows={2}
              maxLength={2000}
              className="flex-1 resize-none rounded-xl border border-sage-muted/40 px-3 py-2 text-sm focus:outline-none focus:border-forest"
            />
            <Button
              size="sm"
              onClick={handleSend}
              isLoading={isPending}
              disabled={!body.trim() || isPending}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
