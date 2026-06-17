'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, Map, List, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useOrders, Order } from '@/hooks/use-orders';
import type { OrderPin, OrderPinStatus } from '@/components/map/order-layer';

const OrdersMapView = dynamic(() => import('./components/orders-map-view'), { ssr: false });

function toOrderPinStatus(status: string): OrderPinStatus {
  const s = status.toLowerCase();
  if (s === 'assigned') return 'assigned';
  if (s === 'in_transit') return 'in_transit';
  if (s === 'cancelled' || s === 'returned' || s === 'failed') return 'delayed';
  return 'pending';
}

const OrderLayer = dynamic(
  () => import('@/components/map/order-layer').then((m) => m.OrderLayer),
  { ssr: false, loading: () => <div className="h-[480px] bg-zinc-900 rounded-lg animate-pulse" /> }
);

const STATUS_TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'PICKED_UP', label: 'Picked Up' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { key: 'createdAt:desc', label: 'Newest First' },
  { key: 'createdAt:asc', label: 'Oldest First' },
  { key: 'totalPrice:desc', label: 'Highest Value' },
  { key: 'totalPrice:asc', label: 'Lowest Value' },
];

const STATUS_COLOR_MAP: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
  DELIVERED: 'success',
  OUT_FOR_DELIVERY: 'primary',
  PICKED_UP: 'info',
  ASSIGNED: 'info',
  ACCEPTED: 'warning',
  PENDING: 'warning',
  CANCELLED: 'danger',
  FAILED: 'danger',
  RETURNED: 'default',
};

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' {
  return STATUS_COLOR_MAP[status.toUpperCase()] ?? 'default';
}

function avatarInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string): string {
  const colors = ['bg-blue-500','bg-purple-500','bg-pink-500','bg-amber-500','bg-green-500','bg-cyan-500','bg-red-500','bg-indigo-500'];
  return colors[name.charCodeAt(0) % colors.length];
}

function truncate(s: string, max = 40): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

type ViewMode = 'list' | 'map';

