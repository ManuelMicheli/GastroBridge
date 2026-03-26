"use client";

import { useState } from "react";
import { RatingStars } from "./rating-stars";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface ReviewFormProps {
  onSubmit: (data: {
    rating: number;
    qualityRating: number;
    deliveryRating: number;
    serviceRating: number;
    comment: string;
  }) => Promise<void>;
}

export function ReviewForm({ onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [qualityRating, setQualityRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { toast("Seleziona un rating"); return; }
    setIsLoading(true);
    await onSubmit({ rating, qualityRating, deliveryRating, serviceRating, comment });
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm font-semibold text-charcoal block mb-2">Valutazione generale</label>
        <RatingStars rating={rating} size="lg" interactive onChange={setRating} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-sage block mb-1">Qualita</label>
          <RatingStars rating={qualityRating} size="sm" interactive onChange={setQualityRating} />
        </div>
        <div>
          <label className="text-xs text-sage block mb-1">Consegna</label>
          <RatingStars rating={deliveryRating} size="sm" interactive onChange={setDeliveryRating} />
        </div>
        <div>
          <label className="text-xs text-sage block mb-1">Servizio</label>
          <RatingStars rating={serviceRating} size="sm" interactive onChange={setServiceRating} />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-charcoal block mb-2">Commento</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Racconta la tua esperienza..."
          rows={4}
          maxLength={1000}
          className="w-full border-2 border-sage-muted rounded-xl py-3 px-4 font-body text-charcoal placeholder:text-sage focus:border-forest focus:outline-none resize-none"
        />
        <p className="text-xs text-sage mt-1">{comment.length}/1000</p>
      </div>

      <Button type="submit" isLoading={isLoading}>Invia Recensione</Button>
    </form>
  );
}
