"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EventCard } from "./components/event-card";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  X,
} from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId?: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

interface EventStats {
  total: number;
  byType: Record<string, number>;
  last24h: number;
}

interface FilterState {
  eventType?: string;
  source?: "api" | "webhook" | "workflow" | "system";
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

const EVENT_TYPES = [
  "order_created",
  "order_updated",
  "shipment_created",
  "shipment_status_changed",
  "driver_assigned",
  "delivery_completed",
  "payment_processed",
  "webhook_received",
  "workflow_triggered",
  "system_error",
];

const ENTITY_TYPES = ["order", "shipment", "driver", "payment", "workflow"];
const SOURCES = ["api", "webhook", "workflow", "system"] as const;

/* ═══════════════════════════════════════════════════════════
   EVENT LOG VIEWER PAGE
   ═══════════════════════════════════════════════════════════ */

export default function EventsPage() {
  // State Management
  const [events, setEvents] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<EventStats>({
    total: 0,
    byType: {},
    last24h: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Fetch events
  const fetchEvents = useCallback(async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pageNum.toString());
      params.append("limit", "20");

      if (filters.eventType) params.append("action", filters.eventType);
      if (filters.entityType) params.append("entityType", filters.entityType);
      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.append("dateTo", filters.dateTo);

      // Mock data for demo — replace with actual API call
      const mockEvents: ActivityLog[] = generateMockEvents(pageNum);
      setEvents(pageNum === 1 ? mockEvents : [...events, ...mockEvents]);
      setPage(pageNum);
      setTotalPages(5); // Mock total pages
      setHasMore(pageNum < 5);

      // Calculate stats
      const allEvents = pageNum === 1 ? mockEvents : [...events, ...mockEvents];
      const typeMap: Record<string, number> = {};
      let last24h = 0;
      const now = Date.now();

      allEvents.forEach((event) => {
        typeMap[event.action] = (typeMap[event.action] || 0) + 1;
        if (now - new Date(event.timestamp).getTime() < 86400000) {
          last24h++;
        }
      });

      setStats({
        total: allEvents.length,
        byType: typeMap,
        last24h,
      });
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, events]);

  // Initial load
  useEffect(() => {
    fetchEvents(1);
  }, [filters]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchEvents(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
  const { items: data, loading, error, refetch, pagination } = useApiList<Event>('/api/v4/events');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;


    return () => observer.disconnect();
  }, [hasMore, loading, page, fetchEvents]);

  // Event selection
  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const selectAll = () => {
    if (selectedEvents.size === events.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(events.map((e) => e.id)));
    }
  };

