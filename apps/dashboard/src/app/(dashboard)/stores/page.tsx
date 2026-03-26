'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Store, Package, ShoppingCart, Zap, Globe, Settings } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';

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
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useApiQuery<ShopStats>('/api/v4/shops/me/stats');

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

  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      {/* Header */}
      <div className="px-6 py-8 border-b border-[#1e1e2e] flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Connected Stores</h1>
          <p className="text-gray-400 text-sm">Manage your connected e-commerce store</p>
        </div>
        <Button onClick={handleRefresh} variant="secondary" disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-[#12121a] border border-[#1e1e2e] animate-pulse h-24">{" "}</Card>
            ))}
          </div>
        ) : shopError ? (
          <Card className="bg-[#12121a] border border-[#1e1e2e] p-8 text-center mb-8">
            <p className="text-red-400 mb-4">Failed to load store data.</p>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>Retry</Button>
          </Card>
        ) : shop ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 mb-2 text-xs">Total Orders</p>
                      <p className="text-2xl font-bold text-white">
                        {stats?.orders.total?.toLocaleString() ?? shop._count?.orders?.toLocaleString() ?? '—'}
                      </p>
                    </div>
                    <ShoppingCart size={28} className="text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 mb-2 text-xs">Today's Orders</p>
                      <p className="text-2xl font-bold text-white">{stats?.orders.today ?? '—'}</p>
                    </div>
                    <Package size={28} className="text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 mb-2 text-xs">Active Drivers</p>
                      <p className="text-2xl font-bold text-white">{stats?.drivers.active ?? '—'}</p>
                    </div>
                    <Zap size={28} className="text-emerald-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-400 mb-2 text-xs">Active Zones</p>
                      <p className="text-2xl font-bold text-white">{stats?.zones.active ?? '—'}</p>
                    </div>
                    <Globe size={28} className="text-blue-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Store Card */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] max-w-lg">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <Store size={24} className="text-blue-500" />
                    <div>
                      <h3 className="text-base font-semibold text-white">{shop.name}</h3>
                      {shop.domain && <p className="text-gray-400 text-xs">{shop.domain}</p>}
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(shop.status)}>
                    {shop.status ?? 'Active'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-[#1e1e2e]">
                  <div>
                    <p className="text-gray-400 mb-1 text-xs">Platform</p>
                    <p className="text-white font-semibold capitalize">{shop.platform ?? 'Shopify'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 text-xs">In Transit</p>
                    <p className="text-white font-semibold">{stats?.orders.inTransit ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 text-xs">Pending Orders</p>
                    <p className="text-white font-semibold">{stats?.orders.pending ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 text-xs">Delivery Zones</p>
                    <p className="text-white font-semibold">{shop._count?.deliveryZones ?? stats?.zones.total ?? '—'}</p>
                  </div>
                </div>

                <Button variant="primary" size="sm" className="w-full flex items-center justify-center gap-2">
                  <Settings size={14} />
                  Store Settings
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
