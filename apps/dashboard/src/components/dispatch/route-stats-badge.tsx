"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RouteStatsBadgeProps {
  stops: number;
  distance: number;
  estimatedTime: string;
  unit?: "km" | "mi";
  className?: string;
  icon?: boolean;
}

const formatTime = (timeStr: string): string => {
  // Handle formats like "6h 15m", "45m", "2d 3h"
  return timeStr;
};

export function RouteStatsBadge({
  stops,
  distance,
  estimatedTime,
  unit = "km",
  className,
  icon = true,
}: RouteStatsBadgeProps) {
  const distanceText = `${distance}${unit}`;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3",
        "px-4 py-2.5 rounded-full",
        "bg-wl-bg-elevated border border-wl-border-subtle",
        "text-sm font-medium text-wl-text-primary",
        className
      )}
    >
      {/* Stops */}
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className="text-wl-primary-500" title="Number of stops">
            📍
          </span>
        )}
        <span className="font-semibold">{stops}</span>
        <span className="text-wl-text-tertiary text-xs">stops</span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-wl-border-subtle opacity-50" />

      {/* Distance */}
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className="text-wl-warning-500" title="Distance">
            📏
          </span>
        )}
        <span className="font-semibold">{distanceText}</span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-wl-border-subtle opacity-50" />

      {/* Estimated time */}
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className="text-wl-success-500" title="Estimated time">
            ⏱️
          </span>
        )}
        <span className="font-semibold">{formatTime(estimatedTime)}</span>
      </div>
    </div>
  );
}
