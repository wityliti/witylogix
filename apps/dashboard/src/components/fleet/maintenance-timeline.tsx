"use client";

import { forwardRef, useState, useRef, useEffect, type HTMLAttributes } from "react";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MaintenanceEvent {
  id: string;
  date: string;
  type: "preventive" | "reactive" | "predictive" | "recall";
  description: string;
  cost: number;
  vendor: string;
  duration: number; // minutes
}

interface MaintenanceTimelineProps extends HTMLAttributes<HTMLDivElement> {
  events: MaintenanceEvent[];
  vehicleId?: string;
  vehicleName?: string;
  onEventClick?: (event: MaintenanceEvent) => void;
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  onTypeFilter?: (types: string[]) => void;
}

interface TooltipState {
  visible: boolean;
  event: MaintenanceEvent | null;
  x: number;
  y: number;
}

const typeColors = {
  preventive: {
    bg: "bg-wl-primary-500/20",
    text: "text-wl-primary-400",
    badge: "primary" as const,
    label: "Preventive",
  },
  reactive: {
    bg: "bg-wl-danger-500/20",
    text: "text-wl-danger-400",
    badge: "danger" as const,
    label: "Reactive",
  },
  predictive: {
    bg: "bg-wl-info-500/20",
    text: "text-wl-info-400",
    badge: "info" as const,
    label: "Predictive",
  },
  recall: {
    bg: "bg-wl-warning-500/20",
    text: "text-wl-warning-400",
    badge: "warning" as const,
    label: "Recall",
  },
};

const MaintenanceTimeline = forwardRef<
  HTMLDivElement,
  MaintenanceTimelineProps
