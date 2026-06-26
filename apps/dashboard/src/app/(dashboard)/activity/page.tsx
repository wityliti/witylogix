'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  Download,
  Package,
  Truck,
  Users,
  Zap,
  Webhook,
  GitBranch,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EventTimeline } from './components/event-timeline';
import { EventFilters } from './components/event-filters';
import { useApiList } from '@/hooks/use-api';

// Types
export interface ActivityEvent {
  id: string;
  type: 'order' | 'shipment' | 'driver' | 'system' | 'webhook' | 'workflow';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  entity?: {
    type: string;
    id: string;
    name: string;
  };
  metadata?: Record<string, any>;
}

export default function ActivityPage() {
  const { items: apiEvents, loading, error, refetch, pagination, setPage } = useApiList<ActivityEvent>('/api/v4/activity-logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [filters, setFilters] = useState({
    types: [] as string[],
    severities: [] as string[],
    startDate: null as Date | null,
    endDate: null as Date | null,
    userId: null as string | null,
  });
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    const users: { id: string; name: string }[] = [];
    for (const e of apiEvents) {
      if (e.user && !seen.has(e.user.id)) {
        seen.add(e.user.id);
        users.push({ id: e.user.id, name: e.user.name });
      }
    }
    return users;
  }, [apiEvents]);

  useEffect(() => {
    if (apiEvents.length > 0) setEvents(apiEvents);
  }, [apiEvents]);

  // Live mode: poll the real API every 30 seconds
  useEffect(() => {
    if (!isLiveMode) return;
    const interval = setInterval(() => { refetch(); }, 30000);
    return () => clearInterval(interval);
  }, [isLiveMode, refetch]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const displayedEvents = filteredEvents();

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Search is already filtered in filteredEvents
    }, 300);
  };

  // Export events as CSV
  const handleExport = () => {
    const csvContent = [
      ["ID", "Type", "Severity", "Title", "Description", "Timestamp", "User"],
      ...displayedEvents.map((event) => [
        event.id,
        event.type,
        event.severity,
        event.title,
        event.description,
        String(event.timestamp),
        event.user?.name || "System",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get event icon
  const getEventIcon = (type: ActivityEvent['type']) => {
    const iconProps = 'w-4 h-4';
    switch (type) {
      case 'order':
        return <Package className={iconProps} />;
      case 'shipment':
        return <Truck className={iconProps} />;
      case 'driver':
        return <Users className={iconProps} />;
      case 'system':
        return <Zap className={iconProps} />;
      case 'webhook':
        return <Webhook className={iconProps} />;
      case 'workflow':
        return <GitBranch className={iconProps} />;
      default:
        return <AlertCircle className={iconProps} />;
    }
  };

  // Get severity badge variant
  const getSeverityBadgeVariant = (severity: ActivityEvent['severity']) => {
    switch (severity) {
      case 'error':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading && events.length === 0) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const displayedEvents = filteredEvents();
  const selectedEvent = selectedEventId ? displayedEvents.find((e) => e.id === selectedEventId) : null;

  return (
    <div
      className="flex flex-col min-h-screen bg-wl-bg-root"
      ref={containerRef}
    >
      {/* Header */}
      <div className="bg-wl-bg-root border-b border-wl-border-default sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Activity Log
              </h1>
              <p className="text-sm text-wl-neutral-300 mt-2">
                Real-time monitoring of system events and operations
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md border",
                  "transition-all duration-300",
                  isLiveMode
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-wl-bg-elevated border-wl-border-default"
                )}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-500",
                    isLiveMode
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-wl-text-tertiary"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    isLiveMode
                      ? "text-emerald-500"
                      : "text-wl-neutral-300"
                  )}
                >
                  {isLiveMode ? "Live" : "Paused"}
                </span>
              </div>

              <Button
                variant="secondary"
                size="md"
                onClick={handleExport}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-wl-text-secondary pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by title, description, entity, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "pl-10 pr-4 py-2.5 w-full",
                  "bg-wl-bg-surface border border-wl-border-default",
                  "text-white placeholder-wl-text-tertiary",
                  "focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20",
                  "rounded-md transition-all duration-200"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-wl-text-secondary hover:text-wl-neutral-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <EventFilters filters={filters} setFilters={setFilters} users={uniqueUsers} />

            {/* Active filters display */}
            {(filters.types.length > 0 ||
              filters.severities.length > 0 ||
              filters.startDate ||
              filters.endDate ||
              filters.userId) && (
              <div className="flex flex-wrap items-center gap-2">
                {filters.types.map((type) => (
                  <Badge
                    key={type}
                    variant="primary"
                    className="gap-1.5 cursor-pointer hover:bg-blue-500/20"
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        types: prev.types.filter((t) => t !== type),
                      }));
                    }}
                  >
                    {type}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                {filters.severities.map((severity) => (
                  <Badge
                    key={severity}
                    variant={getSeverityBadgeVariant(
                      severity as ActivityEvent["severity"]
                    )}
                    className="gap-1.5 cursor-pointer hover:opacity-80"
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        severities: prev.severities.filter((s) => s !== severity),
                      }));
                    }}
                  >
                    {severity}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                {(filters.types.length > 0 ||
                  filters.severities.length > 0 ||
                  filters.startDate ||
                  filters.endDate ||
                  filters.userId) && (
                  <button
                    onClick={() =>
                      setFilters({
                        types: [],
                        severities: [],
                        startDate: null,
                        endDate: null,
                        userId: null,
                      })
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {displayedEvents.length === 0 ? (
          <EmptyState
            icon={<AlertCircle className="w-8 h-8" />}
            title="No events found"
            description={
              searchQuery || Object.values(filters).some((v) =>
                v === null || v === undefined
                  ? false
                  : Array.isArray(v)
                    ? v.length > 0
                    : true
              )
                ? "Try adjusting your search or filters to find events"
                : "Activity events will appear here as they are generated"
            }
            action={
              searchQuery
                ? {
                    label: "Clear search",
                    onClick: () => setSearchQuery(""),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Timeline */}
            <div className="lg:col-span-2">
              <EventTimeline
                events={displayedEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
                onToggleLive={() => setIsLiveMode(!isLiveMode)}
                isLive={isLiveMode}
                getEventIcon={getEventIcon}
                getSeverityBadge={(severity) => (
                  <Badge variant={getSeverityBadgeVariant(severity)}>
                    {severity}
                  </Badge>
                )}
                hasMore={pagination.page < pagination.totalPages}
                onLoadMore={() => setPage(pagination.page + 1)}
              />
            </div>

            {/* Event detail panel */}
            {selectedEvent && (
              <div className="lg:col-span-1">
                <Card className="sticky top-24 h-fit">
                  <CardContent className="p-6 space-y-6">
                    {/* Header */}
                    <div>
                      <button
                        onClick={() => setSelectedEventId(null)}
                        className="text-xs text-wl-neutral-300 hover:text-white transition-colors mb-3 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Close
                      </button>
                      <h3 className="text-lg font-semibold text-white">
                        {selectedEvent.title}
                      </h3>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-shrink-0">
                          {getEventIcon(selectedEvent.type)}
                        </div>
                        <div className="flex-1">
                          <Badge variant={getSeverityBadgeVariant(selectedEvent.severity)}>
                            {selectedEvent.severity.charAt(0).toUpperCase() +
                              selectedEvent.severity.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-wl-border-default pt-4">
                      <p className="text-xs font-semibold text-wl-neutral-300 uppercase tracking-wider mb-2">
                        Description
                      </p>
                      <p className="text-sm text-white">
                        {selectedEvent.description}
                      </p>
                    </div>

                    {selectedEvent.user && (
                      <div className="border-t border-wl-border-default pt-4">
                        <p className="text-xs font-semibold text-wl-neutral-300 uppercase tracking-wider mb-3">
                          Triggered by
                        </p>
                        <div className="flex items-center gap-3">
                          <Avatar size="sm">
                            <AvatarFallback name={selectedEvent.user.name} />
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {selectedEvent.user.name}
                            </p>
                            <p className="text-xs text-wl-text-secondary">
                              {selectedEvent.user.id}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedEvent.entity && (
                      <div className="border-t border-wl-border-default pt-4">
                        <p className="text-xs font-semibold text-wl-neutral-300 uppercase tracking-wider mb-3">
                          Related entity
                        </p>
                        <div className="bg-wl-bg-surface rounded-md p-3 border border-wl-border-default">
                          <p className="text-xs text-wl-neutral-300 mb-1">
                            {selectedEvent.entity.type.toUpperCase()}
                          </p>
                          <p className="text-sm font-medium text-blue-400">
                            {selectedEvent.entity.name}
                          </p>
                          <p className="text-xs text-wl-text-secondary mt-1">
                            ID: {selectedEvent.entity.id}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-wl-border-default pt-4">
                      <p className="text-xs font-semibold text-wl-neutral-300 uppercase tracking-wider mb-2">
                        Timestamp
                      </p>
                      <p className="text-sm text-white">
                        {new Date(selectedEvent.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {selectedEvent.metadata &&
                      Object.keys(selectedEvent.metadata).length > 0 && (
                        <div className="border-t border-wl-border-default pt-4">
                          <p className="text-xs font-semibold text-wl-neutral-300 uppercase tracking-wider mb-3">
                            Metadata
                          </p>
                          <div className="space-y-2">
                            {Object.entries(selectedEvent.metadata).map(
                              ([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="text-wl-neutral-300">
                                    {key}:
                                  </span>
                                  <span className="text-white ml-2">
                                    {String(value)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
