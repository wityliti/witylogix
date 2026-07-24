"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ETACountdown } from "./eta-countdown";

type RouteStopStatus = "pending" | "arrived" | "completed" | "skipped";

interface TimeWindow {
  start: string;
  end: string;
}

interface RouteStop {
  id: string;
  sequenceNumber: number;
  address: string;
  eta?: string;
  timeWindow?: TimeWindow;
  status: RouteStopStatus;
  notes?: string;
  contactName?: string;
  contactPhone?: string;
  instructions?: string;
}

interface RouteTimelineProps {
  stops: RouteStop[];
  currentStopIndex?: number;
  expandedStopId?: string;
  onStopClick?: (stop: RouteStop) => void;
  onExpandStop?: (stopId: string) => void;
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<
  RouteStopStatus,
  { label: string; color: string; lineColor: string }
> = {
  pending: {
    label: "Pending",
    color: "bg-wl-bg-overlay text-wl-text-secondary border-wl-border-subtle",
    lineColor: "bg-wl-border-subtle",
  },
  arrived: {
    label: "Arrived",
    color: "bg-wl-warning-bg text-wl-warning-400 border-wl-warning-500/30",
    lineColor: "bg-wl-warning-400",
  },
  completed: {
    label: "Completed",
    color: "bg-wl-success-bg text-wl-success-400 border-wl-success-500/30",
    lineColor: "bg-wl-success-400",
  },
  skipped: {
    label: "Skipped",
    color: "bg-wl-danger-bg text-wl-danger-400 border-wl-danger-500/30",
    lineColor: "bg-wl-danger-400",
  },
};

export const RouteTimeline = ({
  stops,
  currentStopIndex = -1,
  expandedStopId,
  onStopClick,
  onExpandStop,
  compact = false,
  className,
}: RouteTimelineProps) => {
  const [expandedLocal, setExpandedLocal] = useState<string | null>(
    expandedStopId || null,
  );
  const expandedId =
    expandedStopId !== undefined ? expandedStopId : expandedLocal;

  const handleToggleExpand = (stopId: string) => {
    const newId = expandedId === stopId ? null : stopId;
    setExpandedLocal(newId);
    onExpandStop?.(newId || "");
  };

  const isStopLate = (stop: RouteStop): boolean => {
    if (!stop.timeWindow || !stop.eta) return false;
    const eta = new Date(stop.eta);
    const windowEnd = new Date(stop.timeWindow.end);
    return (
      eta > windowEnd &&
      (stop.status === "pending" || stop.status === "arrived")
    );
  };

  return (
    <div className={cn("space-y-0", compact && "space-y-0.5", className)}>
      {stops.map((stop, index) => {
        const status = statusConfig[stop.status];
        const isExpanded = expandedId === stop.id;
        const isCurrentStop = index === currentStopIndex;
        const isLate = isStopLate(stop);
        const nextStop = stops[index + 1];
        const isLastStop = index === stops.length - 1;

        return (
          <div key={stop.id} className="relative">
            {/* Timeline Container */}
            <div
              className={cn(
                "flex gap-4",
                "group transition-all duration-200",
                !compact && "pb-2",
              )}
            >
              {/* Left Side: Timeline Marker */}
              <div className="relative flex flex-col items-center pt-1.5">
                {/* Current Position Indicator */}
                {isCurrentStop && (
                  <div
                    className={cn(
                      "absolute -left-8 top-1.5 w-5 h-5 rounded-full",
                      "bg-wl-primary-500 animate-pulse border-2 border-wl-bg-elevated",
                      "shadow-lg",
                    )}
                    aria-label="Current position"
                  />
                )}

                {/* Stop Number Circle */}
                <div
                  className={cn(
                    "relative z-10 w-8 h-8 rounded-full",
                    "flex items-center justify-center",
                    "text-xs font-semibold",
                    "border-2",
                    "transition-all duration-200",
                    status.color,
                    isCurrentStop && "ring-2 ring-wl-primary-500 ring-offset-2",
                  )}
                >
                  {stop.status === "completed" ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : stop.status === "skipped" ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                    </svg>
                  ) : (
                    stop.sequenceNumber
                  )}
                </div>

                {/* Connecting Line */}
                {!isLastStop && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 my-2",
                      status.lineColor,
                      stop.status === "completed" ? "bg-solid" : "bg-dashed",
                    )}
                    style={{
                      backgroundImage:
                        stop.status === "completed"
                          ? "none"
                          : "repeating-linear-gradient(180deg, currentColor 0px, currentColor 4px, transparent 4px, transparent 8px)",
                      minHeight: compact ? "24px" : "48px",
                    }}
                  />
                )}
              </div>

              {/* Right Side: Stop Details */}
              <div className="flex-1 pt-1 pb-2">
                {/* Header */}
                <button
                  onClick={() => {
                    onStopClick?.(stop);
                    if (!compact) {
                      handleToggleExpand(stop.id);
                    }
                  }}
                  className={cn(
                    "w-full text-left",
                    "hover:bg-wl-bg-overlay/50 rounded px-2 py-1.5",
                    "transition-colors duration-200",
                    !compact && "cursor-pointer",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-wl-text-primary truncate">
                        {stop.address}
                      </p>

                      {stop.timeWindow && stop.eta && !compact && (
                        <p className="text-xs text-wl-text-tertiary mt-1">
                          Time Window:{" "}
                          {new Date(stop.timeWindow.start).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}{" "}
                          -{" "}
                          {new Date(stop.timeWindow.end).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isLate && (
                        <div className="px-2 py-0.5 bg-wl-danger-bg text-wl-danger-400 rounded text-xs font-semibold">
                          Late
                        </div>
                      )}

                      {stop.eta && (
                        <ETACountdown
                          estimatedTime={stop.eta}
                          timeWindowEnd={stop.timeWindow?.end}
                          isLate={isLate}
                          compact={true}
                        />
                      )}

                      {!compact && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExpand(stop.id);
                          }}
                          className={cn(
                            "p-0.5 text-wl-text-tertiary",
                            "hover:text-wl-text-primary transition-colors",
                          )}
                        >
                          <svg
                            className={cn(
                              "w-4 h-4 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && !compact && (
                  <div className="mt-2 ml-2 pt-2 border-l-2 border-wl-border-subtle pl-3 space-y-2">
                    {stop.contactName && (
                      <div className="text-xs">
                        <span className="text-wl-text-tertiary">Contact:</span>
                        <p className="text-wl-text-secondary font-medium">
                          {stop.contactName}
                        </p>
                      </div>
                    )}

                    {stop.contactPhone && (
                      <div className="text-xs">
                        <span className="text-wl-text-tertiary">Phone:</span>
                        <p className="text-wl-text-secondary font-mono">
                          <a
                            href={`tel:${stop.contactPhone}`}
                            className="text-wl-primary-400 hover:text-wl-primary-300"
                          >
                            {stop.contactPhone}
                          </a>
                        </p>
                      </div>
                    )}

                    {stop.instructions && (
                      <div className="text-xs">
                        <span className="text-wl-text-tertiary">
                          Instructions:
                        </span>
                        <p className="text-wl-text-secondary mt-1 leading-relaxed">
                          {stop.instructions}
                        </p>
                      </div>
                    )}

                    {stop.notes && (
                      <div className="text-xs">
                        <span className="text-wl-text-tertiary">Notes:</span>
                        <p className="text-wl-text-secondary mt-1 leading-relaxed">
                          {stop.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

RouteTimeline.displayName = "RouteTimeline";
export type { RouteStop };