>(
  (
    {
      events,
      vehicleId,
      vehicleName,
      onEventClick,
      onDateRangeChange,
      onTypeFilter,
      className,
      ...props
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<TooltipState>({
      visible: false,
      event: null,
      x: 0,
      y: 0,
    });
    const [selectedTypes, setSelectedTypes] = useState<string[]>([
      "preventive",
      "reactive",
      "predictive",
      "recall",
    ]);
    const [scrollOffset, setScrollOffset] = useState(0);

    // Filter events by type
    const filteredEvents = events.filter((e) => selectedTypes.includes(e.type));

    // Sort events by date
    const sortedEvents = [...filteredEvents].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (sortedEvents.length === 0) {
      return (
        <Card ref={ref} className={cn("p-6", className)} {...props}>
          <p className="text-center text-wl-text-secondary text-sm">
            No maintenance events found
          </p>
        </Card>
      );
    }

    // Find date range
    const minDate = new Date(sortedEvents[0].date);
    const maxDate = new Date(sortedEvents[sortedEvents.length - 1].date);
    const dateRange = maxDate.getTime() - minDate.getTime();
    const SVG_WIDTH = Math.max(400, sortedEvents.length * 120);
    const PADDING = 40;
    const CHART_WIDTH = SVG_WIDTH - PADDING * 2;

    // Calculate x position for each event
    const getXPos = (date: string): number => {
      if (dateRange === 0) return PADDING + CHART_WIDTH / 2;
      const eventDate = new Date(date).getTime();
      const progress = (eventDate - minDate.getTime()) / dateRange;
      return PADDING + progress * CHART_WIDTH;
    };

    const handleTypeToggle = (type: string) => {
      const newTypes = selectedTypes.includes(type)
        ? selectedTypes.filter((t) => t !== type)
        : [...selectedTypes, type];
      setSelectedTypes(newTypes);
      onTypeFilter?.(newTypes);
    };

    const handleEventHover = (
      event: MaintenanceEvent,
      clientX: number,
      clientY: number
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          visible: true,
          event,
          x: clientX - rect.left,
          y: clientY - rect.top,
        });
      }
    };

    const handleScroll = (direction: "left" | "right") => {
      const container = containerRef.current;
      if (!container) return;
      const scrollAmount = 200;
      const newOffset = direction === "left"
        ? Math.max(scrollOffset - scrollAmount, 0)
        : Math.min(scrollOffset + scrollAmount, Math.max(0, SVG_WIDTH - (container.clientWidth - 80)));
      setScrollOffset(newOffset);
    };

    return (
      <Card ref={ref} className={cn("p-4 space-y-4", className)} {...props}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-wl-text-primary">
              Maintenance Timeline
            </h3>
            {vehicleName && (
              <p className="text-xs text-wl-text-secondary">{vehicleName}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-wl-text-secondary" />
          </div>
        </div>

        {/* Type Filter Badges */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeColors).map(([type, config]) => (
            <button
              key={type}
              onClick={() => handleTypeToggle(type)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                selectedTypes.includes(type)
                  ? cn(config.bg, config.text, "ring-1 ring-offset-0")
                  : "bg-wl-bg-surface text-wl-text-secondary opacity-50"
              )}
            >
              {config.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div
          ref={containerRef}
          className="relative overflow-hidden bg-wl-bg-surface rounded-lg p-4"
        >
          {/* Left scroll button */}
          {scrollOffset > 0 && (
            <button
              onClick={() => handleScroll("left")}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-wl-bg-elevated rounded-md hover:bg-wl-bg-elevated/80 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Right scroll button */}
          {scrollOffset < Math.max(0, SVG_WIDTH - (containerRef.current?.clientWidth ?? 0)) && (
            <button
              onClick={() => handleScroll("right")}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-wl-bg-elevated rounded-md hover:bg-wl-bg-elevated/80 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <div className="overflow-x-auto scrollbar-hide">
            <svg
              ref={svgRef}
              width={SVG_WIDTH}
              height={180}
              className="mx-auto"
              style={{ transform: `translateX(-${scrollOffset}px)` }}
            >
              {/* Baseline */}
              <line
                x1={PADDING}
                y1={90}
                x2={SVG_WIDTH - PADDING}
                y2={90}
                stroke="var(--wl-border-subtle)"
                strokeWidth={1}
              />

              {/* Date markers */}
              <text
                x={PADDING}
                y={120}
                textAnchor="middle"
                className="text-xs fill-wl-text-secondary"
              >
                {minDate.toLocaleDateString()}
              </text>
              <text
                x={SVG_WIDTH - PADDING}
                y={120}
                textAnchor="middle"
                className="text-xs fill-wl-text-secondary"
              >
                {maxDate.toLocaleDateString()}
              </text>

              {/* Events */}
              {sortedEvents.map((event) => {
                const xPos = getXPos(event.date);
                const typeConfig = typeColors[event.type];

                return (
                  <g key={event.id}>
                    {/* Line to baseline */}
                    <line
                      x1={xPos}
                      y1={90}
                      x2={xPos}
                      y2={50}
                      stroke={typeConfig.text.replace("text-", "var(--wl-").replace(/[^a-z0-9-]/g, "") + ")"}
                      strokeWidth={2}
                      opacity={0.4}
                    />

                    {/* Event circle */}
                    <circle
                      cx={xPos}
                      cy={50}
                      r={8}
                      fill={typeConfig.text.replace("text-", "var(--wl-").replace(/[^a-z0-9-]/g, "") + ")"}
                      opacity={0.8}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) =>
                        handleEventHover(
                          event,
                          e.clientX,
                          e.clientY
                        )
                      }
                      onMouseLeave={() =>
                        setTooltip({ ...tooltip, visible: false })
                      }
                      onClick={() => onEventClick?.(event)}
                    />

                    {/* Outer ring on hover */}
                    <circle
                      cx={xPos}
                      cy={50}
                      r={12}
                      fill="none"
                      stroke={typeConfig.text.replace("text-", "var(--wl-").replace(/[^a-z0-9-]/g, "") + ")"}
                      strokeWidth={1}
                      opacity={0.3}
                      style={{ pointerEvents: "none" }}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip.visible && tooltip.event && (
          <div
            className="fixed bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-3 shadow-lg text-sm z-50 max-w-xs"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y - 50,
              pointerEvents: "none",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={typeColors[tooltip.event.type].badge} className="text-xs">
                {typeColors[tooltip.event.type].label}
              </Badge>
              <span className="text-wl-text-secondary">
                {new Date(tooltip.event.date).toLocaleDateString()}
              </span>
            </div>
            <p className="font-semibold text-wl-text-primary mb-1">
              {tooltip.event.description}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-wl-text-secondary">
              <p>Cost: ${tooltip.event.cost}</p>
              <p>Duration: {tooltip.event.duration}m</p>
              <p className="col-span-2">Vendor: {tooltip.event.vendor}</p>
            </div>
          </div>
        )}

        {/* Event List */}
        {sortedEvents.length > 0 && (
          <div className="pt-2 border-t border-wl-border-subtle">
            <p className="text-xs font-semibold text-wl-text-secondary mb-2">
              Recent Events ({sortedEvents.length})
            </p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {sortedEvents.slice(-3).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-wl-bg-surface transition-colors cursor-pointer"
                  onClick={() => onEventClick?.(event)}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: typeColors[event.type].text.replace(
                        "text-",
                        "var(--wl-"
                      ).replace(/[^a-z0-9-]/g, "") + ")",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-wl-text-primary truncate">
                      {event.description}
                    </p>
                    <p className="text-wl-text-secondary">
                      {new Date(event.date).toLocaleDateString()} • ${event.cost}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  }
);

MaintenanceTimeline.displayName = "MaintenanceTimeline";

export { MaintenanceTimeline };
export type { MaintenanceTimelineProps, MaintenanceEvent };
