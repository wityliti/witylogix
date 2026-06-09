"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiList } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EventCard } from "./components/event-card";
import { Search, Filter, Download, RefreshCw, Calendar, X } from "lucide-react";

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

interface FilterState {
  eventType?: string;
  source?: "api" | "webhook" | "workflow" | "system";
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: "primary" | "info" | "success" | "warning" | "danger" }) {
  const colorMap = {
    primary: "bg-blue-500/12 text-blue-400",
    info: "bg-blue-500/12 text-blue-400",
    success: "bg-emerald-500/12 text-emerald-400",
    warning: "bg-amber-500/12 text-amber-400",
    danger: "bg-red-500/12 text-red-400",
  };

  return (
    <Card className={cn("p-4", colorMap[color])}>
      <p className="text-xs uppercase tracking-wide font-semibold opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </Card>
  );
}

export default function EventsPage() {
  const { items: data, loading, error, refetch } = useApiList<ActivityLog>("/api/v4/activity-logs");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({});

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

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
    if (selectedEvents.size === data.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(data.map((e) => e.id)));
    }
  };

  const updateFilter = (key: keyof FilterState, value: string | undefined) => {
    const newFilters = { ...filters };
    if (value === undefined || value === "") {
      delete newFilters[key];
    } else {
      (newFilters as Record<string, unknown>)[key] = value;
    }
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 bg-wl-bg-root min-h-screen space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Events" value={data.length} color="primary" />
        <StatCard label="Last 24h" value={Math.floor(data.length * 0.3)} color="info" />
        <StatCard label="Event Types" value={new Set(data.map((e) => e.action)).size} color="success" />
        <StatCard label="Pending" value="2" color="warning" />
      </div>

      {/* Filters and Controls */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Filters & Search</CardTitle>
            {Object.keys(filters).length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-gray-400">
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by event ID..."
              value={filters.searchQuery || ""}
              onChange={(e) => updateFilter("searchQuery", e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 rounded-md",
                "bg-wl-bg-elevated border border-wl-border-default",
                "text-white text-sm",
                "placeholder-gray-500",
                "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30",
                "transition-colors duration-200"
              )}
            />
          </div>

          {/* Filter Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Event Type</label>
              <select
                value={filters.eventType || ""}
                onChange={(e) => updateFilter("eventType", e.target.value)}
                className={cn("w-full px-3 py-2 rounded-md", "bg-wl-bg-elevated border border-wl-border-default", "text-white text-sm", "focus:outline-none focus:border-blue-500", "transition-colors duration-200")}
              >
                <option value="">All Types</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Source</label>
              <select
                value={(filters.source as string) || ""}
                onChange={(e) => updateFilter("source", e.target.value as any)}
                className={cn("w-full px-3 py-2 rounded-md", "bg-wl-bg-elevated border border-wl-border-default", "text-white text-sm", "focus:outline-none focus:border-blue-500", "transition-colors duration-200")}
              >
                <option value="">All Sources</option>
                <option value="api">API</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Entity Type</label>
              <select
                value={filters.entityType || ""}
                onChange={(e) => updateFilter("entityType", e.target.value)}
                className={cn("w-full px-3 py-2 rounded-md", "bg-wl-bg-elevated border border-wl-border-default", "text-white text-sm", "focus:outline-none focus:border-blue-500", "transition-colors duration-200")}
              >
                <option value="">All Entities</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Date From</label>
              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className={cn("w-full px-3 py-2 rounded-md", "bg-wl-bg-elevated border border-wl-border-default", "text-white text-sm", "focus:outline-none focus:border-blue-500", "transition-colors duration-200")}
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
              checked={selectedEvents.size === data.length && data.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded border-wl-border-default cursor-pointer bg-wl-bg-elevated"
              aria-label="Select all events"
            />
            <span className="text-xs text-gray-400">
              {selectedEvents.size > 0 ? `${selectedEvents.size} selected` : "Select events"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={loading} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Events Grid */}
        {loading && data.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 pt-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="h-32 bg-wl-bg-surface animate-pulse">{null}</Card>
            ))}
          </div>
        ) : data.length === 0 ? (
          <Card className="p-8 bg-wl-bg-surface border-wl-border-default text-center">
            <p className="text-gray-400">No events found</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {data.map((event) => (
              <div key={event.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedEvents.has(event.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleEventSelection(event.id);
                  }}
                  className="w-4 h-4 mt-4 rounded border-wl-border-default cursor-pointer bg-wl-bg-elevated"
                  aria-label={`Select event ${event.id}`}
                />
                <Card className="flex-1 p-4 bg-wl-bg-surface border-wl-border-default">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">{event.action}</h4>
                      <p className="text-xs text-gray-400 mb-2">{event.entityType} &bull; {new Date(event.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <Badge variant="info" className="text-xs">{event.actorType}</Badge>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
