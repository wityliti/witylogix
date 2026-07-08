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
import Link from 'next/link';

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
  { ssr: false, loading: () => <div className="h-[480px] bg-wl-bg-root rounded-lg animate-pulse" /> }
);

const STATUS_TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { key: 'createdAt:desc', label: 'Newest First' },
  { key: 'createdAt:asc', label: 'Oldest First' },
  { key: 'totalAmount:desc', label: 'Highest Value' },
  { key: 'totalAmount:asc', label: 'Lowest Value' },
];

const getStatusVariant = (
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<
    string,
    'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'
  > = {
    delivered: 'success',
    in_transit: 'primary',
    confirmed: 'info',
    pending: 'warning',
    cancelled: 'danger',
  };
  return map[status.toLowerCase()] ?? 'default';
};

const getAvatarInitials = (name: string): string => {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarBgColor = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-amber-500',
    'bg-green-500',
    'bg-cyan-500',
    'bg-red-500',
    'bg-indigo-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const truncateAddress = (address: string, maxLength: number = 40): string => {
  return address.length > maxLength ? `${address.slice(0, maxLength)}…` : address;
};

const avatarColor = getAvatarBgColor;
const avatarInitials = getAvatarInitials;
const statusVariant = getStatusVariant;
const truncate = truncateAddress;