  // Export selected events
  const exportEvents = () => {
    const eventsToExport = events.filter((e) =>
      selectedEvents.has(e.id)
    );
    const json = JSON.stringify(eventsToExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter updates
  const updateFilter = (key: keyof FilterState, value: string | undefined) => {
    const newFilters = { ...filters };
    if (value === undefined || value === "") {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Events"
          value={stats.total}
          color="primary"
        />
        <StatCard
          label="Last 24h"
          value={stats.last24h}
          color="info"
        />
        <StatCard
          label="Event Types"
          value={Object.keys(stats.byType).length}
          color="success"
        />
        <StatCard
          label="Pending"
          value="2"
          color="warning"
        />
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Filters & Search</CardTitle>
            {Object.keys(filters).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-wl-text-secondary" />
            <input
              type="text"
              placeholder="Search by event ID or correlation ID..."
              value={filters.searchQuery || ""}
              onChange={(e) => updateFilter("searchQuery", e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 rounded-md",
                "bg-wl-bg-surface border border-wl-border-default",
                "text-wl-text-primary text-sm",
                "placeholder-wl-text-tertiary",
                "focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/30",
                "transition-colors duration-200"
              )}
            />
          </div>

          {/* Filter Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Event Type */}
            <div>
              <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">
                Event Type
              </label>
              <select
                value={filters.eventType || ""}
                onChange={(e) => updateFilter("eventType", e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-md",
                  "bg-wl-bg-surface border border-wl-border-default",
                  "text-wl-text-primary text-sm",
                  "focus:outline-none focus:border-wl-primary-500",
                  "transition-colors duration-200"
                )}
              >
                <option value="">All Types</option>
                {data.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">
                Source
              </label>
              <select
                value={(filters.source as string) || ""}
                onChange={(e) =>
                  updateFilter("source", e.target.value as any)
                }
                className={cn(
                  "w-full px-3 py-2 rounded-md",
                  "bg-wl-bg-surface border border-wl-border-default",
                  "text-wl-text-primary text-sm",
                  "focus:outline-none focus:border-wl-primary-500",
                  "transition-colors duration-200"
                )}
              >
                <option value="">All Sources</option>
                {data.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Type */}
            <div>
              <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">
                Entity Type
              </label>
              <select
                value={filters.entityType || ""}
                onChange={(e) => updateFilter("entityType", e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-md",
                  "bg-wl-bg-surface border border-wl-border-default",
                  "text-wl-text-primary text-sm",
                  "focus:outline-none focus:border-wl-primary-500",
                  "transition-colors duration-200"
                )}
              >
                <option value="">All Entities</option>
                {data.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-md",
                  "bg-wl-bg-surface border border-wl-border-default",
                  "text-wl-text-primary text-sm",
                  "focus:outline-none focus:border-wl-primary-500",
                  "transition-colors duration-200"
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <div className="space-y-3">
        {/* List Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedEvents.size === events.length && events.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded border-wl-border-default cursor-pointer"
              aria-label="Select all events"
            />
            <span className="text-xs text-wl-text-secondary">
              {selectedEvents.size > 0
                ? `${selectedEvents.size} selected`
                : "Select events"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchEvents(page)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>

            {selectedEvents.size > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={exportEvents}
                className="gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Export ({selectedEvents.size})
              </Button>
            )}
          </div>
        </div>

        {/* Events Grid */}
        {loading && events.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 pt-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="h-32 bg-wl-bg-surface animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-wl-text-secondary">No events found</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3"
                onClick={() => toggleEventSelection(event.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.has(event.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleEventSelection(event.id);
                  }}
                  className="w-4 h-4 mt-4 rounded border-wl-border-default cursor-pointer"
                  aria-label={`Select event ${event.id}`}
                />
                <div className="flex-1 min-w-0">
                  <EventCard
                    id={event.id}
                    type={event.action}
                    source={mapActorTypeToSource(event.actorType)}
                    timestamp={event.timestamp}
                    entityType={event.entityType}
                    status={getEventStatus(event)}
                    payload={event.metadata}
                    correlationId={
                      (event.metadata.correlationId as string) || undefined
                    }
                  />
                </div>
              </div>
            ))}

            {/* Infinite Scroll Loader */}
            {hasMore && (
              <div
                ref={loaderRef}
                className="flex justify-center py-8"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-wl-primary-500 animate-pulse" />
                    <span className="text-xs text-wl-text-secondary">
                      Loading more events...
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchEvents(page + 1)}
                  >
                    Load More
                  </Button>
                )}
              </div>
            )}

            {!hasMore && events.length > 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-wl-text-tertiary">
                  End of events ({events.length} total)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Stat Card Component
   ───────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: string | number;
  color: "primary" | "info" | "success" | "warning" | "danger";
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorMap = {
    primary: "bg-wl-primary-500/12 text-wl-primary-400",
    info: "bg-wl-info-bg text-wl-info-400",
    success: "bg-wl-success-bg text-wl-success-400",
    warning: "bg-wl-warning-bg text-wl-warning-400",
    danger: "bg-wl-danger-bg text-wl-danger-400",
  };

  return (
    <Card className={cn("p-4", colorMap[color])}>
      <p className="text-xs uppercase tracking-wide font-semibold opacity-75">
        {label}
      </p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </Card>
  );
}

/* ─────────────────────────────────────────
   Utility Functions
   ───────────────────────────────────────── */

function mapActorTypeToSource(
  actorType: string
): "api" | "webhook" | "workflow" | "system" {
  const map: Record<string, "api" | "webhook" | "workflow" | "system"> = {
    user: "api",
    system: "system",
    webhook: "webhook",
    workflow: "workflow",
    driver: "api",
  };
  return map[actorType] || "system";
}

function getEventStatus(
  event: ActivityLog
): "processed" | "pending" | "failed" {
  if (event.metadata?.error) return "failed";
  if (event.metadata?.pending) return "pending";
  return "processed";
}

function generateMockEvents(pageNum: number): ActivityLog[] {
  const actions = [
    "order_created",
    "order_updated",
    "shipment_created",
    "shipment_status_changed",
    "driver_assigned",
  ];
  const entities = ["order", "shipment", "driver", "payment"];
  const actorTypes = ["user", "system", "webhook", "workflow"];

  return Array.from({ length: 20 }, (_, i) => {
    const index = (pageNum - 1) * 20 + i;
    return {
      id: `evt-${String(1000 + index).padStart(6, "0")}`,
      action: actions[index % actions.length],
      entityType: entities[index % entities.length],
      entityId: `ent-${String(500 + index).padStart(6, "0")}`,
      actorType: actorTypes[index % actorTypes.length],
      actorId: index % 3 === 0 ? `user-${index}` : undefined,
      changes: {
        status: {
          from: "pending",
          to: "processing",
        },
        timestamp: new Date().toISOString(),
      },
      metadata: {
        correlationId: `corr-${String(200 + index).padStart(6, "0")}`,
        requestId: `req-${String(300 + index).padStart(6, "0")}`,
        environment: "production",
      },
      timestamp: new Date(
        Date.now() - Math.random() * 86400000 * (pageNum - 1 + 1)
      ).toISOString(),
    };
  });
}
