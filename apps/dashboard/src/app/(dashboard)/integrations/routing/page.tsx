'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Route, CheckCircle2, AlertCircle, Clock, RefreshCw, Plus } from 'lucide-react';

interface IntegrationConnection {
  id: string;
  providerName: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number;
  category: string;
}

function statusVariant(s: string): 'success' | 'danger' | 'warning' | 'default' {
  if (s === 'connected') return 'success';
  if (s === 'error') return 'danger';
  if (s === 'pending') return 'warning';
  return 'default';
}

function timeSince(iso?: string) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RoutingIntegrationsPage() {
  const { items, loading, error, refetch } = useApiList<IntegrationConnection>(
    '/api/v4/integrations/connections?category=routing',
    { limit: 100 },
  );

  const stats = useMemo(() => ({
    total: items.length,
    healthy: items.filter((i) => i.status === 'connected').length,
    errors: items.filter((i) => i.status === 'error').length,
    apiCalls: items.reduce((s, i) => s + i.apiCallsCount, 0),
  }), [items]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

  const [comparisonResults, setComparisonResults] = useState<
    Record<string, { distance: string; duration: string; eta: string }> | null
  >(null);

  const selected = providers.find((p) => p.slug === selectedSlug) ?? null;
  const installed = providers.filter((p) => p.installed);
  const active = installed.filter((p) => p.isEnabled && p.healthStatus !== 'DOWN' && p.healthStatus !== 'DEGRADED');
  const errors = installed.filter((p) => p.healthStatus === 'DOWN' || p.healthStatus === 'DEGRADED');

  return (
    <>
      <Header
        title="Routing Integrations"
        subtitle="Manage route optimization and navigation providers"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Link href="/integrations/marketplace?category=ROUTING">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add Provider
              </Button>
            </Link>
          </div>
        }
      />

      <div className={cn("p-6 bg-wl-bg-root space-y-6")}>
        {/* Overview Cards */}
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card>
            <CardHeader><CardTitle className="text-sm">Total Providers</CardTitle></CardHeader>
            <div className={cn('p-4 pt-0')}>
              {loading ? <Skeleton type="text" className="w-16 h-8" /> : (
                <div className={cn('text-2xl font-bold text-white')}>{providers.length}</div>
              )}
              <p className={cn('text-xs text-gray-300 mt-1')}>in catalog</p>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Installed</CardTitle></CardHeader>
            <div className={cn('p-4 pt-0')}>
              {loading ? <Skeleton type="text" className="w-16 h-8" /> : (
                <div className={cn('text-2xl font-bold text-white')}>{installed.length}</div>
              )}
              <p className={cn('text-xs text-gray-300 mt-1')}>connected</p>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Active</CardTitle></CardHeader>
            <div className={cn('p-4 pt-0')}>
              {loading ? <Skeleton type="text" className="w-16 h-8" /> : (
                <div className={cn('text-2xl font-bold text-emerald-400')}>{active.length}</div>
              )}
              <p className={cn('text-xs text-gray-300 mt-1')}>healthy</p>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Errors</CardTitle></CardHeader>
            <div className={cn('p-4 pt-0')}>
              {loading ? <Skeleton type="text" className="w-16 h-8" /> : (
                <div className={cn('text-2xl font-bold', errors.length > 0 ? 'text-amber-500' : 'text-white')}>
                  {errors.length}
                </div>
              )}
              <p className={cn('text-xs text-gray-300 mt-1')}>degraded</p>
            </div>
          </Card>
        </div>

        {error && (
          <ErrorState
            title="Failed to load routing providers"
            error={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              api.get<MarketplaceResponse>('/api/v4/integrations/marketplace?category=ROUTING')
                .then((res) => setProviders(Array.isArray(res?.apps) ? res.apps : []))
                .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
                .finally(() => setLoading(false));
            }}
          />
        )}

        <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-6')}>
          {/* Provider Grid */}
          <div className={cn('lg:col-span-2 space-y-4')}>
            <div className={cn('flex items-center justify-between')}>
              <h2 className={cn('text-lg font-semibold text-white')}>Provider Catalog</h2>
              <div className={cn('flex gap-2')}>
                <Button variant="secondary" size="sm">
                  Health Check All
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setLoading(true);
                    api.get<MarketplaceResponse>('/api/v4/integrations/marketplace?category=ROUTING')
                      .then((res) => setProviders(Array.isArray(res?.apps) ? res.apps : []))
                      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
                      .finally(() => setLoading(false));
                  }}
                >
                  Refresh
                </Button>
              </div>
            </div>

            <div className={cn("grid grid-cols-1 gap-3")}>
              {ROUTING_PROVIDERS.map((provider) => (
                <Card
                  key={provider.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-blue-400",
                    selectedProvider === provider.id && "border-blue-500 bg-wl-bg-surface"
                  )}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div>
                        <h3 className={cn("font-semibold text-white")}>{provider.name}</h3>
                        <p className={cn("text-xs text-gray-300")}>Priority: #{provider.fallbackPriority}</p>
                      </div>
                      <StatusBadge status={provider.status} />
                    </div>

                    <div className={cn("grid grid-cols-4 gap-3 mb-3")}>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Last Check</p>
                        <p className={cn("text-sm font-semibold text-white")}>{provider.lastHealthCheck}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Avg Latency</p>
                        <p className={cn("text-sm font-semibold text-white")}>{provider.avgLatency}ms</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Requests/Day</p>
                        <p className={cn("text-sm font-semibold text-white")}>{(provider.requestsPerDay / 1000).toFixed(1)}k</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Trend</p>
                        <div className={cn("h-8 mt-1")}>
                          <Sparkline data={provider.healthHistory} />
                        </div>

                        <p className={cn('text-xs text-gray-300 mb-3 line-clamp-2')}>{provider.description}</p>

                        {provider.capabilities.length > 0 && (
                          <div className={cn('flex flex-wrap gap-1')}>
                            {provider.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className={cn('text-[10px] px-1.5 py-0.5 rounded bg-wl-bg-elevated border border-wl-border-default text-gray-400')}
                              >
                                {cap.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className={cn('space-y-4')}>
            {selected ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{selected.name}</CardTitle>
                  </CardHeader>
                  <div className={cn("p-4 pt-0 space-y-4")}>
                    <div>
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        API Key
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-gray-300")}>
                        {selected.apiKey}
                      </div>
                      <Button variant="ghost" size="sm" className="mt-2 w-full">
                        Change Key
                      </Button>
                    </div>

                    <div>
                      <label className={cn('text-xs font-semibold text-gray-400 block mb-1')}>
                        Auth Type
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-gray-300 break-all")}>
                        {selected.baseUrl}
                      </div>
                    </div>

                    <div>
                      <label className={cn('text-xs font-semibold text-gray-400 block mb-1')}>
                        Catalog Status
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-gray-300")}>
                        {selected.rateLimit.toLocaleString()} req/hour
                      </div>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        Fallback Priority
                      </label>
                      <div className={cn("bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-gray-300")}>
                        #{selected.fallbackPriority} of {ROUTING_PROVIDERS.length}
                      </div>
                    )}

                    <div className={cn('flex gap-2')}>
                      <Button variant="secondary" size="sm" className="flex-1">
                        {selected.installed ? 'Test Connection' : 'Install'}
                      </Button>
                      {selected.installed && (
                        <Button variant="ghost" size="sm" className="flex-1">
                          Configure
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Route Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Route Comparison Tool</CardTitle>
          </CardHeader>
          <div className={cn("p-4 pt-0")}>
            <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 mb-4")}>
              <div>
                <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                  Origin
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                  )}
                />
              </div>
              <div>
                <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                  Destination
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                  )}
                />
              </div>
            </div>

            <div className={cn("flex gap-2 mb-4 flex-wrap items-center justify-between")}>
              <div className={cn("flex gap-2 flex-wrap")}>
                {["mapbox", "osrm", "valhalla", "google"].map((pid) => (
                  <label key={pid} className={cn("flex items-center gap-2")}>
                    <input
                      type="checkbox"
                      checked={compareProviders.includes(pid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCompareProviders([...compareProviders, pid]);
                        } else {
                          setCompareProviders(compareProviders.filter((p) => p !== pid));
                        }
                      }}
                      className={cn("w-4 h-4 rounded border-wl-border-default")}
                    />
                    <span className={cn("text-sm text-white")}>
                      {ROUTING_PROVIDERS.find((p) => p.id === pid)?.name}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setComparisonResults(null)}
                disabled
              >
                Compare Routes
              </Button>
            </div>

            {comparisonResults ? (
              <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
                {compareProviders.map((pid) => {
                  const provider = ROUTING_PROVIDERS.find((p) => p.id === pid);
                  const comparison = comparisonResults[pid];
                  if (!provider || !comparison) return null;

                  return (
                    <Card key={pid} className={cn("bg-wl-bg-surface border-wl-border-default")}>
                      <div className={cn("p-3")}>
                        <h4 className={cn("font-semibold text-white mb-3")}>{provider.name}</h4>
                        <div className={cn("space-y-2 text-sm")}>
                          <div>
                            <p className={cn("text-xs text-gray-300")}>Distance</p>
                            <p className={cn("font-semibold text-white")}>{comparison.distance}</p>
                          </div>
                          <div>
                            <p className={cn("text-xs text-gray-300")}>Duration</p>
                            <p className={cn("font-semibold text-white")}>{comparison.duration}</p>
                          </div>
                          <div>
                            <p className={cn("text-xs text-gray-300")}>ETA</p>
                            <p className={cn("font-semibold text-white")}>{comparison.eta}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className={cn("py-8 text-center text-gray-500 text-sm bg-wl-bg-surface rounded border border-wl-border-default")}>
                Select providers above and click Compare Routes to see results.
              </div>
            )}
          </div>
        </Card>

        {/* Fallback Chain */}
        <Card>
          <CardHeader>
            <CardTitle>Fallback Priority Chain</CardTitle>
          </CardHeader>
          <div className={cn("p-4 pt-0")}>
            <p className={cn("text-sm text-gray-300 mb-4")}>
              Drag to reorder providers. If the primary provider fails, requests will be routed to the next in the chain.
            </p>
            <div className={cn("space-y-2")}>
              {sortedByPriority.map((provider, idx) => (
                <div key={provider.id} className={cn("flex items-center gap-3 p-3 bg-wl-bg-surface rounded border border-wl-border-default")}>
                  <div className={cn("flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold")}>
                    {idx + 1}
                  </div>
                  <div className={cn("flex-1")}>
                    <p className={cn("font-semibold text-white")}>{provider.name}</p>
                    <p className={cn("text-xs text-gray-300")}>{provider.status} · {provider.avgLatency}ms avg</p>
                  </div>
                  <StatusBadge status={provider.status} />
                  <Button variant="ghost" size="sm" className="text-gray-300">
                    ⋮
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
