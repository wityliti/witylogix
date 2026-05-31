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
import { useApiList, useApiQuery } from '@/hooks/use-api';

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
  metadata?: Record<string, unknown>;
}

interface ApiUser { id: string; name: string; }

export default function ActivityPage() {
  const { items: apiEvents, loading, error, refetch } = useApiList<ActivityEvent>('/api/v4/activity-logs');
  const { data: usersData } = useApiQuery<{ data: ApiUser[] }>('/api/v4/users?limit=50');
  const userList: ApiUser[] = (usersData as any)?.data ?? [];
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
  const [events, setEvents] = useState<ActivityEvent[]>(apiEvents);

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

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (apiEvents.length > 0) setEvents(apiEvents);
  }, [apiEvents]);

  if (loading && events.length === 0) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // Filter and search logic
  const filteredEvents = useCallback(() => {
    return (apiEvents || []).filter((event) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.entity?.name.toLowerCase().includes(query) ||
          event.user?.name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(event.type)) {
        return false;
      }

      // Severity filter
      if (
        filters.severities.length > 0 &&
        !filters.severities.includes(event.severity)
      ) {
        return false;
      }

      // Date range filter
      if (filters.startDate && new Date(event.timestamp) < filters.startDate) {
        return false;
      }
      if (filters.endDate && new Date(event.timestamp) > filters.endDate) {
        return false;
      }

      // User filter
      if (filters.userId && event.user?.id !== filters.userId) {
        return false;
      }

      return true;
    });
  }, [apiEvents, searchQuery, filters]);

  const displayedEvents = filteredEvents();

  // Live mode: poll the real API every 30 seconds
  useEffect(() => {
    if (!isLiveMode) return;
    const interval = setInterval(() => { refetch(); }, 30000);
    return () => clearInterval(interval);
  }, [isLiveMode, refetch]);

  const filteredEvents = useCallback(() => {
    return (apiEvents || []).filter((event) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.title?.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.entity?.name?.toLowerCase().includes(query) ||
          event.user?.name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (filters.types.length > 0 && !filters.types.includes(event.type)) return false;
      if (filters.severities.length > 0 && !filters.severities.includes(event.severity)) return false;
      if (filters.startDate && new Date(event.timestamp) < filters.startDate) return false;
      if (filters.endDate && new Date(event.timestamp) > filters.endDate) return false;
      if (filters.userId && event.user?.id !== filters.userId) return false;

      return true;
    });
  }, [apiEvents, searchQuery, filters]);

  const handleExport = useCallback(() => {
    const displayedEvents = filteredEvents();
    const csvContent = [
      ['ID', 'Type', 'Severity', 'Title', 'Description', 'Timestamp', 'User'],
      ...displayedEvents.map((event) => [
        event.id,
        event.type,
        event.severity,
        event.title,
        event.description,
        String(event.timestamp),
        event.user?.name || 'System',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredEvents]);

  const getEventIcon = (type: ActivityEvent['type']) => {
    const iconProps = 'w-4 h-4';
    switch (type) {
      case 'order': return <Package className={iconProps} />;
      case 'shipment': return <Truck className={iconProps} />;
      case 'driver': return <Users className={iconProps} />;
      case 'system': return <Zap className={iconProps} />;
      case 'webhook': return <Webhook className={iconProps} />;
      case 'workflow': return <GitBranch className={iconProps} />;
      default: return <AlertCircle className={iconProps} />;
    }
  };

  const getSeverityBadgeVariant = (severity: ActivityEvent['severity']): any => {
    switch (severity) {
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'success': return 'success';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  if (loading) return <LoadingSkeleton />;
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
              <h1 className="text-3xl font-bold text-white tracking-tight">Activity Log</h1>
              <p className="text-sm text-gray-300 mt-2">Real-time monitoring of system events and operations</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <button
                onClick={() => setIsLiveMode((v) => !v)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all duration-300',
                  isLiveMode
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-wl-bg-elevated border-wl-border-default"
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-500',
                    isLiveMode ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500',
                  )}
                />
                <span className={cn('text-xs font-medium', isLiveMode ? 'text-emerald-500' : 'text-gray-300')}>
                  {isLiveMode ? 'Live' : 'Paused'}
                </span>
              </button>

              <Button variant="secondary" size="md" onClick={handleExport} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by title, description, entity, or user..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
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
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <EventFilters filters={filters} setFilters={setFilters} users={uniqueUsers} />

            {(filters.types.length > 0 || filters.severities.length > 0 || filters.startDate || filters.endDate || filters.userId) && (
              <div className="flex flex-wrap items-center gap-2">
                {filters.types.map((type) => (
                  <Badge
                    key={type}
                    variant="primary"
                    className="gap-1.5 cursor-pointer hover:bg-blue-500/20"
                    onClick={() => setFilters((prev) => ({ ...prev, types: prev.types.filter((t) => t !== type) }))}
                  >
                    {type} <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                {filters.severities.map((severity) => (
                  <Badge
                    key={severity}
                    variant={getSeverityBadgeVariant(severity as ActivityEvent['severity'])}
                    className="gap-1.5 cursor-pointer hover:opacity-80"
                    onClick={() => setFilters((prev) => ({ ...prev, severities: prev.severities.filter((s) => s !== severity) }))}
                  >
                    {severity} <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                <button
                  onClick={() => setFilters({ types: [], severities: [], startDate: null, endDate: null, userId: null })}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  Clear all
                </button>
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
              searchQuery || filters.types.length > 0 || filters.severities.length > 0
                ? 'Try adjusting your search or filters to find events'
                : 'Activity events will appear here as they are generated'
            }
            action={searchQuery ? { label: 'Clear search', onClick: () => setSearchQuery('') } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <EventTimeline
                events={displayedEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
                onToggleLive={() => setIsLiveMode((v) => !v)}
                isLive={isLiveMode}
                getEventIcon={getEventIcon}
                getSeverityBadge={(severity) => (
                  <Badge variant={getSeverityBadgeVariant(severity)}>{severity}</Badge>
                )}
              />
            </div>

            {selectedEvent && (
              <div className="lg:col-span-1">
                <Card className="sticky top-24 h-fit">
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <button
                        onClick={() => setSelectedEventId(null)}
                        className="text-xs text-gray-300 hover:text-white transition-colors mb-3 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Close
                      </button>
                      <h3 className="text-lg font-semibold text-white">{selectedEvent.title}</h3>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-shrink-0">{getEventIcon(selectedEvent.type)}</div>
                        <Badge variant={getSeverityBadgeVariant(selectedEvent.severity)}>
                          {selectedEvent.severity.charAt(0).toUpperCase() + selectedEvent.severity.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    <div className="border-t border-wl-border-default pt-4">
                      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        Description
                      </p>
                      <p className="text-sm text-white">
                        {selectedEvent.description}
                      </p>
                    </div>

                    {selectedEvent.user && (
                      <div className="border-t border-wl-border-default pt-4">
                        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                          Triggered by
                        </p>
                        <div className="flex items-center gap-3">
                          <Avatar size="sm">
                            <AvatarFallback name={selectedEvent.user.name} />
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-white">{selectedEvent.user.name}</p>
                            <p className="text-xs text-gray-400">{selectedEvent.user.id}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedEvent.entity && (
                      <div className="border-t border-wl-border-default pt-4">
                        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                          Related entity
                        </p>
                        <div className="bg-wl-bg-surface rounded-md p-3 border border-wl-border-default">
                          <p className="text-xs text-gray-300 mb-1">
                            {selectedEvent.entity.type.toUpperCase()}
                          </p>
                          <p className="text-sm font-medium text-blue-400">
                            {selectedEvent.entity.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            ID: {selectedEvent.entity.id}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-wl-border-default pt-4">
                      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        Timestamp
                      </p>
                      <p className="text-sm text-white">
                        {new Date(selectedEvent.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {selectedEvent.metadata &&
                      Object.keys(selectedEvent.metadata).length > 0 && (
                        <div className="border-t border-wl-border-default pt-4">
                          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                            Metadata
                          </p>
                          <div className="space-y-2">
                            {Object.entries(selectedEvent.metadata).map(
                              ([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="text-gray-300">
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