export default function OrdersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt:desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const itemsPerPage = 15;

  const { items: orders, loading, error, refetch, pagination } = useOrders({
    search: search || undefined,
    sortBy: sortBy.split(':')[0] as any,
    sortOrder: (sortBy.split(':')[1] as 'asc' | 'desc') ?? 'desc',
    limit: 100,
  });

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status.toUpperCase() === statusFilter);
    }
    if (dateRange.from) {
      const from = new Date(dateRange.from);
      result = result.filter((o) => new Date(o.createdAt) >= from);
    }
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      result = result.filter((o) => new Date(o.createdAt) <= to);
    }
    return result;
  }, [orders, statusFilter, dateRange]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filtered.slice(startIdx, startIdx + itemsPerPage);

  // Map pins — only orders that have delivery coordinates
  const orderPins = useMemo<OrderPin[]>(() =>
    orders
      .filter((o): o is Order & { deliveryLat: number; deliveryLng: number } =>
        o.deliveryLat != null && o.deliveryLng != null
      )
      .map((o) => ({
        id: o.id,
        orderNumber: `#${o.id.slice(0, 8)}`,
        customerName: o.customerName,
        address: `${o.deliveryAddress.street}, ${o.deliveryAddress.city}`,
        status: toOrderPinStatus(o.status),
        lat: o.deliveryLat,
        lng: o.deliveryLng,
        priority: o.status === 'in_transit' ? 'high' : 'medium',
      })),
  [orders]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    STATUS_TABS.forEach((tab) => {
      if (tab.key !== 'all') {
        counts[tab.key] = orders.filter((o) => o.status.toUpperCase() === tab.key).length;
      }
    });
    return counts;
  }, [orders]);

  const mapOrders = useMemo(
    () =>
      filtered.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber ?? undefined,
        status: o.status,
        customerName: o.customerName,
        city: o.city,
        country: o.country,
        addressLine1: o.deliveryAddress.street,
      })),
    [filtered]
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        title="Orders"
        subtitle={`${pagination.total} total orders${orderPins.length > 0 ? ` · ${orderPins.length} on map` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-0.5">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'list' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white',
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'map' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white',
                )}
              >
                <Map className="w-3.5 h-3.5" /> Map
              </button>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push('/orders/create')}
            >
              + Create Order
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <p className="text-sm text-red-200">Failed to load orders</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-red-300 hover:text-red-100">
              Retry
            </Button>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const count = statusCounts[tab.key] ?? 0;
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); }}
                className={cn(
                  'relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-all',
                  'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-all',
                  isActive
                    ? 'text-white after:bg-white'
                    : 'text-zinc-400 hover:text-zinc-300 after:bg-transparent'
                )}
              >
                {tab.label}
                <span className={cn('ml-2 text-xs font-semibold px-2 py-0.5 rounded-full',
                  isActive ? 'bg-white/10 text-white' : 'bg-zinc-800 text-zinc-400')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <Card className="bg-zinc-900/50 border-zinc-800 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search orders, customers, addresses…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => { setDateRange((p) => ({ ...p, from: e.target.value })); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg text-sm bg-zinc-800/50 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => { setDateRange((p) => ({ ...p, to: e.target.value })); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg text-sm bg-zinc-800/50 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg text-sm bg-zinc-800/50 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Map View */}
        {view === 'map' && (
          <div
            className="relative rounded-xl overflow-hidden border border-zinc-800"
            style={{ height: 'calc(100vh - 320px)', minHeight: '480px' }}
          >
            {orderPins.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
                <MapPin className="w-10 h-10 mb-3 text-zinc-600" />
                <p className="text-sm font-medium text-zinc-300">No orders with location data</p>
                <p className="text-xs mt-1 text-zinc-500">Orders need delivery coordinates to appear on the map</p>
              </div>
            ) : (
              <OrdersMapView
                orders={orderPins}
                selectedOrderId={selectedOrderId}
                onOrderClick={setSelectedOrderId}
              />
            )}
          </div>
        )}

        {/* Orders Table + Pagination (list view) */}
        {view === 'list' && (
        <>
        <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Order
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Destination
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Items
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                      <td colSpan={8}>
                        <div className="px-6 py-4">
                          <div className="h-4 bg-zinc-800/50 rounded animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Order</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Destination</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide">Items</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Created</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8}>
                          <div className="px-6 py-4">
                            <div className="h-4 bg-zinc-800/50 rounded animate-pulse" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="flex flex-col items-center justify-center py-16 px-6">
                          <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                            <Search className="w-6 h-6 text-zinc-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-zinc-200 mb-1">No orders found</h3>
                          <p className="text-sm text-zinc-500 text-center max-w-sm">
                            {search || dateRange.from || dateRange.to
                              ? 'Try adjusting your filters or search terms'
                              : 'No orders yet. Create your first order to get started.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order, idx) => (
                      <tr
                        key={order.id}
                        className={cn(
                          'border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-800/30 transition-colors cursor-pointer',
                          selectedOrderId === order.id && 'bg-violet-950/20'
                        )}
                        onClick={() => setSelectedOrderId((p) => (p === order.id ? null : order.id))}
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/orders/${order.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono font-semibold text-sm text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            #{order.orderNumber ?? order.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white', avatarColor(order.customerName))}>
                              {avatarInitials(order.customerName)}
                            </div>
                            <span className="text-zinc-100 font-medium text-sm">{order.customerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-zinc-300 text-sm" title={`${order.deliveryAddress.street}, ${order.deliveryAddress.city}`}>
                            {truncate(`${order.deliveryAddress.street}, ${order.city || order.deliveryAddress.city}`, 38)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant(order.status)} className="text-xs font-semibold">
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs font-semibold text-zinc-200">
                            {order.itemCount || order.items.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-semibold text-zinc-100 text-sm">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-zinc-400 text-sm">
                            {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/orders/${order.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50">
                                View
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination (list view only) */}
        {viewMode === 'list' && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              Showing <span className="font-semibold text-zinc-200">{startIdx + 1}</span> to{' '}
              <span className="font-semibold text-zinc-200">{Math.min(startIdx + itemsPerPage, filtered.length)}</span> of{' '}
              <span className="font-semibold text-zinc-200">{filtered.length}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  const show = page === currentPage || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  if (!show && Math.abs(page - currentPage) === 2) return <span key={`e${page}`} className="text-zinc-500">…</span>;
                  if (!show) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all',
                        page === currentPage ? 'bg-white text-black font-semibold' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700')}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
