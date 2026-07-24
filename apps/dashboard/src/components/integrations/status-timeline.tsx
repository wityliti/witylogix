"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Status Timeline component
 * Vertical timeline of integration events/status changes with collapsible details
 * Features: color-coded event types, date grouping, pagination
 */

export type EventType = "success" | "warning" | "error" | "info";

export interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  timestamp: Date;
  details?: string;
  metadata?: Record<string, unknown>;
}

export interface StatusTimelineProps {
  events: TimelineEvent[];
  onEventSelect?: (eventId: string) => void;
  className?: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function groupEventsByDate(
  events: TimelineEvent[],
): Record<string, TimelineEvent[]> {
  const grouped: Record<string, TimelineEvent[]> = {};

  events.forEach((event) => {
    const dateKey = formatDate(event.timestamp);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(event);
  });

  return grouped;
}

export function StatusTimeline({
  events,
  onEventSelect,
  className,
}: StatusTimelineProps) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [itemsToShow, setItemsToShow] = useState(10);

  const groupedEvents = groupEventsByDate(events);
  const sortedDates = Object.keys(groupedEvents).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  const getEventColor = (type: EventType): string => {
    switch (type) {
      case "success":
        return "var(--wl-success-500)";
      case "warning":
        return "var(--wl-warning-500)";
      case "error":
        return "var(--wl-danger-500)";
      case "info":
        return "var(--wl-info-500)";
    }
  };

  const getEventBadgeClass = (type: EventType): string => {
    switch (type) {
      case "success":
        return "bg-wl-success-100 dark:bg-wl-success-900/30 text-wl-success-700 dark:text-wl-success-300";
      case "warning":
        return "bg-wl-warning-100 dark:bg-wl-warning-900/30 text-wl-warning-700 dark:text-wl-warning-300";
      case "error":
        return "bg-wl-danger-100 dark:bg-wl-danger-900/30 text-wl-danger-700 dark:text-wl-danger-300";
      case "info":
        return "bg-wl-info-100 dark:bg-wl-info-900/30 text-wl-info-700 dark:text-wl-info-300";
    }
  };

  const getEventIcon = (type: EventType): string => {
    switch (type) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✕";
      case "info":
        return "ℹ";
    }
  };

  const visibleEvents = events.slice(0, itemsToShow);

  return (
    <div
      className={cn(
        "border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden flex flex-col",
        className,
      )}
      style={{ height: "600px" }}
    >
      {/* Header */}
      <div className="border-b border-wl-border-subtle bg-wl-surface-hover p-4">
        <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
          Event Timeline
        </h3>
        <div className="flex items-center justify-between text-xs text-wl-text-secondary">
          <span>{events.length} total events</span>
          <div className="flex items-center gap-3">
            {["success", "warning", "error", "info"].map((type) => {
              const count = events.filter((e) => e.type === type).length;
              return (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: getEventColor(type as EventType),
                    }}
                  />
                  <span>
                    {type}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        {visibleEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-wl-text-tertiary">
            <div className="text-sm">No events yet</div>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div
              className="absolute left-4 top-0 bottom-0 w-0.5"
              style={{ backgroundColor: "var(--wl-border-subtle)" }}
            />

            {/* Events */}
            <div className="space-y-6 relative z-10">
              {visibleEvents.map((event, index) => {
                const isExpanded = expandedEventId === event.id;
                const isLastInDate =
                  index === events.length - 1 ||
                  formatDate(visibleEvents[index + 1]?.timestamp) !==
                    formatDate(event.timestamp);

                return (
                  <div key={event.id} className="relative">
                    {/* Date Header */}
                    {(index === 0 ||
                      formatDate(visibleEvents[index - 1]?.timestamp) !==
                        formatDate(event.timestamp)) && (
                      <div className="flex items-center gap-3 mb-4 ml-16">
                        <div className="text-xs font-semibold text-wl-text-secondary uppercase">
                          {formatDate(event.timestamp)}
                        </div>
                        <div className="flex-1 h-px bg-wl-border-subtle" />
                      </div>
                    )}

                    {/* Event */}
                    <button
                      onClick={() => {
                        setExpandedEventId(isExpanded ? null : event.id);
                        onEventSelect?.(event.id);
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-4 ml-12 p-3 rounded-lg hover:bg-wl-surface-hover transition-colors">
                        {/* Timeline dot */}
                        <div className="relative w-6 h-6 flex-shrink-0 -ml-6">
                          <div
                            className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2"
                            style={{
                              backgroundColor: getEventColor(event.type),
                            }}
                          />
                          <div className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 bg-wl-bg-surface" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1",
                                getEventBadgeClass(event.type),
                              )}
                            >
                              <span>{getEventIcon(event.type)}</span>
                              {event.type.toUpperCase()}
                            </span>
                            <span className="text-xs text-wl-text-secondary font-medium">
                              {formatTime(event.timestamp)}
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-wl-text-primary mb-1">
                            {event.title}
                          </h4>
                          <p className="text-sm text-wl-text-secondary">
                            {event.description}
                          </p>

                          {/* Expand indicator */}
                          {(event.details || event.metadata) && (
                            <div className="text-xs text-wl-primary-500 mt-2 font-medium flex items-center gap-1">
                              {isExpanded ? "Hide" : "Show"} details
                              <span
                                className={cn(
                                  "transition-transform",
                                  isExpanded && "rotate-180",
                                )}
                              >
                                ▾
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (event.details || event.metadata) && (
                        <div className="ml-12 p-4 mt-2 rounded-lg bg-wl-surface-hover border border-wl-border-subtle">
                          {event.details && (
                            <div className="mb-3">
                              <div className="text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
                                Details
                              </div>
                              <p className="text-sm text-wl-text-secondary">
                                {event.details}
                              </p>
                            </div>
                          )}

                          {event.metadata && (
                            <div>
                              <div className="text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
                                Metadata
                              </div>
                              <pre
                                className={cn(
                                  "text-xs overflow-x-auto rounded p-2",
                                  "bg-wl-bg-surface border border-wl-border-subtle",
                                  "text-wl-text-secondary font-mono",
                                )}
                              >
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Load More */}
        {itemsToShow < events.length && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setItemsToShow(itemsToShow + 10)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                "bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200",
                "dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50",
              )}
            >
              Load More ({events.length - itemsToShow} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
