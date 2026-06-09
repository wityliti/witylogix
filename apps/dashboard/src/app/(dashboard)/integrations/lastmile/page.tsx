'use client';

import { useState, useMemo } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════
   LAST-MILE DELIVERY INTEGRATION PAGE — Courier partner mgmt
   ═══════════════════════════════════════════════════════════ */

interface CourierPartner {
  id: string;
  provider: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'ERROR' | 'UNKNOWN';
  lastSyncAt: string | null;
  lastError: string | null;
}

interface PartnerStat {
  provider: string;
  activeDeliveries: number;
  totalDeliveries: number;
  successRate: number | null;
}

interface OverallStats {
  total: number;
  delivered: number;
  failed: number;
  cancelled: number;
  pending: number;
  successRate: string;
  averageCost: number | null;
}

interface CourierDelivery {
  id: string;
  externalId: string;
  status: 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  driverName: string | null;
  driverPhone: string | null;
  trackingUrl: string | null;
  actualCost: number | null;
  quote: { price?: number; estimatedMinutes?: number; distanceKm?: number } | null;
  createdAt: string;
  deliveredAt: string | null;
  partner: { name: string; provider: string };
}

interface Driver {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'ON_ROUTE' | 'OFFLINE' | 'ON_BREAK';
  vehicleType: string | null;
  lastLocationAt: string | null;
  _count: { orders: number };
}

const getDeliveryStatusVariant = (status: string): 'success' | 'warning' | 'default' | 'info' | 'danger' => {
  switch (status) {
    case 'DELIVERED': return 'success';
    case 'IN_TRANSIT': case 'PICKED_UP': return 'warning';
    case 'PENDING': return 'info';
    case 'FAILED': case 'CANCELLED': return 'danger';
    default: return 'default';
  }
};

const getDriverStatusVariant = (status: string): 'success' | 'warning' | 'default' | 'danger' => {
  switch (status) {
    case 'AVAILABLE': return 'success';
    case 'ON_ROUTE': return 'warning';
    case 'OFFLINE': return 'danger';
    default: return 'default';
  }
};

