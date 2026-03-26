"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

const sizeMap = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" };

export function RatingStars({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onChange,
}: RatingStarsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxRating }).map((_, i) => (
        <button
          key={i}
          type={interactive ? "button" : undefined}
          disabled={!interactive}
          onClick={() => interactive && onChange?.(i + 1)}
          className={cn(
            interactive && "cursor-pointer hover:scale-110 transition-transform",
            !interactive && "cursor-default"
          )}
        >
          <Star
            className={cn(
              sizeMap[size],
              i < rating
                ? "fill-terracotta text-terracotta"
                : "fill-none text-sage-muted"
            )}
          />
        </button>
      ))}
    </div>
  );
}
