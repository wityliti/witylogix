"use client";

import { ReactNode } from "react";
import { cn } from "../utils/cn";

export type AvailabilityStatus = "available" | "limited" | "full" | "unavailable";

export interface CalendarDayProps {
  date: number;
  status?: AvailabilityStatus;
  slotsLeft?: number;
  isSelected?: boolean;
  isToday?: boolean;
  isBlackedOut?: boolean;
  onClick?: () => void;
  className?: string;
}

const statusColors: Record<AvailabilityStatus, string> = {
  available: "bg-wl-success-500",
  limited: "bg-wl-warning-500",
  full: "bg-wl-neutral-400",
  unavailable: "bg-wl-neutral-300",
};

const getAvailabilityText = (status: AvailabilityStatus, slotsLeft?: number): string => {
  if (status === "available" && slotsLeft) return `${slotsLeft} slots`;
  if (status === "limited" && slotsLeft) return `${slotsLeft} left`;
  if (status === "full") return "Full";
  return "Unavailable";
};

export function CalendarDay({
  date,
  status = "available",
  slotsLeft,
  isSelected = false,
  isToday = false,
  isBlackedOut = false,
  onClick,
  className,
}: CalendarDayProps) {
  return (
    <button
      onClick={onClick}
      disabled={isBlackedOut || status === "unavailable"}
      className={cn(
        "relative p-2 rounded-lg transition-all duration-200",
        "min-h-20 flex flex-col items-center justify-between",
        "bg-wl-bg-secondary border border-wl-border-default",
        "hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
        isSelected && "ring-2 ring-wl-primary-500 border-wl-primary-500",
        isToday && "border-2 border-wl-primary-500",
        className
      )}
      aria-label={`${isToday ? "Today, " : ""}${date}${slotsLeft ? `, ${slotsLeft} slots` : ""}`}
    >
      {/* Date number */}
      <span
        className={cn(
          "font-bold text-base",
          isBlackedOut && "line-through opacity-50",
          "text-wl-text-primary"
        )}
      >
        {date}
      </span>

      {/* Availability indicator dot */}
      {!isBlackedOut && (
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            statusColors[status],
            status === "available" && "shadow-sm"
          )}
          aria-label={`${status}`}
        />
      )}

      {/* Slots left micro-text */}
      {slotsLeft !== undefined && !isBlackedOut && (
        <span className="text-[10px] text-wl-text-tertiary font-medium">
          {getAvailabilityText(status, slotsLeft)}
        </span>
      )}

      {/* Today indicator */}
      {isToday && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-wl-danger-500 rounded-full animate-pulse" />
      )}

      {/* Blackout indicator */}
      {isBlackedOut && (
        <span className="absolute inset-0 rounded-lg bg-wl-danger-500 opacity-10" />
      )}
    </button>
  );
}
