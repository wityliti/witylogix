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

      <div className="p-6 bg-wl-bg-root space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Providers', value: stats.total, icon: Route, color: 'text-blue-400' },
            { label: 'Healthy', value: stats.healthy, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'With Errors', value: stats.errors, icon: AlertCircle, color: 'text-red-400' },
            { label: 'API Calls (30d)', value: stats.apiCalls.toLocaleString(), icon: Clock, color: 'text-wl-text-primary' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="bg-wl-bg-surface border-wl-border-default">
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={cn('w-5 h-5 shrink-0', s.color)} />
                  <div>
                    <p className="text-xs text-wl-text-muted">{s.label}</p>
                    <p className="text-xl font-bold text-wl-text-primary">{s.value}</p>
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
                    "w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm outline-none"
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
                    "w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm outline-none"
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
                      className={cn("w-4 h-4 rounded border-[#1e1e2e]")}
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
                    <Card key={pid} className={cn("bg-[#12121a] border-[#1e1e2e]")}>
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
              <div className={cn("py-8 text-center text-gray-500 text-sm bg-[#12121a] rounded border border-[#1e1e2e]")}>
                Select providers above and click Compare Routes to see results.
              </div>
            )}
          </div>
        </Card>

        {!loading && installed.length === 0 && !error && (
          <Card>
            <div className={cn('p-8 text-center space-y-3')}>
              <p className={cn('text-gray-300 font-medium')}>No routing providers installed</p>
              <p className={cn('text-xs text-gray-500')}>
                Select a provider from the catalog above and click Install to get started.
              </p>
              <Button variant="primary" size="sm">Browse Catalog</Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