type OrderDisplay = Order;

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

  // Fetch orders with filters
  const { items: orders, loading, error, refetch, pagination } = useOrders({
    search: search || undefined,
    sort: sortBy,
    limit: 100,
  });

  // Filter orders by status
  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status.toUpperCase() === statusFilter);
    }
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      result = result.filter((o) => new Date(o.createdAt) >= from);
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      result = result.filter((o) => new Date(o.createdAt) <= to);
    }
    return result;
  }, [orders, statusFilter, dateRange]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedOrders = filtered.slice(startIdx, endIdx);

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
    const counts: Record<string, number> = {};
    STATUS_TABS.forEach((tab) => {
      if (tab.key === 'all') {
        counts[tab.key] = orders.length;
      } else {
        counts[tab.key] = orders.filter(
          (o) => o.status.toLowerCase() === tab.key
        ).length;
      }
    });
    return counts;
  }, [orders]);

  return (
    <div className="min-h-screen bg-wl-bg-root">
      {/* Page Header */}
      <Header
        title="Orders"
        subtitle={`${pagination.total} total orders${orderPins.length > 0 ? ` · ${orderPins.length} on map` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-wl-bg-elevated p-0.5">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'list' ? 'bg-wl-bg-overlay text-wl-text-primary' : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'map' ? 'bg-wl-bg-overlay text-wl-text-primary' : 'text-wl-text-secondary hover:text-wl-text-primary',
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
        {/* Error State */}
        {error && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <p className="text-sm text-red-200">Failed to load orders</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="text-red-300 hover:text-red-100"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex items-center gap-1 border-b border-wl-border-default pb-0 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const count = statusCounts[tab.key] || 0;
            const isActive = statusFilter === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={cn(
                  'relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-all',
                  'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-all',
                  isActive
                    ? 'text-wl-text-primary after:bg-wl-text-primary'
                    : 'text-wl-text-secondary hover:text-wl-text-primary after:bg-transparent'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'ml-2 text-xs font-semibold px-2 py-0.5 rounded-full',
                    isActive
                      ? 'bg-white/10 text-wl-text-primary'
                      : 'bg-wl-bg-elevated text-wl-text-secondary'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter & Sort Bar */}
        <Card className="bg-wl-bg-surface/50 border-wl-border-default p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-wl-text-tertiary" />
              <input
                type="text"
                placeholder="Search orders, customers, destinations..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  'w-full pl-10 pr-4 py-2 rounded-lg',
                  'bg-wl-bg-elevated/50 border border-wl-border-strong text-wl-text-primary text-sm',
                  'placeholder:text-wl-text-tertiary',
                  'focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-wl-bg-elevated',
                  'transition-all'
                )}
              />
            </div>

            {/* Date Range Inputs */}
            <div className="flex gap-3">
              <input
                type="date"
                value={dateRange?.from ?? ''}
                onChange={(e) => { setDateRange((p) => ({ from: e.target.value, to: p?.to ?? '' })); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg text-sm bg-wl-bg-elevated/50 border border-wl-border-default text-wl-text-primary focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <input
                type="date"
                value={dateRange?.to ?? ''}
                onChange={(e) => { setDateRange((p) => ({ from: p?.from ?? '', to: e.target.value })); setCurrentPage(1); }}
                className="px-3 py-2 rounded-lg text-sm bg-wl-bg-elevated/50 border border-wl-border-default text-wl-text-primary focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium',
                'bg-wl-bg-elevated/50 border border-wl-border-strong text-wl-text-primary',
                'focus:outline-none focus:ring-2 focus:ring-white/20',
                'transition-all appearance-none cursor-pointer',
                'pr-8'
              )}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='%2371717a' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 8px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Map View */}
        {view === 'map' && (
          <div
            className="relative rounded-xl overflow-hidden border border-wl-border-default"
            style={{ height: 'calc(100vh - 320px)', minHeight: '480px' }}
          >
            {orderPins.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-wl-bg-surface">
                <MapPin className="w-10 h-10 mb-3 text-wl-text-tertiary" />
                <p className="text-sm font-medium text-wl-text-secondary">No orders with location data</p>
                <p className="text-xs mt-1 text-wl-text-tertiary">Orders need delivery coordinates to appear on the map</p>
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
        <Card className="bg-wl-bg-surface/50 border-wl-border-default overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-wl-border-default bg-wl-bg-surface/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Order
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Destination
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Items
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-wl-text-secondary uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wl-border-default">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="hover:bg-wl-bg-elevated/30 transition-colors">
                      <td colSpan={8}>
                        <div className="px-6 py-4">
                          <div className="h-4 bg-wl-bg-elevated/50 rounded animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="flex flex-col items-center justify-center py-16 px-6">
                          <div className="w-12 h-12 rounded-full bg-wl-bg-elevated/50 flex items-center justify-center mb-4">
                            <Search className="w-6 h-6 text-wl-text-tertiary" />
                          </div>
                          <h3 className="text-lg font-semibold text-wl-text-primary mb-1">No orders found</h3>
                          <p className="text-sm text-wl-text-tertiary text-center max-w-sm">
                            {search || dateRange?.from || dateRange?.to
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
                          'border-b border-wl-border-subtle last:border-b-0 hover:bg-wl-bg-elevated/30 transition-colors cursor-pointer',
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
                            <span className="text-wl-text-primary font-medium text-sm">{order.customerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-wl-text-secondary text-sm" title={`${order.deliveryAddress.street}, ${order.deliveryAddress.city}`}>
                            {truncate(`${order.deliveryAddress.street}, ${order.city || order.deliveryAddress.city}`, 38)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant(order.status)} className="text-xs font-semibold">
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-wl-bg-elevated text-xs font-semibold text-wl-text-primary">
                            {order.itemCount || order.items.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-semibold text-wl-text-primary text-sm">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-wl-text-secondary text-sm">
                            {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/orders/${order.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="ghost" size="sm" className="text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-bg-elevated">
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

        {/* Pagination (list view only) */}
        {view === 'list' && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-wl-text-secondary">
              Showing{' '}
              <span className="font-semibold text-wl-text-primary">{startIdx + 1}</span> to{' '}
              <span className="font-semibold text-wl-text-primary">
                {Math.min(endIdx, filtered.length)}
              </span>{' '}
              of <span className="font-semibold text-wl-text-primary">{filtered.length}</span> orders
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  const isCurrentPage = page === currentPage;
                  const showPage =
                    isCurrentPage ||
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1;

                  if (!showPage && Math.abs(page - currentPage) === 2) {
                    return (
                      <span key={`ellipsis-${page}`} className="text-wl-text-tertiary">
                        …
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all',
                        isCurrentPage
                          ? 'bg-white text-black font-semibold'
                          : 'bg-wl-bg-elevated text-wl-text-secondary hover:bg-wl-bg-overlay'
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
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
