"use client";

import { ReactNode } from "react";
import { cn } from "../utils/cn";
import type { TimeSlot } from "../types";

export type SlotState = "available" | "few-left" | "full" | "selected";

export interface TimeSlotCardProps {
  timeSlot: TimeSlot;
  state?: SlotState;
  cutoffTime?: string;
  price?: number;
  showCutoffWarning?: boolean;
  onClick?: () => void;
  className?: string;
}

const stateStyles: Record<SlotState, string> = {
  available:
    "bg-wl-bg-secondary border-wl-border-default hover:border-wl-primary-500 hover:shadow-sm",
  "few-left":
    "bg-wl-warning-50 border-wl-warning-300 dark:bg-wl-warning-900 dark:border-wl-warning-700",
  full: "bg-wl-neutral-50 border-wl-neutral-300 dark:bg-wl-neutral-900 dark:border-wl-neutral-700 opacity-60 cursor-not-allowed",
  selected:
    "bg-wl-primary-100 border-wl-primary-500 dark:bg-wl-primary-900 dark:border-wl-primary-400 ring-2 ring-wl-primary-500",
};

const getCapacityPercent = (slot: TimeSlot): number => {
  const total = slot.capacity.total;
  const available = slot.capacity.available;
  return total > 0 ? ((total - available) / total) * 100 : 0;
};

const formatTimeRange = (startTime: Date, endTime: Date): string => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

export function TimeSlotCard({
  timeSlot,
  state = "available",
  cutoffTime,
  price,
  showCutoffWarning = false,
  onClick,
  className,
}: TimeSlotCardProps) {
  const capacityPercent = getCapacityPercent(timeSlot);
  const available = timeSlot.capacity.available;
  const total = timeSlot.capacity.total;

  return (
    <button
      onClick={onClick}
      disabled={state === "full"}
      className={cn(
        "relative p-4 rounded-lg border-2 transition-all duration-200",
        "text-left w-full",
        stateStyles[state],
        className,
      )}
      aria-pressed={state === "selected"}
      aria-disabled={state === "full"}
      aria-label={`${formatTimeRange(timeSlot.startTime, timeSlot.endTime)}, ${available} of ${total} slots available`}
    >
      <div className="space-y-3">
        {/* Time range */}
        <div className="font-semibold text-wl-text-primary">
          {formatTimeRange(timeSlot.startTime, timeSlot.endTime)}
        </div>

        {/* Capacity bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2 bg-wl-bg-tertiary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                state === "full"
                  ? "bg-wl-danger-500"
                  : state === "few-left"
                    ? "bg-wl-warning-500"
                    : "bg-wl-success-500",
              )}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
          <div className="text-xs text-wl-text-tertiary">
            {available} of {total} slots
          </div>
        </div>

        {/* Price and state info */}
        <div className="flex items-center justify-between gap-2">
          {price !== undefined && (
            <div className="text-sm font-semibold text-wl-text-primary">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(price)}
            </div>
          )}

          {/* State badge */}
          {state === "few-left" && (
            <span className="text-xs font-medium px-2 py-1 rounded bg-wl-warning-100 text-wl-warning-700 dark:bg-wl-warning-900 dark:text-wl-warning-200">
              {available} left
            </span>
          )}
          {state === "full" && (
            <span className="text-xs font-medium px-2 py-1 rounded bg-wl-neutral-100 text-wl-neutral-700 dark:bg-wl-neutral-900 dark:text-wl-neutral-200">
              Full
            </span>
          )}
          {state === "selected" && (
            <span className="text-xs font-medium px-2 py-1 rounded bg-wl-primary-200 text-wl-primary-700 dark:bg-wl-primary-800 dark:text-wl-primary-200">
              Selected
            </span>
          )}
        </div>

        {/* Cutoff warning */}
        {showCutoffWarning && cutoffTime && (
          <div className="text-xs text-wl-danger-600 dark:text-wl-danger-400 px-2 py-1 bg-wl-danger-50 dark:bg-wl-danger-900 rounded border border-wl-danger-200 dark:border-wl-danger-700">
            Order by {cutoffTime}
          </div>
        )}
      </div>

      {/* Selection indicator */}
      {state === "selected" && (
        <div className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-wl-primary-500 text-white">
          <span className="text-xs font-bold">✓</span>
        </div>
      )}
    </button>
  );
}
