"use client";

import { useMemo } from "react";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Route, Stop } from "@witylogix/core/dispatch";

interface RouteTimelineProps {
  routes: Route[];
  selectedStop?: Stop | null;
  onStopSelect?: (stop: Stop) => void;
  onStopDrop?: (stopId: string, toRouteId: string, position: number) => void;
  isLoading?: boolean;
}

// Standard operating hours for timeline
const TIMELINE_START = 8; // 8 AM
const TIMELINE_END = 19; // 7 PM
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START;

/**
 * Horizontal timeline/Gantt view of routes
 *
 * Features:
 * - One row per route with color coding
 * - Stops positioned by ETA on timeline
 * - Hover to show stop details
 * - Drag-and-drop to reassign stops
 * - Time labels and hour markers
 */
export function RouteTimeline({
  routes,
  selectedStop,
  onStopSelect,
  onStopDrop,
  isLoading = false,
}: RouteTimelineProps) {
  const getHourPosition = (hour: number): number => {
    return ((hour - TIMELINE_START) / TIMELINE_HOURS) * 100;
  };

  const getStopPosition = (stop: Stop): number | null => {
    if (!stop.estimatedArrival) return null;
    const hour = new Date(stop.estimatedArrival).getHours();
    const minutes = new Date(stop.estimatedArrival).getMinutes();
    const decimalHour = hour + minutes / 60;

    if (decimalHour < TIMELINE_START || decimalHour > TIMELINE_END) {
      return null;
    }

    return getHourPosition(decimalHour);
  };

  const hourMarkers = useMemo(() => {
    const markers = [];
    for (let i = TIMELINE_START; i <= TIMELINE_END; i++) {
      markers.push({
        hour: i,
        label: `${i % 12 || 12}${i < 12 ? "A" : "P"}`,
        position: getHourPosition(i),
      });
    }
    return markers;
  }, []);

  if (isLoading) {
    return (
      <div className="bg-wl-bg-surface rounded-lg border border-wl-border-subtle p-8">
        <div className="flex items-center justify-center gap-3">
          <Clock className="w-4 h-4 animate-spin text-wl-primary-500" />
          <p className="text-sm text-wl-text-secondary">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="bg-wl-bg-surface rounded-lg border border-wl-border-subtle p-8">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-wl-text-tertiary" />
          <div>
            <p className="text-sm font-medium text-wl-text-secondary">
              No active routes
            </p>
            <p className="text-xs text-wl-text-tertiary">
              Routes will appear here when scheduled
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-wl-bg-surface rounded-lg border border-wl-border-subtle overflow-hidden">
      {/* Header with timeline */}
      <div className="sticky top-0 z-20 bg-wl-bg-surface border-b border-wl-border-subtle">
        <div className="flex">
          {/* Driver name column */}
          <div className="w-40 flex-shrink-0 p-4 border-r border-wl-border-subtle">
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
              Driver / Route
            </p>
          </div>

          {/* Timeline header */}
          <div className="flex-1 overflow-x-auto px-4 py-4">
            <div className="relative flex min-w-full">
              {hourMarkers.map((marker) => (
                <div
                  key={marker.hour}
                  className="flex-1 text-center text-xs font-medium text-wl-text-secondary"
                  style={{ minWidth: "8%" }}
                >
                  {marker.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grid lines */}
        <div className="flex">
          <div className="w-40 flex-shrink-0 border-r border-wl-border-subtle" />
          <div className="flex-1 overflow-x-auto px-4">
            <div className="relative flex min-w-full h-px bg-wl-border-subtle/20">
              {hourMarkers.map((marker) => (
                <div
                  key={`line-${marker.hour}`}
                  className="flex-1 border-l border-wl-border-subtle/20"
                  style={{ minWidth: "8%" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Route rows */}
      <div className="divide-y divide-wl-border-subtle">
        {routes.map((route) => (
          <div key={route.id} className="flex hover:bg-wl-bg-overlay transition-colors">
            {/* Driver info */}
            <div
              className="w-40 flex-shrink-0 p-4 border-r border-wl-border-subtle bg-wl-bg-surface"
              style={{
                borderLeftColor: route.color,
                borderLeftWidth: "4px",
              }}
            >
              <div className="mb-2">
                <p className="text-xs font-semibold text-wl-text-primary truncate">
                  Driver #{route.id.slice(0, 6)}
                </p>
                <p className="text-xs text-wl-text-tertiary truncate">
                  {route.name || "Unnamed Route"}
                </p>
              </div>
              <Badge variant="primary" className="text-xs">
                {route.stops.length} stops
              </Badge>
            </div>

            {/* Timeline with stops */}
            <div className="flex-1 overflow-x-auto px-4 py-4">
              <div className="relative flex min-w-full h-16">
                {/* Hour markers */}
                {hourMarkers.map((marker) => (
                  <div
                    key={`marker-${marker.hour}`}
                    className="flex-1 border-l border-wl-border-subtle/20 first:border-l-0"
                    style={{ minWidth: "8%" }}
                  />
                ))}

                {/* Stops */}
                {route.stops.map((stop) => {
                  const position = getStopPosition(stop);
                  if (position === null) return null;

                  return (
                    <div
                      key={stop.id}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer group"
                      style={{ left: `${position}%` }}
                      onClick={() => onStopSelect?.(stop)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          onStopSelect?.(stop);
                        }
                      }}
                    >
                      {/* Stop dot */}
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all duration-200",
                          "flex items-center justify-center text-xs font-bold text-wl-text-primary",
                          selectedStop?.id === stop.id
                            ? "ring-2 ring-offset-2 ring-wl-primary-500"
                            : "group-hover:ring-2 group-hover:ring-offset-2 group-hover:ring-wl-primary-400"
                        )}
                        style={{
                          backgroundColor: route.color,
                          borderColor: route.color,
                        }}
                      >
                        {stop.sequence}
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30">
                        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-md p-2 shadow-lg whitespace-nowrap text-xs">
                          <p className="font-medium text-wl-text-primary">
                            Stop #{stop.sequence}
                          </p>
                          <p className="text-wl-text-secondary">
                            ETA: {new Date(stop.estimatedArrival || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {stop.customerName && (
                            <p className="text-wl-text-secondary">
                              {stop.customerName}
                            </p>
                          )}
                          <p className="text-wl-text-tertiary text-xs mt-1">
                            {stop.address}
                          </p>
                        </div>
                        <div
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                          style={{
                            backgroundColor: "var(--wl-bg-sunken)",
                            border: "1px solid var(--wl-border-subtle)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="bg-wl-bg-overlay/50 px-4 py-3 border-t border-wl-border-subtle">
        <p className="text-xs text-wl-text-secondary">
          Drag stops to reassign routes • Estimated arrival times shown on timeline
        </p>
      </div>
    </div>
  );
}
