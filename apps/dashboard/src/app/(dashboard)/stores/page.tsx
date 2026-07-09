'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Store, Package, ShoppingCart, Zap, Globe, Settings, MapPin } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useZonesGeoJson } from '@/hooks/use-zones-geojson';

const StoreZoneCoverageMap = dynamic(
  () => import('./components/store-zone-coverage-map').then((m) => m.StoreZoneCoverageMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center bg-wl-bg-sunken rounded-lg border border-wl-border-subtle">
        <div className="w-6 h-6 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  },
);

interface ShopProfile {
  id: string;
  name: string;
  domain?: string;
  platform?: string;
  status?: string;
  _count?: {
    orders: number;
    drivers: number;
    deliveryZones: number;
    routes: number;
  };
  createdAt: string;
}

interface ShopStats {
  orders: {
    total: number;
    today: number;
    pending: number;
    inTransit: number;
  };
  drivers: {
    total: number;
    active: number;
  };
  zones: {
    total: number;
    active: number;
  };
}

export default function StoresManagement() {
  const { data: shop, loading: shopLoading, error: shopError, refetch: refetchShop } = useApiQuery<ShopProfile>('/api/v4/shops/me');
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useApiQuery<ShopStats>('/api/v4/shops/me/stats');
  const { data: zonesGeoJson, loading: zonesLoading } = useZonesGeoJson();

  const loading = shopLoading || statsLoading;

  const handleRefresh = () => {
    refetchShop();
    refetchStats();
  };

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'default';
      default: return 'warning';
    }
  };

  if (shopError && !loading) {
    return (
      <div className="bg-wl-bg-root min-h-screen p-6">
        <ErrorState error={shopError} onRetry={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="bg-wl-bg-root min-h-screen">
      {/* Header */}
      <div className="px-6 py-8 border-b border-wl-border-default flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Connected Stores</h1>
          <p className="text-wl-text-secondary text-sm">Manage your connected e-commerce store</p>
        </div>
        <Button onClick={handleRefresh} variant="secondary" disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="p-6">
        {statsError && !statsLoading && shop && (
          <div className="mb-4 px-4 py-2 rounded-md bg-wl-warning-bg/20 border border-wl-warning-400/30 text-wl-warning-400 text-sm flex items-center justify-between">
            <span>Could not load store statistics. Some counts may be unavailable.</span>
            <button onClick={refetchStats} className="text-xs underline hover:no-underline">Retry</button>
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-wl-bg-surface border border-wl-border-default animate-pulse h-24">{" "}</Card>
            ))}
          </div>
        ) : shopError ? (
          <Card className="bg-wl-bg-surface border border-wl-border-default p-8 text-center mb-8">
            <p className="text-red-400 mb-4">Failed to load store data.</p>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>Retry</Button>
          </Card>
        ) : shop ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-wl-bg-surface border border-wl-border-default">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-wl-text-secondary mb-2 text-xs">Total Orders</p>
                      <p className="text-2xl font-bold text-white">
                        {stats?.orders.total?.toLocaleString() ?? shop._count?.orders?.toLocaleString() ?? '—'}
                      </p>
                    </div>
                    <ShoppingCart size={28} className="text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-wl-bg-surface border border-wl-border-default">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-wl-text-secondary mb-2 text-xs">Today's Orders</p>
                      <p className="text-2xl font-bold text-white">{stats?.orders.today ?? '—'}</p>
                    </div>
                    <Package size={28} className="text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-wl-bg-surface border border-wl-border-default">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-wl-text-secondary mb-2 text-xs">Active Drivers</p>
                      <p className="text-2xl font-bold text-white">{stats?.drivers.active ?? '—'}</p>
                    </div>
                    <Zap size={28} className="text-emerald-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-wl-bg-surface border border-wl-border-default">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-wl-text-secondary mb-2 text-xs">Active Zones</p>
                      <p className="text-2xl font-bold text-white">{stats?.zones.active ?? '—'}</p>
                    </div>
                    <Globe size={28} className="text-blue-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Store Card */}
            <Card className="bg-wl-bg-surface border border-wl-border-default max-w-lg">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <Store size={24} className="text-blue-500" />
                    <div>
                      <h3 className="text-base font-semibold text-white">{shop.name}</h3>
                      {shop.domain && <p className="text-wl-text-secondary text-xs">{shop.domain}</p>}
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(shop.status)}>
                    {shop.status ?? 'Active'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-wl-border-default">
                  <div>
                    <p className="text-wl-text-secondary mb-1 text-xs">Platform</p>
                    <p className="text-white font-semibold capitalize">{shop.platform ?? 'Shopify'}</p>
                  </div>
                  <div>
                    <p className="text-wl-text-secondary mb-1 text-xs">In Transit</p>
                    <p className="text-white font-semibold">{stats?.orders.inTransit ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-wl-text-secondary mb-1 text-xs">Pending Orders</p>
                    <p className="text-white font-semibold">{stats?.orders.pending ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-wl-text-secondary mb-1 text-xs">Delivery Zones</p>
                    <p className="text-white font-semibold">{shop._count?.deliveryZones ?? stats?.zones.total ?? '—'}</p>
                  </div>
                </div>

                <Button variant="primary" size="sm" className="w-full flex items-center justify-center gap-2">
                  <Settings size={14} />
                  Store Settings
                </Button>
              </CardContent>
            </Card>

            {/* Zone Coverage Map */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} className="text-wl-primary-400" />
                <h2 className="text-base font-semibold text-white">Zone Coverage</h2>
                {zonesLoading ? (
                  <span className="text-wl-text-tertiary text-xs">Loading…</span>
                ) : (
                  <span className="text-wl-text-secondary text-xs">
                    {zonesGeoJson?.features.length ?? 0} delivery zone{(zonesGeoJson?.features.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {zonesLoading ? (
                <div className="h-64 rounded-lg overflow-hidden border border-wl-border-subtle">
                  <LoadingSkeleton className="h-full" />
                </div>
              ) : zonesGeoJson ? (
                <StoreZoneCoverageMap zones={zonesGeoJson} />
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
