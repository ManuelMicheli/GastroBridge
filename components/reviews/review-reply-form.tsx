"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { replyToReview } from "@/lib/supplier/reviews/actions";

/** Inline reply editor for a received review (supplier, `reviews.reply`). */
export function ReviewReplyForm({
  reviewId,
  initialReply,
}: {
  reviewId: string;
  initialReply: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialReply ?? "");
  const [pending, startTransition] = useTransition();
  const fieldId = `reply-${reviewId}`;

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="mt-3" onClick={() => setOpen(true)}>
        {initialReply ? "Modifica risposta" : "Rispondi"}
      </Button>
    );
  }

  function save() {
    startTransition(async () => {
      const res = await replyToReview({ reviewId, reply: text });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(text.trim() ? "Risposta pubblicata" : "Risposta rimossa");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={fieldId} className="f-label">
        La tua risposta
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        className="f-input min-h-[88px] w-full py-2"
        placeholder="Ringrazia il cliente o chiarisci cosa è successo…"
      />
      <div className="flex gap-2">
        <Button size="sm" isLoading={pending} onClick={save}>
          Pubblica
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
