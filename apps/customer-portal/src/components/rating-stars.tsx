"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RatingStars({
  value,
  onChange,
  readonly = false,
  size = "md",
  className,
}: RatingStarsProps) {
  const sizeMap = { sm: 14, md: 22, lg: 30 };
  const iconSize = sizeMap[size];

  return (
    <div
      className={cn("flex gap-0.5", className)}
      role="group"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          className={cn(
            "transition-all duration-fast p-0.5",
            !readonly && "cursor-pointer hover:scale-110 active:scale-95",
          )}
          aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
        >
          <Star
            size={iconSize}
            className={cn(
              "transition-colors duration-fast",
              star <= value
                ? "fill-wl-warning-500 text-wl-warning-500"
                : "text-wl-neutral-600",
            )}
          />
        </button>
      ))}
    </div>
  );
}
