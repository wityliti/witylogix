'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Package,
  Zap,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Plug,
} from 'lucide-react';

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

interface ApiIntegration {
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  logoUrl: string | null;
  isEnabled: boolean;
  healthStatus: string | null;
  lastSyncAt: string | null;
  lastHealthCheckAt: string | null;
}

interface ApiIntegrationsResponse {
  integrations: ApiIntegration[];
}

interface IntegrationHealthItem {
  slug: string;
  name: string;
  category: string;
  status: HealthStatus;
  lastCheck: Date | null;
  isEnabled: boolean;
  checkInProgress: boolean;
}

function mapHealthStatus(raw: string | null): HealthStatus {
  if (!raw) return 'unknown';
  const s = raw.toUpperCase();
  if (s === 'HEALTHY' || s === 'OK') return 'healthy';
  if (s === 'DEGRADED' || s === 'WARNING') return 'degraded';
  if (s === 'ERROR' || s === 'DOWN' || s === 'UNHEALTHY') return 'down';
  return 'unknown';
}

export default function IntegrationHealthPage() {
  const { data, loading, error, refetch } = useApiQuery<ApiIntegrationsResponse>('/api/v4/integrations');

  const [items, setItems] = useState<IntegrationHealthItem[]>([]);
  const [refreshingSlug, setRefreshingSlug] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (data?.integrations) {
      setItems(
        data.integrations.map((i) => ({
          slug: i.slug,
          name: i.name,
          category: i.category,
          status: mapHealthStatus(i.healthStatus),
          lastCheck: i.lastHealthCheckAt ? new Date(i.lastHealthCheckAt) : null,
          isEnabled: i.isEnabled,
          checkInProgress: false,
        })),
      );
    }
  }, [data]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => { refetch(); }, 60_000);
    return () => clearInterval(timer);
  }, [autoRefresh, refetch]);

  const handleCheckNow = useCallback(async (slug: string) => {
    setRefreshingSlug(slug);
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, checkInProgress: true } : i)),
    );
    try {
      const res = await fetch(`/api/v4/integrations/${slug}/test`, { method: 'POST' });
      const json = await res.json();
      const newStatus = json.healthy ? 'healthy' : 'down';
      setItems((prev) =>
        prev.map((i) =>
          i.slug === slug
            ? { ...i, status: newStatus as HealthStatus, lastCheck: new Date(), checkInProgress: false }
            : i,
        ),
      );
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.slug === slug ? { ...i, checkInProgress: false } : i)),
      );
    } finally {
      setRefreshingSlug(null);
    }
  }, []);

  const handleCheckAll = useCallback(() => {
    items.forEach((i) => handleCheckNow(i.slug));
  }, [items, handleCheckNow]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const healthyCount = items.filter((i) => i.status === 'healthy').length;
  const degradedCount = items.filter((i) => i.status === 'degraded').length;
  const downCount = items.filter((i) => i.status === 'down').length;

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'down': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return 'success' as const;
      case 'degraded': return 'warning' as const;
      case 'down': return 'danger' as const;
      default: return 'default' as const;
    }
  };

  const getStatusLabel = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return 'Healthy';
      case 'degraded': return 'Degraded';
      case 'down': return 'Down';
      default: return 'Unknown';
    }
  };

  return (
    <>
      <Header
        title="Integration Health"
        subtitle="Real-time status and monitoring of connected integrations"
        actions={
          <div className={cn('flex items-center gap-2')}>
            <label className={cn('flex items-center gap-2 cursor-pointer text-sm')}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className={cn('w-4 h-4 cursor-pointer')}
              />
              <span className={cn('text-gray-400')}>Auto-refresh</span>
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCheckAll}
              disabled={refreshingSlug !== null || items.length === 0}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', refreshingSlug && 'animate-spin')} />
              Check All
            </Button>
          </div>
        }
      />

      <div className={cn('p-6 space-y-6')}>
        {/* Overall Health Summary */}
        <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4')}>
          <Card className={cn('bg-gradient-to-br from-emerald-500/10 to-emerald-500/5')}>
            <CardContent className={cn('pt-6')}>
              <div className={cn('flex items-center justify-between')}>
                <div>
                  <p className={cn('text-sm text-gray-500 mb-1')}>Healthy</p>
                  <p className={cn('text-3xl font-bold text-emerald-500')}>{healthyCount}</p>
                </div>
                <CheckCircle className={cn('w-10 h-10 text-emerald-500/40')} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn('bg-gradient-to-br from-amber-500/10 to-amber-500/5')}>
            <CardContent className={cn('pt-6')}>
              <div className={cn('flex items-center justify-between')}>
                <div>
                  <p className={cn('text-sm text-gray-500 mb-1')}>Degraded</p>
                  <p className={cn('text-3xl font-bold text-amber-500')}>{degradedCount}</p>
                </div>
                <AlertTriangle className={cn('w-10 h-10 text-amber-500/40')} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn('bg-gradient-to-br from-red-500/10 to-red-500/5')}>
            <CardContent className={cn('pt-6')}>
              <div className={cn('flex items-center justify-between')}>
                <div>
                  <p className={cn('text-sm text-gray-500 mb-1')}>Down</p>
                  <p className={cn('text-3xl font-bold text-red-500')}>{downCount}</p>
                </div>
                <AlertCircle className={cn('w-10 h-10 text-red-500/40')} />
              </div>
            </CardContent>
          </Card>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<Plug className="w-8 h-8" />}
            title="No integrations connected"
            description="Connect integrations from the marketplace to monitor their health here."
            action={{ label: 'Browse Marketplace', onClick: () => { window.location.href = '/integrations'; } }}
          />
        ) : (
          <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4')}>
            {items.map((integration) => (
              <Card
                key={integration.slug}
                className={cn(
                  'hover:border-[#1e1e2e] transition-colors',
                  integration.status === 'healthy' && 'border-emerald-500/20',
                  integration.status === 'degraded' && 'border-amber-500/20',
                  integration.status === 'down' && 'border-red-500/20',
                  !integration.isEnabled && 'opacity-60',
                )}
              >
                <CardContent className={cn('pt-6 space-y-4')}>
                  {/* Header */}
                  <div className={cn('flex items-start justify-between')}>
                    <div className={cn('flex items-center gap-3 flex-1')}>
                      <div
                        className={cn(
                          'p-2 rounded-md',
                          integration.status === 'healthy' && 'bg-emerald-500/10 text-emerald-500',
                          integration.status === 'degraded' && 'bg-amber-500/10 text-amber-500',
                          integration.status === 'down' && 'bg-red-500/10 text-red-500',
                          integration.status === 'unknown' && 'bg-gray-500/10 text-gray-500',
                        )}
                      >
                        <Package className="w-6 h-6" />
                      </div>
                      <div className={cn('flex-1 min-w-0')}>
                        <h3 className={cn('font-semibold text-white text-sm truncate')}>
                          {integration.name}
                        </h3>
                        <p className={cn('text-xs text-gray-500 truncate')}>
                          {integration.category.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    {getStatusIcon(integration.status)}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(integration.status)} dot>
                      {getStatusLabel(integration.status)}
                    </Badge>
                    {!integration.isEnabled && (
                      <Badge variant="default">Disabled</Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className={cn('space-y-2')}>
                    <div className={cn('flex items-center justify-between text-xs')}>
                      <span className={cn('text-gray-500')}>Last Check</span>
                      <span className={cn('text-gray-400 font-medium')}>
                        {integration.lastCheck
                          ? integration.lastCheck.toLocaleTimeString()
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Check Now Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCheckNow(integration.slug)}
                    disabled={refreshingSlug === integration.slug || integration.checkInProgress}
                    className={cn('w-full')}
                  >
                    <RefreshCw
                      className={cn(
                        'w-3 h-3 mr-2',
                        (refreshingSlug === integration.slug || integration.checkInProgress) && 'animate-spin',
                      )}
                    />
                    {refreshingSlug === integration.slug ? 'Checking…' : 'Check Now'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {autoRefresh && (
          <div
            className={cn(
              'fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded-lg text-sm text-gray-400',
            )}
          >
            <Clock className="w-4 h-4" />
            <span>Auto-refreshing every 60 seconds</span>
          </div>
        )}
      </div>
    </>
  );
}
