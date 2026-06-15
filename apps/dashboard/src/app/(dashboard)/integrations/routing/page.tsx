'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/loading-skeleton';

/* ═══════════════════════════════════════════════════════════
   ROUTING PROVIDER CONFIGURATION PAGE
   Data: GET /api/v4/integrations/marketplace?category=ROUTING
   ═══════════════════════════════════════════════════════════ */

interface RoutingProvider {
  slug: string;
  name: string;
  description: string;
  capabilities: string[];
  status: 'AVAILABLE' | 'COMING_SOON' | 'BETA' | 'DEPRECATED';
  installed: boolean;
  isEnabled: boolean;
  healthStatus: string | null;
  authType: string;
}

interface MarketplaceResponse {
  apps: RoutingProvider[];
}

function providerStatus(p: RoutingProvider): 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'NOT_INSTALLED' {
  if (!p.installed) return 'NOT_INSTALLED';
  if (!p.isEnabled) return 'INACTIVE';
  if (p.healthStatus === 'DOWN' || p.healthStatus === 'DEGRADED') return 'ERROR';
  return 'ACTIVE';
}

function StatusBadge({ p }: { p: RoutingProvider }) {
  const st = providerStatus(p);
  const variants: Record<string, 'success' | 'default' | 'danger' | 'warning'> = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    ERROR: 'danger',
    NOT_INSTALLED: 'warning',
  };
  const labels: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Disabled',
    ERROR: p.healthStatus ?? 'Error',
    NOT_INSTALLED: p.status === 'COMING_SOON' ? 'Coming Soon' : 'Not Installed',
  };
  return <Badge variant={variants[st]}>{labels[st]}</Badge>;
}

function ProviderCardSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton type="text" className="w-32 h-5" />
        <Skeleton type="text" className="w-20 h-5" />
      </div>
      <Skeleton type="text" className="w-full h-4" />
      <Skeleton type="text" className="w-2/3 h-4" />
    </Card>
  );
}

export default function RoutingPage() {
  const [providers, setProviders] = useState<RoutingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get<MarketplaceResponse>('/api/v4/integrations/marketplace?category=ROUTING')
      .then((res) => {
        if (!cancelled) {
          setProviders(Array.isArray(res?.apps) ? res.apps : []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const selected = providers.find((p) => p.slug === selectedSlug) ?? null;
  const installed = providers.filter((p) => p.installed);
  const active = installed.filter((p) => p.isEnabled && p.healthStatus !== 'DOWN' && p.healthStatus !== 'DEGRADED');
  const errors = installed.filter((p) => p.healthStatus === 'DOWN' || p.healthStatus === 'DEGRADED');

  return (
    <>
      <Header
        title="Routing Providers"
        subtitle="Configure and monitor route optimization providers"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn('p-6 bg-wl-bg-root space-y-6')}>
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

            <div className={cn('grid grid-cols-1 gap-3')}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <ProviderCardSkeleton key={i} />)
                : providers.length === 0
                  ? (
                    <Card className="p-8 text-center">
                      <p className={cn('text-gray-400 text-sm')}>No routing providers found.</p>
                    </Card>
                  )
                  : providers.map((provider) => (
                    <Card
                      key={provider.slug}
                      className={cn(
                        'cursor-pointer transition-all hover:border-blue-400',
                        selectedSlug === provider.slug && 'border-blue-500 bg-wl-bg-surface',
                      )}
                      onClick={() => setSelectedSlug(selectedSlug === provider.slug ? null : provider.slug)}
                    >
                      <div className={cn('p-4')}>
                        <div className={cn('flex items-start justify-between mb-2')}>
                          <div>
                            <h3 className={cn('font-semibold text-white')}>{provider.name}</h3>
                            <p className={cn('text-xs text-gray-400 mt-0.5')}>{provider.authType}</p>
                          </div>
                          <StatusBadge p={provider} />
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
                  <div className={cn('p-4 pt-0 space-y-4')}>
                    <p className={cn('text-sm text-gray-300')}>{selected.description}</p>

                    <div>
                      <label className={cn('text-xs font-semibold text-gray-400 block mb-1')}>
                        Auth Type
                      </label>
                      <div className={cn('bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-gray-300')}>
                        {selected.authType}
                      </div>
                    </div>

                    <div>
                      <label className={cn('text-xs font-semibold text-gray-400 block mb-1')}>
                        Catalog Status
                      </label>
                      <div className={cn('bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-gray-300')}>
                        {selected.status}
                      </div>
                    </div>

                    {selected.healthStatus && (
                      <div>
                        <label className={cn('text-xs font-semibold text-gray-400 block mb-1')}>
                          Health
                        </label>
                        <div className={cn('bg-wl-bg-elevated rounded px-3 py-2 text-sm font-mono text-gray-300')}>
                          {selected.healthStatus}
                        </div>
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
                </Card>

                {selected.installed && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Actions</CardTitle>
                    </CardHeader>
                    <div className={cn('p-4 pt-0 space-y-2')}>
                      <Button
                        variant={selected.isEnabled ? 'danger' : 'primary'}
                        size="sm"
                        className="w-full"
                      >
                        {selected.isEnabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full">
                        Uninstall
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <div className={cn('p-8 text-center')}>
                  <p className={cn('text-gray-300 text-sm')}>Select a provider to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Installed Providers Chain */}
        {!loading && installed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Installed Providers</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <p className={cn('text-sm text-gray-300 mb-4')}>
                Currently installed routing providers for this account.
              </p>
              <div className={cn('space-y-2')}>
                {installed.map((provider, idx) => (
                  <div
                    key={provider.slug}
                    className={cn('flex items-center gap-3 p-3 bg-wl-bg-surface rounded border border-wl-border-default')}
                  >
                    <div className={cn('flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold')}>
                      {idx + 1}
                    </div>
                    <div className={cn('flex-1')}>
                      <p className={cn('font-semibold text-white')}>{provider.name}</p>
                      <p className={cn('text-xs text-gray-400')}>
                        {provider.healthStatus ?? (provider.isEnabled ? 'Enabled' : 'Disabled')}
                      </p>
                    </div>
                    <StatusBadge p={provider} />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

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
