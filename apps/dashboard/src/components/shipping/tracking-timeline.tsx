"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TrackingEvent } from "@/hooks/use-shipment-tracking";

interface TrackingTimelineProps {
  events: TrackingEvent[];
  currentStatus: string;
}

const statusIconMap: Record<string, string> = {
  picked_up: "📦",
  in_transit: "🚚",
  out_for_delivery: "📮",
  delivered: "✓",
  exception: "⚠️",
  returned: "🔄",
};

const statusColorMap: Record<string, string> = {
  picked_up: "bg-wl-info-500",
  in_transit: "bg-wl-primary-500",
  out_for_delivery: "bg-wl-warning-500",
  delivered: "bg-wl-success-500",
  exception: "bg-wl-danger-500",
  returned: "bg-wl-warning-500",
};

export function TrackingTimeline({
  events,
  currentStatus,
}: TrackingTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleEvents = useMemo(() => {
    return expanded ? events : events.slice(0, 3);
  }, [events, expanded]);

  const hiddenCount = events.length - 3;

  return (
    <div className="space-y-4">
      <div className="space-y-0">
        {visibleEvents.map((event, index) => {
          const isLast = index === visibleEvents.length - 1;
          const isCurrent = event.status === currentStatus;

          return (
            <div key={event.id} className="flex gap-4 relative">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                {/* Event circle */}
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[8px]",
                    isCurrent
                      ? cn(
                          statusColorMap[event.status] || "bg-wl-primary-500",
                          "border-wl-bg-surface animate-pulse",
                        )
                      : cn(
                          statusColorMap[event.status] || "bg-wl-primary-500",
                          "border-wl-bg-elevated opacity-60",
                        ),
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {statusIconMap[event.status] && (
                    <span className="text-[10px]">
                      {statusIconMap[event.status]}
                    </span>
                  )}
                </div>

                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 h-12 my-1",
                      isCurrent ||
                        visibleEvents[index + 1]?.status === currentStatus
                        ? "bg-wl-primary-500/40"
                        : "bg-wl-border-subtle",
                    )}
                  />
                )}
              </div>

              {/* Event content */}
              <div className="flex-1 pt-0.5 pb-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCurrent
                        ? "text-wl-text-primary font-semibold"
                        : "text-wl-text-secondary",
                    )}
                  >
                    {event.description}
                  </p>
                  <span className="text-xs text-wl-text-tertiary whitespace-nowrap flex-shrink-0">
                    {new Date(event.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  {event.location}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more button */}
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className={cn(
            "text-xs font-medium text-wl-primary-400 hover:text-wl-primary-300",
            "transition-colors px-4 py-2",
            "border border-dashed border-wl-border-default rounded",
            "bg-transparent hover:bg-wl-bg-overlay",
          )}
        >
          Show {hiddenCount} more events
        </button>
      )}

      {/* Show less button */}
      {expanded && events.length > 3 && (
        <button
          onClick={() => setExpanded(false)}
          className={cn(
            "text-xs font-medium text-wl-text-tertiary hover:text-wl-text-secondary",
            "transition-colors px-4 py-2",
            "border border-dashed border-wl-border-default rounded",
            "bg-transparent hover:bg-wl-bg-overlay",
          )}
        >
          Show less
        </button>
      )}
    </div>
  );
}
