"use client";

import { ReactNode, useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { type ActivityEvent } from "../page";

interface EventTimelineProps {
  events: ActivityEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onToggleLive: () => void;
  isLive: boolean;
  getEventIcon: (type: ActivityEvent["type"]) => ReactNode;
  getSeverityBadge: (severity: ActivityEvent["severity"]) => ReactNode;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

// Helper function to format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1m ago";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours === 1) return "1h ago";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

// Helper to group events by date
const groupEventsByDate = (
  events: ActivityEvent[]
): Record<string, ActivityEvent[]> => {
  const groups: Record<string, ActivityEvent[]> = {};

  events.forEach((event) => {
    const date = new Date(event.timestamp).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
  });

  return groups;
};

// Helper to check if it's today
const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Helper to check if it's yesterday
const isYesterday = (date: Date): boolean => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
};

export function EventTimeline({
  events,
  selectedEventId,
  onSelectEvent,
  onToggleLive,
  isLive,
  getEventIcon,
  getSeverityBadge,
  hasMore,
  onLoadMore,
}: EventTimelineProps) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const groupedEvents = useMemo(() => groupEventsByDate(events), [events]);

  const dateLabels = useMemo(() => {
    return Object.keys(groupedEvents).map((dateStr) => {
      const date = new Date(dateStr);
      if (isToday(date)) {
        return { label: "Today", date: dateStr };
      }
      if (isYesterday(date)) {
        return { label: "Yesterday", date: dateStr };
      }
      return { label: dateStr, date: dateStr };
    });
  }, [groupedEvents]);

  return (
    <div className="space-y-8">
      {dateLabels.map(({ label, date }) => (
        <div key={date} className="space-y-4">
          {/* Sticky date header */}
          <div className="sticky top-44 z-20 bg-wl-bg-primary py-3 -mx-2 px-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-wl-border-subtle" />
              <h3 className="text-xs font-semibold text-wl-text-secondary uppercase tracking-widest px-3 py-1 bg-wl-bg-surface rounded-full border border-wl-border-subtle">
                {label}
              </h3>
              <div className="h-px flex-1 bg-wl-border-subtle" />
            </div>
          </div>

          {/* Events for this date */}
          <div className="space-y-3 relative">
            {/* Vertical timeline connector */}
            <div
              className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-wl-primary-500/50 to-wl-primary-500/0"
              aria-hidden="true"
            />

            {groupedEvents[date].map((event, index) => {
              const isSelected = selectedEventId === event.id;
              const isExpanded = expandedEventId === event.id;
              const isNew = new Date(event.timestamp).getTime() > Date.now() - 30000;

              return (
                <div key={event.id} className="relative pl-16">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "absolute -left-2.5 top-3 w-5 h-5 rounded-full",
                      "border-2 bg-wl-bg-primary transition-all duration-300",
                      "flex items-center justify-center",
                      isNew && "animate-pulse"
                    )}
                    style={{
                      borderColor: isSelected
                        ? "var(--wl-primary-500)"
                        : "var(--wl-border-subtle)",
                      backgroundColor: isSelected ? "var(--wl-bg-elevated)" : undefined,
                      boxShadow: isSelected
                        ? "0 0 0 3px var(--wl-primary-500/10)"
                        : "none",
                    }}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        isSelected || isNew ? "bg-wl-primary-500" : "bg-wl-border-default"
                      )}
                    />
                  </div>

                  {/* Event card */}
                  <Card
                    hover
                    className={cn(
                      "cursor-pointer transition-all duration-300",
                      isSelected
                        ? "ring-2 ring-wl-primary-500 ring-offset-2 ring-offset-wl-bg-primary"
                        : ""
                    )}
                    onClick={() => {
                      onSelectEvent(event.id);
                      setExpandedEventId(event.id);
                    }}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Top row: icon, title, and badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Icon */}
                          <div
                            className="mt-0.5 text-wl-text-secondary flex-shrink-0"
                          >
                            {getEventIcon(event.type)}
                          </div>

                          {/* Title and description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-wl-text-primary leading-snug">
                              {event.title}
                            </p>
                            <p className="text-xs text-wl-text-secondary mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          </div>
                        </div>

                        {/* Severity badge */}
                        <div className="flex-shrink-0">
                          {getSeverityBadge(event.severity)}
                        </div>
                      </div>

                      {/* Middle row: user avatar + entity (if available) */}
                      {(event.user || event.entity) && (
                        <div className="flex items-center gap-3 pt-2 border-t border-wl-border-subtle">
                          {event.user && (
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar size="sm">
                                <AvatarFallback name={event.user.name} />
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-wl-text-primary">
                                  {event.user.name}
                                </p>
                              </div>
                            </div>
                          )}

                          {event.entity && (
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-6 h-6 rounded-md bg-wl-bg-surface border border-wl-border-subtle flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-wl-text-secondary">
                                  {event.entity.type.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-wl-primary-400 truncate">
                                  {event.entity.name}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expandable detail section */}
                      {isExpanded && event.metadata && (
                        <div className="pt-2 border-t border-wl-border-subtle space-y-2">
                          <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
                            Details
                          </p>
                          <div className="space-y-1 bg-wl-bg-surface rounded-md p-2">
                            {Object.entries(event.metadata).slice(0, 3).map(
                              ([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="text-wl-text-tertiary">
                                    {key}:
                                  </span>
                                  <span className="text-wl-text-primary ml-2">
                                    {String(value)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bottom row: timestamp and expand button */}
                      <div className="flex items-center justify-between pt-2 border-t border-wl-border-subtle">
                        <p className="text-xs text-wl-text-tertiary">
                          {formatRelativeTime(new Date(event.timestamp))}
                        </p>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedEventId(
                                isExpanded ? null : event.id
                              );
                            }}
                            className="text-wl-text-tertiary hover:text-wl-text-primary transition-colors p-1"
                          >
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform duration-300",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {events.length > 0 && (
        <div className="text-center py-8">
          <p className="text-xs text-wl-text-tertiary mb-3">
            Showing {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
          {hasMore && onLoadMore && (
            <button
              onClick={onLoadMore}
              className="px-4 py-2 text-sm font-medium text-wl-info-400 border border-wl-info-400/30 rounded-md hover:bg-wl-info-500/10 transition-colors"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
