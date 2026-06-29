'use client';

import { useState, useEffect } from 'react';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Activity,
  Copy,
  Filter,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
} from 'lucide-react';

interface WebhookEvent {
  id: string;
  timestamp: string;
  eventType: string;
  endpointUrl: string;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  duration: number;
  statusCode?: number;
  error?: string;
  attempt: number;
  maxAttempts: number;
}

interface WebhookStats {
  successRate: number;
  avgDeliveryTime: number;
  eventsPerHour: number;
  totalEvents: number;
}

export default function WebhooksDebuggerPage() {
  const { items: webhookEvents, loading, error, refetch } = useApiList<WebhookEvent>(
    '/api/v4/webhook-deliveries',
    { limit: 100 },
  );

  const [filteredEvents, setFilteredEvents] = useState<WebhookEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [stats, setStats] = useState<WebhookStats>({
    successRate: 0,
    avgDeliveryTime: 0,
    eventsPerHour: 0,
    totalEvents: 0,
  });

  const [filters, setFilters] = useState({
    eventType: 'all',
    status: 'all',
    endpoint: '',
  });

  const [isLiveSubscribed, setIsLiveSubscribed] = useState(true);

  // Apply filters whenever API data or filters change
  useEffect(() => {
    let result = [...webhookEvents];

    if (filters.eventType !== 'all') {
      result = result.filter((e) => e.eventType === filters.eventType);
    }

    if (filters.status !== 'all') {
      result = result.filter((e) => e.status === filters.status);
    }

    if (filters.endpoint) {
      result = result.filter((e) => e.endpointUrl.includes(filters.endpoint));
    }

    setFilteredEvents(result);
  }, [webhookEvents, filters]);

  // Compute stats from real data
  useEffect(() => {
    if (filteredEvents.length === 0) {
      setStats({ successRate: 0, avgDeliveryTime: 0, eventsPerHour: 0, totalEvents: 0 });
      return;
    }

    const successful = filteredEvents.filter((e) => e.status === 'success');
    const successRate = (successful.length / filteredEvents.length) * 100;
    const avgDeliveryTime =
      filteredEvents.reduce((sum, e) => sum + (e.duration ?? 0), 0) / filteredEvents.length;

    // Estimate events/hour from timestamps of actual data
    let eventsPerHour = 0;
    if (filteredEvents.length >= 2) {
      const timestamps = filteredEvents
        .map((e) => new Date(e.timestamp).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);
      const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
      if (spanMs > 0) {
        eventsPerHour = Math.round((filteredEvents.length / spanMs) * 3_600_000);
      }
    }

    setStats({ successRate, avgDeliveryTime, eventsPerHour, totalEvents: filteredEvents.length });
  }, [filteredEvents]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const eventTypes = Array.from(new Set(webhookEvents.map((e) => e.eventType))).sort();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Webhook Debugger"
        subtitle="Monitor and debug webhook deliveries in real-time"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border border-wl-border-default bg-wl-bg-surface">
            <CardHeader><CardDescription>Success Rate</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {stats.successRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[var(--wl-border)]">
            <CardHeader><CardDescription>Avg Delivery Time</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgDeliveryTime.toFixed(0)}ms</div>
            </CardContent>
          </Card>

          <Card className="border border-[var(--wl-border)]">
            <CardHeader><CardDescription>Events/Hour</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.eventsPerHour}</div>
            </CardContent>
          </Card>

          <Card className="border border-[var(--wl-border)]">
            <CardHeader><CardDescription>Total Events</CardDescription></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalEvents}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border border-wl-border-default bg-wl-bg-surface mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium block mb-2">Event Type</label>
                <select
                  value={filters.eventType}
                  onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-wl-border-default bg-wl-bg-elevated text-white text-sm"
                >
                  <option value="all">All Events</option>
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Endpoint URL</label>
                <Input
                  placeholder="Filter by URL..."
                  value={filters.endpoint}
                  onChange={(e) => setFilters({ ...filters, endpoint: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  onClick={() => setFilters({ eventType: 'all', status: 'all', endpoint: '' })}
                  variant="secondary"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  onClick={() => {
                    setIsLiveSubscribed(!isLiveSubscribed);
                    if (!isLiveSubscribed) refetch();
                  }}
                  variant={isLiveSubscribed ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  {isLiveSubscribed ? 'Live' : 'Paused'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event List */}
          <div className="lg:col-span-2">
            <Card className="border border-wl-border-default bg-wl-bg-surface">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Recent Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-wl-text-secondary">
                      {webhookEvents.length === 0
                        ? 'No webhook deliveries yet.'
                        : 'No events match your filters.'}
                    </div>
                  ) : (
                    filteredEvents.slice(0, 50).map((event) => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          'p-3 rounded-lg border cursor-pointer transition-all',
                          selectedEvent?.id === event.id
                            ? 'bg-blue-500/10 border-blue-500'
                            : 'border-wl-border-default hover:bg-wl-bg-elevated',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusIcon(event.status)}
                              <span className="font-mono text-xs text-wl-text-secondary">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </span>
                              <Badge variant="info">{event.eventType}</Badge>
                            </div>
                            <div className="text-sm text-wl-text-secondary truncate">{event.endpointUrl}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono text-wl-text-secondary">{event.duration}ms</div>
                            <Badge
                              variant={
                                event.status === 'success'
                                  ? 'success'
                                  : event.status === 'failed'
                                    ? 'danger'
                                    : 'warning'
                              }
                              className="text-xs"
                            >
                              {event.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Event Details */}
          <div>
            <Card className="border border-wl-border-default bg-wl-bg-surface sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Event Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedEvent ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-wl-text-secondary mb-1">Event ID</div>
                      <div className="text-xs font-mono bg-wl-bg-elevated p-2 rounded flex items-center justify-between">
                        <span className="truncate">{selectedEvent.id}</span>
                        <Copy
                          className="w-3 h-3 cursor-pointer hover:opacity-60 flex-shrink-0 ml-2"
                          onClick={() => navigator.clipboard.writeText(selectedEvent.id)}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-wl-text-secondary mb-1">Timestamp</div>
                      <div className="text-sm text-white">
                        {new Date(selectedEvent.timestamp).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-wl-text-secondary mb-1">Event Type</div>
                      <Badge variant="info">{selectedEvent.eventType}</Badge>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-wl-text-secondary mb-1">Endpoint</div>
                      <div className="text-xs text-wl-text-secondary break-all">{selectedEvent.endpointUrl}</div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-wl-text-secondary mb-1">Status</div>
                      <Badge
                        variant={
                          selectedEvent.status === 'success'
                            ? 'success'
                            : selectedEvent.status === 'failed'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {selectedEvent.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-semibold text-wl-text-secondary mb-1">Duration</div>
                        <div className="text-sm font-mono text-white">{selectedEvent.duration}ms</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-wl-text-secondary mb-1">Status Code</div>
                        <div className="text-sm font-mono text-white">{selectedEvent.statusCode ?? '—'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-semibold text-wl-text-secondary mb-1">Attempt</div>
                        <div className="text-sm font-mono text-white">
                          {selectedEvent.attempt}/{selectedEvent.maxAttempts}
                        </div>
                      </div>
                    </div>

                    {selectedEvent.error && (
                      <div>
                        <div className="text-xs font-semibold text-wl-text-secondary mb-1">Error</div>
                        <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded">
                          {selectedEvent.error}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-wl-border-default">
                      <Button className="w-full" variant="secondary" size="sm">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        View Payload
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-wl-text-secondary">Select an event to view details</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
