"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";

type Result = { ok: true } | { ok: false; error: string };

const ReplySchema = z.object({
  reviewId: z.string().uuid("Recensione non valida"),
  reply: z.string().trim().max(1000, "Massimo 1000 caratteri"),
});

/**
 * Reply to (or edit / remove with an empty text) a review received by the
 * current user's supplier. Permission: `reviews.reply` (admin, sales).
 */
export async function replyToReview(input: {
  reviewId: string;
  reply: string;
}): Promise<Result> {
  const parsed = ReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }
  try {
    const supabase = await createClient();
    const { data: review } = await supabase
      .from("reviews")
      .select("id, supplier_id")
      .eq("id", parsed.data.reviewId)
      .maybeSingle<{ id: string; supplier_id: string }>();
    if (!review) return { ok: false, error: "Recensione non trovata" };

    await requirePermission(review.supplier_id, "reviews.reply");

    const { data: updated, error } = await supabase
      .from("reviews")
      .update({ supplier_reply: parsed.data.reply || null } as never)
      .eq("id", review.id)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!updated || updated.length === 0) {
      return { ok: false, error: "Non hai i permessi per rispondere a questa recensione" };
    }

    revalidatePath("/supplier/recensioni");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Errore invio risposta" };
  }
}
