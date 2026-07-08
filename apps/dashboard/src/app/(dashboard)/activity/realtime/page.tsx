'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Package, Car, CheckCircle, Zap, LogIn, Pause, Play, Filter, RotateCcw } from 'lucide-react';

interface RealtimeEvent {
  id: string;
  type: 'order.created' | 'driver.assigned' | 'delivery.completed' | 'webhook.fired' | 'user.login';
  actor: string;
  description: string;
  timestamp: string;
  data?: Record<string, any>;
  status: 'success' | 'pending' | 'failed';
}

export default function RealtimePage() {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  const { items: events, loading, error, refetch } = useApiList<RealtimeEvent>(
    '/api/v4/activity-logs?view=realtime'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  const filtered = selectedType === 'all'
    ? events
    : events.filter((e) => e.type === selectedType);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'order.created':
        return <Package className="w-4 h-4" />;
      case 'driver.assigned':
        return <Car className="w-4 h-4" />;
      case 'delivery.completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'webhook.fired':
        return <Zap className="w-4 h-4" />;
      case 'user.login':
        return <LogIn className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'danger';
      default:
        return 'warning';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-root">
      <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Realtime Activity</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Live event feed</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isPaused ? 'secondary' : 'primary'}
                size="md"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="secondary" size="md" onClick={() => refetch()}>
                <RotateCcw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-6 overflow-x-auto">
            {['all', 'order.created', 'driver.assigned', 'delivery.completed', 'webhook.fired', 'user.login'].map((type) => {
              const count = type === 'all'
                ? events.length
                : events.filter((e) => e.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    selectedType === type
                      ? 'bg-blue-500 text-white'
                      : 'bg-wl-bg-elevated text-wl-text-secondary'
                  )}
                >
                  {type === 'all' ? 'All' : type.replace('.', ' ')} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-3 max-w-4xl">
          {filtered.length === 0 ? (
            <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
              <p className="text-wl-text-secondary">No events</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-4 bg-wl-bg-surface border border-wl-border-default rounded-md hover:border-wl-border-strong transition-colors"
                >
                  <div className="mt-1 text-wl-text-secondary">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-white break-words">{event.actor}</p>
                      <Badge variant={getStatusBadgeVariant(event.status) as any}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-wl-text-secondary break-words">{event.description}</p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