const getHealthVariant = (h: string): 'success' | 'warning' | 'danger' | 'default' => {
  switch (h) {
    case 'HEALTHY': return 'success';
    case 'DEGRADED': return 'warning';
    case 'ERROR': return 'danger';
    default: return 'default';
  }
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatRelative = (isoStr: string): string => {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type DeliveryStatusFilter = 'all' | 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED';
type DriverStatusFilter = 'all' | 'AVAILABLE' | 'ON_ROUTE' | 'OFFLINE';

export default function LastMileIntegrationPage() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryStatusFilter>('all');
  const [driverFilter, setDriverFilter] = useState<DriverStatusFilter>('all');

  const { data: partners, loading: partnersLoading, error: partnersError, refetch: refetchPartners } =
    useApiQuery<CourierPartner[]>('/api/v4/couriers/partners');

  const { data: partnerStatsData, loading: statsLoading } =
    useApiQuery<{ stats: PartnerStat[] }>('/api/v4/couriers/partner-stats');

  const { data: overallStats, loading: overallLoading } =
    useApiQuery<OverallStats>('/api/v4/couriers/stats');

  const deliveriesUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: '30' });
    if (deliveryFilter !== 'all') params.set('status', deliveryFilter);
    return `/api/v4/couriers/deliveries?${params}`;
  }, [deliveryFilter]);

  const { data: deliveries, loading: deliveriesLoading, error: deliveriesError } =
    useApiQuery<CourierDelivery[]>(deliveriesUrl);

  const driversUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: '10' });
    if (driverFilter !== 'all') params.set('status', driverFilter);
    return `/api/v4/drivers?${params}`;
  }, [driverFilter]);

  const { data: drivers, loading: driversLoading } =
    useApiQuery<Driver[]>(driversUrl);

  // Merge partner stats by provider
  const statsByProvider = useMemo(() => {
    const map: Record<string, PartnerStat> = {};
    for (const s of partnerStatsData?.stats ?? []) {
      map[s.provider] = s;
    }
    return map;
  }, [partnerStatsData]);

  const connectedCount = (partners ?? []).filter(p => p.isEnabled).length;
  const totalActiveDeliveries = (partnerStatsData?.stats ?? []).reduce(
    (sum, s) => sum + s.activeDeliveries, 0
  );

  const isLoading = partnersLoading || overallLoading;

  if (partnersError && !isLoading) {
    return (
      <>
        <Header title="Last-Mile Delivery" subtitle="Courier partner management and delivery tracking" />
        <div className="p-6">
          <ErrorState error={partnersError} onRetry={refetchPartners} />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Last-Mile Delivery"
        subtitle={`${connectedCount} couriers · ${overallStats?.total ?? 0} total deliveries`}
        actions={
          <Button variant="primary" size="md">
            + Add Courier
          </Button>
        }
      />

      <div className="p-6 bg-wl-bg-root min-h-screen">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Providers Connected"
            value={connectedCount}
            isLoading={isLoading}
            accentColor="#3b82f6"
            index={0}
          />
          <StatCard
            label="Total Deliveries"
            value={overallStats?.total ?? 0}
            isLoading={isLoading}
            accentColor="#10b981"
            index={1}
          />
          <StatCard
            label="Success Rate"
            value={overallStats?.successRate ?? '—'}
            isLoading={isLoading}
            accentColor="#f59e0b"
            index={2}
          />
          <StatCard
            label="Active Now"
            value={totalActiveDeliveries}
            isLoading={statsLoading}
            accentColor="#60a5fa"
            index={3}
          />
        </div>

        {/* Courier Partner Cards */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
            Courier Partners
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {DELIVERY_PROVIDERS.map((provider) => (
              <Card
                key={provider.id}
                hover
                onClick={() => setSelectedProvider(provider.id)}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedProvider === provider.id && "ring-2 ring-blue-500"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                      {provider.logo}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {provider.name}
                      </h3>
                      <Badge variant="success">● {provider.status}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-gray-400 mb-3">
                  <div className="flex justify-between">
                    <span>Deliveries Today:</span>
                    <span className="text-white font-semibold">
                      {provider.deliveriesToday}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(provider.revenueToday)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission:</span>
                    <span className="text-white font-semibold">
                      {provider.commissionsPercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>On-Time Rate:</span>
                    <span className="text-emerald-500 font-semibold">
                      {provider.onTimeDeliveryRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Delivery Time:</span>
                    <span className="text-white font-semibold">
                      {provider.averageDeliveryTime}m
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Settings
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Delivery Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="p-3 text-left font-semibold text-gray-400">
                      Provider
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      On-Time %
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Avg Time (mins)
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Rating
                    </th>
                    <th className="p-3 text-right font-semibold text-gray-400">
                      Cost per Delivery
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PERFORMANCE_METRICS.map((metric, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        "border-b border-wl-border-default",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-elevated/30"
                      )}
                    >
                      <td className="p-3 text-white font-semibold">
                        {metric.provider}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="success">{metric.onTimePercent}%</Badge>
                      </td>
                      <td className="p-3 text-center text-white font-semibold">
                        {metric.avgDeliveryTime}
                      </td>
                      <td className="p-3 text-center text-white font-semibold">
                        {metric.customerRating} ⭐
                      </td>
                      <td className="p-3 text-right text-white font-semibold">
                        {formatCurrency(metric.costPerDelivery)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (partners ?? []).length === 0 ? (
            <Card>
              <CardContent>
                <div className="py-8 text-center text-gray-400 text-sm">
                  No courier partners configured. Add a courier to start dispatching deliveries.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {(partners ?? []).map((partner) => {
                const stats = statsByProvider[partner.provider];
                return (
                  <Card
                    key={partner.id}
                    hover
                    onClick={() => setSelectedPartnerId(
                      selectedPartnerId === partner.id ? null : partner.id
                    )}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold rounded border capitalize transition-all",
                      deliveryFilterStatus === status
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-transparent text-gray-400 border-wl-border-default"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 uppercase">
                          {partner.provider.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{partner.name}</h3>
                          <Badge variant={getHealthVariant(partner.healthStatus)}>
                            ● {partner.healthStatus.toLowerCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-gray-400 mb-3">
                      <div className="flex justify-between">
                        <span>Active Deliveries:</span>
                        <span className="text-white font-semibold">
                          {stats?.activeDeliveries ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Deliveries:</span>
                        <span className="text-white font-semibold">
                          {stats?.totalDeliveries ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Success Rate:</span>
                        <span className="text-emerald-500 font-semibold">
                          {stats?.successRate != null ? `${stats.successRate}%` : '—'}
                        </span>
                      </div>
                      {partner.lastSyncAt && (
                        <div className="flex justify-between">
                          <span>Last Sync:</span>
                          <span className="text-white font-semibold">
                            {formatRelative(partner.lastSyncAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1">Settings</Button>
                      <Button variant="ghost" size="sm" className="flex-1">Details</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance Summary Table */}
        {(partnerStatsData?.stats ?? []).length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="p-3 text-left font-semibold text-gray-400">Provider</th>
                      <th className="p-3 text-center font-semibold text-gray-400">Active</th>
                      <th className="p-3 text-center font-semibold text-gray-400">Total</th>
                      <th className="p-3 text-center font-semibold text-gray-400">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(partnerStatsData?.stats ?? []).map((stat, idx) => (
                      <tr
                        key={stat.provider}
                        className={cn(
                          'border-b border-wl-border-default',
                          idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-elevated/30'
                        )}
                      >
                        <td className="p-3 text-white font-semibold capitalize">{stat.provider.replace(/_/g, ' ')}</td>
                        <td className="p-3 text-center text-white font-semibold">{stat.activeDeliveries}</td>
                        <td className="p-3 text-center text-white font-semibold">{stat.totalDeliveries}</td>
                        <td className="p-3 text-center">
                          {stat.successRate != null ? (
                            <Badge variant="success">{stat.successRate}%</Badge>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deliveries & Drivers */}
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          {/* Active Deliveries */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Deliveries</CardTitle>
              <div className="flex gap-2 ml-auto">
                {(['all', 'PENDING', 'IN_TRANSIT', 'DELIVERED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setDeliveryFilter(s)}
                    className={cn(
                      'px-2 py-1 text-xs font-semibold rounded border capitalize transition-all',
                      deliveryFilter === s
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-transparent text-gray-400 border-wl-border-default'
                    )}
                  >
                    {s === 'all' ? 'All' : s === 'IN_TRANSIT' ? 'Transit' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {deliveriesLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 rounded-md bg-wl-bg-surface animate-pulse" />
                  ))}
                </div>
              ) : deliveriesError ? (
                <div className="py-4 text-center text-red-400 text-sm">{deliveriesError.message}</div>
              ) : (deliveries ?? []).length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">No deliveries found.</div>
              ) : (
                <div className="space-y-2">
                  {(deliveries ?? []).map((d) => (
                    <div
                      key={d.id}
                      className={cn(
                        'p-3 rounded-md border',
                        d.status === 'DELIVERED'
                          ? 'border-emerald-500/20 bg-emerald-500/10'
                          : d.status === 'IN_TRANSIT' || d.status === 'PICKED_UP'
                          ? 'border-amber-500/20 bg-amber-500/10'
                          : d.status === 'FAILED' || d.status === 'CANCELLED'
                          ? 'border-red-500/20 bg-red-500/10'
                          : 'border-blue-500/20 bg-blue-500/10'
                      )}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {d.externalId}
                          </p>
                          <p className="text-xs text-gray-400">{d.partner.name}</p>
                        </div>
                        <Badge variant={getDeliveryStatusVariant(d.status)} className="text-xs ml-2 shrink-0">
                          {d.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{d.driverName ?? 'Unassigned'}</span>
                        <span>
                          {d.quote?.distanceKm != null ? `${d.quote.distanceKm} km` : ''}
                          {d.actualCost != null ? ` · ${formatCurrency(d.actualCost)}` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{formatRelative(d.createdAt)}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-wl-border-default text-xs">
                      <span className="text-gray-400">
                        {delivery.actualTime ? `${delivery.actualTime}` : delivery.estimatedTime}
                      </span>
                      <span className="text-gray-300">
                        Fee: {formatCurrency(delivery.fee)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Driver Status */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Status</CardTitle>
              <div className="flex gap-2 ml-auto">
                {(['all', 'AVAILABLE', 'ON_ROUTE', 'OFFLINE'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setDriverFilter(s)}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold rounded border capitalize transition-all",
                      driverFilterStatus === status
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-transparent text-gray-400 border-wl-border-default"
                    )}
                  >
                    {s === 'all' ? 'All' : s === 'ON_ROUTE' ? 'En Route' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={cn(
                      "p-3 rounded-md border",
                      driver.status === "online"
                        ? "border-emerald-500/20 bg-emerald-500/20"
                        : driver.status === "on_delivery"
                        ? "border-amber-500/20 bg-amber-500/20"
                        : "border-neutral-600/20 bg-wl-bg-elevated/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          {driver.name}
                        </p>
                        <p className="text-xs text-gray-300">
                          {driver.provider} • {driver.location}
                        </p>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Active orders: {driver._count.orders}</span>
                        {driver.lastLocationAt && (
                          <span>Seen {formatRelative(driver.lastLocationAt)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
