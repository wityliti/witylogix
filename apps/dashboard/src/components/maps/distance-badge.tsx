"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface DistanceBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  distance: number;
  unit?: "km" | "mi";
  showAwaySuffix?: boolean;
  compact?: boolean;
  variant?: "default" | "subtle";
}

const DistanceBadge = forwardRef<HTMLSpanElement, DistanceBadgeProps>(
  (
    {
      distance,
      unit = "km",
      showAwaySuffix = false,
      compact = false,
      variant = "default",
      className,
      ...props
    },
    ref,
  ) => {
    const formatDistance = (value: number, u: "km" | "mi"): string => {
      if (u === "km") {
        return value >= 1
          ? `${value.toFixed(1)} km`
          : `${Math.round(value * 1000)} m`;
      }
      return `${value.toFixed(1)} mi`;
    };

    const displayDistance = formatDistance(distance, unit);
    const displayText = showAwaySuffix
      ? `${displayDistance} away`
      : displayDistance;

    const variantClasses = {
      default:
        "text-wl-text-secondary bg-wl-bg-overlay border border-wl-border-subtle",
      subtle: "text-wl-text-tertiary bg-transparent border border-transparent",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5",
          "px-2.5 py-1 rounded-full",
          "text-xs font-mono font-medium",
          "transition-all duration-base",
          compact && "px-2 py-0.5 text-xs",
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        <svg
          className="w-3 h-3 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="1" />
          <path d="M12 3v6m0 6v6" />
          <path d="M8 8l2.828 2.828M13.172 13.172L16 16" />
          <path d="M16 8l-2.828 2.828M10.828 13.172L8 16" />
        </svg>
        <span className={compact ? "hidden sm:inline" : ""}>{displayText}</span>
        <span className={cn(compact && "inline sm:hidden")}>
          {displayDistance}
        </span>
      </span>
    );
  },
);

DistanceBadge.displayName = "DistanceBadge";

export { DistanceBadge };
