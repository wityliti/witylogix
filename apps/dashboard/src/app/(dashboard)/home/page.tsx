'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrderStats, useOrders, type Order as ApiOrder } from '@/hooks/use-orders';
import { useDrivers, type Driver as ApiDriver } from '@/hooks/use-drivers';

function Icon({ d, size = 24, className = '' }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

function KPICard({
  label,
  value,
  subtitle,
  trend,
  trendValue,
  variant = 'default',
  loading = false,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="h-4 bg-zinc-800 rounded w-24 mb-4" />
        <div className="h-8 bg-zinc-800 rounded w-32 mb-2" />
        <div className="h-3 bg-zinc-800 rounded w-20" />
      </div>
    );
  }

  const accentColor = {
    default: 'var(--wl-primary)',
    primary: 'var(--wl-primary)',
    success: 'var(--wl-success)',
    warning: '#f59e0b',
  }[variant];

  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{label}</h3>
        {trendValue && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/50">
            <Icon
              d={trend === 'up' ? 'M7 17l5-5 5 5' : trend === 'down' ? 'M7 7l5 5 5-5' : 'M21 12a9 9 0 11-18 0'}
              size={12}
              className={cn(
                trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
              )}
            />
            <span
              className={cn(
                'text-xs font-semibold',
                trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
              )}
            >
              {trendValue}
            </span>
          </div>
        )}
      </div>

      <div className="mb-2">
        <p style={{ color: accentColor }} className="text-3xl font-bold">
          {value}
        </p>
      </div>

      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function OrderFeedItem({ order }: { order: ApiOrder }) {
  const statusConfig: Record<string, { badge: 'warning' | 'info' | 'primary' | 'success' | 'default'; label: string }> = {
    pending: { badge: 'warning', label: 'Pending' },
    confirmed: { badge: 'info', label: 'Confirmed' },
    assigned: { badge: 'info', label: 'Assigned' },
    in_transit: { badge: 'primary', label: 'In Transit' },
    delivered: { badge: 'success', label: 'Delivered' },
    cancelled: { badge: 'default', label: 'Cancelled' },
  };

  const config = statusConfig[order.status] ?? { badge: 'default' as const, label: order.status };
  const dest = order.deliveryAddress
    ? `${order.deliveryAddress.street}, ${order.deliveryAddress.city}`
    : 'Destination pending';
  const createdAt = new Date(order.createdAt);

  return (
    <div className="border-b border-zinc-800 last:border-0 pb-4 last:pb-0 transition-all duration-200 hover:bg-zinc-900/50 px-4 py-3 rounded -mx-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-gray-100 truncate">Order #{order.id.slice(0, 8)}</p>
            <Badge variant={config.badge}>{config.label}</Badge>
          </div>
          <p className="text-sm text-gray-500 truncate">{dest}</p>
          {order.customerName && <p className="text-xs text-gray-600 mt-1">{order.customerName}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-600">{createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-xs text-gray-700 mt-1">${(order.totalAmount / 100).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

function DriverStatusCard({ driver, loading = false }: { driver?: ApiDriver; loading?: boolean }) {
  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="h-4 bg-zinc-800 rounded w-24 mb-3" />
        <div className="h-6 bg-zinc-800 rounded w-32 mb-3" />
        <div className="h-3 bg-zinc-800 rounded w-full" />
      </div>
    );
  }

  if (!driver) return null;

  const statusColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    online: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', dot: '#10b981' },
    on_delivery: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', dot: '#f59e0b' },
    on_break: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', dot: '#3b82f6' },
    offline: { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400', dot: '#6b7280' },
    unavailable: { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400', dot: '#6b7280' },
  };

  const config = statusColors[driver.status] ?? statusColors.offline;
  const utilization = Math.round(driver.completionRate);

  return (
    <div className={cn('bg-zinc-900 border border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:border-zinc-700', config.bg)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-100">{driver.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.dot }} />
            <p className={cn('text-xs font-medium', config.text)}>{driver.status.replace(/_/g, ' ').toUpperCase()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-100">{driver.totalDeliveries}</p>
          <p className="text-xs text-gray-500">Deliveries</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Completion Rate</span>
          <span className="text-xs font-semibold text-gray-300">{utilization}%</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${utilization}%`,
              backgroundColor: utilization > 80 ? '#10b981' : utilization > 60 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data: orderStats, loading: statsLoading } = useOrderStats();
  const { items: recentOrders, loading: ordersLoading, error: ordersError } = useOrders({ limit: 5 });
  const { items: drivers, loading: driversLoading } = useDrivers({ limit: 8 });

  const totalOrders = orderStats?.totalOrders ?? 0;
  const activeDeliveries = orderStats?.pendingOrders ?? 0;
  const driverUtilization = drivers.length > 0 ? Math.round((drivers.filter((d) => d.status !== 'offline').length / drivers.length) * 100) : 0;
  const todayRevenue = orderStats?.totalRevenue != null ? `$${(orderStats.totalRevenue / 100).toFixed(2)}` : '—';

  return (
    <div className="bg-zinc-950 min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Dashboard</h1>
            <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary">View Reports</Button>
            <Button variant="primary">Create Order</Button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            label="Total Orders"
            value={totalOrders}
            subtitle="All time"
            variant="primary"
            loading={statsLoading}
          />
          <KPICard
            label="Pending Orders"
            value={activeDeliveries}
            subtitle="Awaiting dispatch"
            variant="success"
            loading={statsLoading}
          />
          <KPICard
            label="Driver Utilization"
            value={`${driverUtilization}%`}
            subtitle={`${drivers.filter((d) => d.status !== 'offline').length} active drivers`}
            trend={driverUtilization > 70 ? 'up' : 'down'}
            trendValue={driverUtilization > 70 ? '+5.1%' : '-2.3%'}
            loading={driversLoading}
          />
          <KPICard
            label="Revenue"
            value={todayRevenue}
            subtitle="Total"
            variant="success"
            loading={statsLoading}
          />
        </div>

        {/* Main Grid: Left (Orders) + Right (Drivers) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Order Feed - Left Column */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={20} />
                  Live Order Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-6 px-6">
                  {ordersLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 bg-zinc-800 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : ordersError ? (
                    <div className="text-center py-8 text-red-400 text-sm">
                      Failed to load orders
                    </div>
                  ) : recentOrders.length > 0 ? (
                    <div className="space-y-2">
                      {recentOrders.map((order) => (
                        <OrderFeedItem key={order.id} order={order} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={40} className="mx-auto text-gray-600 mb-2" />
                      <p className="text-gray-500">No orders yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Driver Status Grid - Right Column */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" size={20} />
                  Driver Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {driversLoading
                    ? Array.from({ length: 4 }).map((_, i) => <DriverStatusCard key={i} loading={true} />)
                    : drivers.length === 0
                      ? <p className="text-sm text-gray-500 text-center py-4">No drivers found</p>
                      : drivers.slice(0, 4).map((driver) => <DriverStatusCard key={driver.id} driver={driver} />)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Section: Quick Actions + System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions Bar */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Link href="/orders/new">
                    <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-12">
                      <Icon d="M12 5v14m-7-7h14" size={18} />
                      <span>Create Order</span>
                    </Button>
                  </Link>
                  <Link href="/dispatch">
                    <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-12">
                      <Icon d="M13 10V3L4 14h7v7l9-11h-7z" size={18} />
                      <span>Dispatch</span>
                    </Button>
                  </Link>
                  <Link href="/reports">
                    <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-12">
                      <Icon d="M18 20V10M12 20V4M6 20v-6" size={18} />
                      <span>Reports</span>
                    </Button>
                  </Link>
                  <Link href="/drivers">
                    <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-12">
                      <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" size={18} />
                      <span>Drivers</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Health Indicator */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm text-gray-300">API Gateway</span>
                  </div>
                  <span className="text-xs text-emerald-500 font-medium">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm text-gray-300">Database</span>
                  </div>
                  <span className="text-xs text-emerald-500 font-medium">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm text-gray-300">Maps Service</span>
                  </div>
                  <span className="text-xs text-emerald-500 font-medium">Operational</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
