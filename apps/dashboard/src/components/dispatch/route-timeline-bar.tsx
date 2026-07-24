"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

export interface DeliveryStop {
  id: string;
  sequenceNumber: number;
  startTime: Date;
  endTime: Date;
  customerName: string;
  address: string;
  status: "pending" | "in-transit" | "delivered";
}

export interface RouteTimelineBarProps {
  stops: DeliveryStop[];
  routeColor: string;
  startHour?: number;
  endHour?: number;
  className?: string;
}

const getTimePosition = (
  date: Date,
  startHour: number,
  endHour: number,
): number => {
  const hours = endHour - startHour;
  const totalMinutes = hours * 60;
  const dateMinutes = date.getHours() * 60 + date.getMinutes() - startHour * 60;
  return Math.max(0, Math.min(100, (dateMinutes / totalMinutes) * 100));
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export function RouteTimelineBar({
  stops,
  routeColor,
  startHour = 8,
  endHour = 19,
  className,
}: RouteTimelineBarProps) {
  const [hoveredStop, setHoveredStop] = useState<DeliveryStop | null>(null);

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  );
  const currentTime = new Date();
  const currentPosition = getTimePosition(currentTime, startHour, endHour);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Timeline header with hour markers */}
      <div className="relative h-8">
        <div className="absolute inset-0 flex items-end">
          {hours.map((hour) => {
            const position = ((hour - startHour) / (endHour - startHour)) * 100;
            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            const period = hour >= 12 ? "PM" : "AM";

            return (
              <div
                key={hour}
                className="absolute text-xs text-wl-text-tertiary font-medium"
                style={{ left: `${position}%`, transform: "translateX(-50%)" }}
              >
                {displayHour}
                <span className="text-[10px]">{period}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline bar container */}
      <div className="relative bg-wl-bg-secondary rounded-lg overflow-hidden h-16 border border-wl-border-subtle">
        {/* Hour divider lines */}
        {hours.slice(0, -1).map((hour) => {
          const position =
            ((hour - startHour + 1) / (endHour - startHour)) * 100;
          return (
            <div
              key={`divider-${hour}`}
              className="absolute top-0 bottom-0 w-px bg-wl-border-default opacity-50"
              style={{ left: `${position}%` }}
            />
          );
        })}

        {/* Current time indicator */}
        {currentPosition >= 0 && currentPosition <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-wl-danger-500 z-10"
            style={{ left: `${currentPosition}%` }}
          >
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-wl-danger-500 rounded-full border-2 border-wl-bg-primary" />
          </div>
        )}

        {/* Stop segments */}
        {stops.map((stop, index) => {
          const startPos = getTimePosition(stop.startTime, startHour, endHour);
          const endPos = getTimePosition(stop.endTime, startHour, endHour);
          const width = Math.max(2, endPos - startPos);

          const statusColor = {
            pending: "opacity-40",
            "in-transit": "opacity-80",
            delivered: "opacity-100",
          };

          return (
            <div
              key={stop.id}
              className={cn(
                "absolute top-0 bottom-0 cursor-pointer transition-all duration-200 hover:shadow-md hover:z-20",
                statusColor[stop.status],
              )}
              style={{
                left: `${startPos}%`,
                width: `${width}%`,
                backgroundColor: routeColor,
              }}
              onMouseEnter={() => setHoveredStop(stop)}
              onMouseLeave={() => setHoveredStop(null)}
              role="button"
              tabIndex={0}
              aria-label={`Stop ${stop.sequenceNumber}: ${stop.customerName}`}
            >
              {/* Stop number badge */}
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-wl-bg-primary border border-wl-border-default rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-wl-text-primary">
                {stop.sequenceNumber}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredStop && (
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-3 shadow-lg animate-in fade-in-50 duration-200">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-wl-text-primary">
                  Stop {hoveredStop.sequenceNumber}
                </p>
                <p className="text-sm text-wl-text-secondary">
                  {hoveredStop.customerName}
                </p>
              </div>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded",
                  hoveredStop.status === "delivered"
                    ? "bg-wl-success-100 text-wl-success-700 dark:bg-wl-success-900 dark:text-wl-success-200"
                    : hoveredStop.status === "in-transit"
                      ? "bg-wl-primary-100 text-wl-primary-700 dark:bg-wl-primary-900 dark:text-wl-primary-200"
                      : "bg-wl-neutral-100 text-wl-neutral-700 dark:bg-wl-neutral-900 dark:text-wl-neutral-200",
                )}
              >
                {hoveredStop.status.replace("-", " ").charAt(0).toUpperCase() +
                  hoveredStop.status.slice(1).toLowerCase()}
              </span>
            </div>
            <p className="text-xs text-wl-text-tertiary">
              {hoveredStop.address}
            </p>
            <div className="text-xs text-wl-text-secondary">
              {formatTime(hoveredStop.startTime)} -{" "}
              {formatTime(hoveredStop.endTime)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
