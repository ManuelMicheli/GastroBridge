import { RatingStars } from "./rating-stars";
import { formatRelativeTime } from "@/lib/utils/formatters";

interface ReviewCardProps {
  review: {
    rating: number;
    quality_rating: number | null;
    delivery_rating: number | null;
    service_rating: number | null;
    comment: string | null;
    supplier_reply: string | null;
    created_at: string;
    restaurant_name?: string;
  };
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-charcoal text-sm">{review.restaurant_name ?? "Ristorante"}</p>
          <p className="text-xs text-sage">{formatRelativeTime(review.created_at)}</p>
        </div>
        <RatingStars rating={review.rating} size="sm" />
      </div>

      {review.comment && (
        <p className="text-sm text-charcoal mb-3 leading-relaxed">{review.comment}</p>
      )}

      {(review.quality_rating || review.delivery_rating || review.service_rating) && (
        <div className="flex gap-4 text-xs text-sage mb-3">
          {review.quality_rating && <span>Qualita: {review.quality_rating}/5</span>}
          {review.delivery_rating && <span>Consegna: {review.delivery_rating}/5</span>}
          {review.service_rating && <span>Servizio: {review.service_rating}/5</span>}
        </div>
      )}

      {review.supplier_reply && (
        <div className="bg-forest-light/30 rounded-xl p-3 mt-3">
          <p className="text-xs font-semibold text-forest-dark mb-1">Risposta del fornitore</p>
          <p className="text-sm text-charcoal">{review.supplier_reply}</p>
        </div>
      )}
    </div>
  );
}
