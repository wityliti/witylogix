"use client";

import { useState, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiList } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Download, RefreshCw, X } from "lucide-react";

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
  source?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "primary" | "info" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    primary: "bg-wl-primary-500/10 text-wl-primary-400",
    info: "bg-wl-info-500/10 text-wl-info-400",
    success: "bg-wl-success-500/10 text-wl-success-400",
    warning: "bg-wl-warning-500/10 text-wl-warning-400",
    danger: "bg-wl-danger-500/10 text-wl-danger-400",
  };

  return (
    <Card className={cn("p-4 border-wl-border-default", colorMap[color])}>
      <p className="text-xs uppercase tracking-wide font-semibold opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </Card>
  );
}

export default function EventsPage() {
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({});

  // Server-side filterable params embedded in path; source+searchQuery are client-side only
  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.eventType) params.set("action", filters.eventType);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    const qs = params.toString();
    return qs ? `/api/v4/activity-logs?${qs}` : "/api/v4/activity-logs";
  }, [filters.eventType, filters.entityType, filters.dateFrom, filters.dateTo]);

  const { items: data, loading, error, refetch } = useApiList<ActivityLog>(apiPath);

  // Dynamic options derived from the current result set
  const eventTypeOptions = useMemo(
    () => [...new Set(data.map((e) => e.action))].sort(),
    [data]
  );
  const entityTypeOptions = useMemo(
    () => [...new Set(data.map((e) => e.entityType))].sort(),
    [data]
  );

  // Client-side filter for source (actorType) and free-text search
  const displayedData = useMemo(() => {
    return data.filter((event) => {
      if (filters.source && event.actorType !== filters.source) return false;
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        if (
          !event.action.toLowerCase().includes(q) &&
          !event.entityId.toLowerCase().includes(q) &&
          !event.entityType.toLowerCase().includes(q) &&
          !event.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [data, filters.source, filters.searchQuery]);

  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const last24hCount = useMemo(
    () => data.filter((e) => new Date(e.timestamp).getTime() >= cutoff24h).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );
  const errorCount = useMemo(
    () =>
      data.filter(
        (e) =>
          e.action?.toLowerCase().includes("fail") ||
          e.action?.toLowerCase().includes("error")
      ).length,
    [data]
  );

  const toggleEventSelection = useCallback((eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedEvents((prev) =>
      prev.size === displayedData.length
        ? new Set()
        : new Set(displayedData.map((e) => e.id))
    );
  }, [displayedData]);

  const updateFilter = useCallback(
    (key: keyof FilterState, value: string | undefined) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (value === undefined || value === "") delete next[key];
        else (next as Record<string, unknown>)[key] = value;
        return next;
      });
    },
    []
  );

  const clearFilters = useCallback(() => setFilters({}), []);

  const handleDownload = useCallback(() => {
    const rows = [
      ["ID", "Action", "Entity Type", "Entity ID", "Actor Type", "Timestamp"],
      ...displayedData.map((e) => [
        e.id,
        e.action,
        e.entityType,
        e.entityId,
        e.actorType,
        e.timestamp,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayedData]);

  if (loading && data.length === 0) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Events"
        subtitle={`${displayedData.length} event${displayedData.length !== 1 ? "s" : ""}`}
        actions={
          <Button
            variant="secondary"
            size="md"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        }
      />

      <div className="w-full max-w-7xl mx-auto px-6 py-8 bg-wl-bg-root min-h-[calc(100vh-var(--header-height))] space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Events" value={displayedData.length} color="primary" />
          <StatCard label="Last 24h" value={last24hCount} color="info" />
          <StatCard label="Event Types" value={eventTypeOptions.length} color="success" />
          <StatCard
            label="Errors"
            value={errorCount}
            color={errorCount > 0 ? "danger" : "success"}
          />
        </div>

        {/* Filters and Controls */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Filters &amp; Search</CardTitle>
              {Object.keys(filters).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs text-wl-text-secondary"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary" />
              <input
                type="text"
                placeholder="Search by event ID, action, or entity..."
                value={filters.searchQuery || ""}
                onChange={(e) => updateFilter("searchQuery", e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2 rounded-md",
                  "bg-wl-bg-elevated border border-wl-border-default",
                  "text-white text-sm",
                  "placeholder:text-wl-text-tertiary",
                  "focus:outline-none focus:border-wl-info-500 focus:ring-1 focus:ring-wl-info-500/30",
                  "transition-colors duration-200"
                )}
              />
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">
                  Event Type
                </label>
                <select
                  value={filters.eventType || ""}
                  onChange={(e) => updateFilter("eventType", e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-md",
                    "bg-wl-bg-elevated border border-wl-border-default",
                    "text-white text-sm",
                    "focus:outline-none focus:border-wl-info-500",
                    "transition-colors duration-200"
                  )}
                >
                  <option value="">All Types</option>
                  {eventTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">
                  Source
                </label>
                <select
                  value={filters.source || ""}
                  onChange={(e) => updateFilter("source", e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-md",
                    "bg-wl-bg-elevated border border-wl-border-default",
                    "text-white text-sm",
                    "focus:outline-none focus:border-wl-info-500",
                    "transition-colors duration-200"
                  )}
                >
                  <option value="">All Sources</option>
                  <option value="api">API</option>
                  <option value="webhook">Webhook</option>
                  <option value="workflow">Workflow</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">
                  Entity Type
                </label>
                <select
                  value={filters.entityType || ""}
                  onChange={(e) => updateFilter("entityType", e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-md",
                    "bg-wl-bg-elevated border border-wl-border-default",
                    "text-white text-sm",
                    "focus:outline-none focus:border-wl-info-500",
                    "transition-colors duration-200"
                  )}
                >
                  <option value="">All Entities</option>
                  {entityTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

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
                    "bg-wl-bg-elevated border border-wl-border-default",
                    "text-white text-sm",
                    "focus:outline-none focus:border-wl-info-500",
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
                checked={
                  selectedEvents.size === displayedData.length &&
                  displayedData.length > 0
                }
                onChange={selectAll}
                className="w-4 h-4 rounded border-wl-border-default cursor-pointer bg-wl-bg-elevated"
                aria-label="Select all events"
              />
              <span className="text-xs text-wl-text-secondary">
                {selectedEvents.size > 0
                  ? `${selectedEvents.size} selected`
                  : "Select events"}
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>

          {/* Events Grid */}
          {loading && data.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 pt-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="h-32 bg-wl-bg-surface animate-pulse">
                  {null}
                </Card>
              ))}
            </div>
          ) : displayedData.length === 0 ? (
            <Card className="p-8 bg-wl-bg-surface border-wl-border-default text-center">
              <p className="text-wl-text-secondary">
                No events found matching your filters
              </p>
              {Object.keys(filters).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-2 text-xs"
                >
                  Clear filters
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {displayedData.map((event) => (
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
                        <h4 className="text-sm font-semibold text-white mb-1">
                          {event.action}
                        </h4>
                        <p className="text-xs text-wl-text-secondary mb-2">
                          {event.entityType} &bull;{" "}
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge variant="info" className="text-xs">
                        {event.actorType}
                      </Badge>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
