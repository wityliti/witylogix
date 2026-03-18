'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useOrders, Order } from '@/hooks/use-orders';

/* ═══════════════════════════════════════════════════════════
   ORDERS PAGE — Full order management with filtering + detail
   ═══════════════════════════════════════════════════════════ */

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    delivered: 'success',
    in_transit: 'primary',
    confirmed: 'info',
    pending: 'warning',
    cancelled: 'default',
  };
  return map[s.toLowerCase()] ?? 'default';
};

// Display type for orders (adapts Order to UI needs)
type OrderDisplay = Order;

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDisplay | null>(null);

  // Fetch orders with filters
  const { items: orders, loading, error, refetch, pagination } = useOrders({
    search: search || undefined,
    sort: 'createdAt:desc',
    limit: 50,
  });

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((o) => o.status.toLowerCase() === statusFilter.toLowerCase());
  }, [statusFilter, orders]);

  return (
    <>
      <Header
        title="Orders"
        subtitle={`${pagination.total} total · ${orders.length} displayed`}
        actions={
          <Button variant="primary" size="md">
            + New Order
          </Button>
        }
      />

      <div className="p-6">
        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-wl-danger-500/10 border border-wl-danger-500/20 rounded-lg">
            <p className="text-sm text-wl-danger-400 flex items-center justify-between">
              <span>Failed to load orders</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-wl-danger-400">
                Retry
              </Button>
            </p>
          </div>
        )}

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-5">
          {/* Search */}
          <div className="flex-1 min-w-[300px] max-w-[400px]">
            <input
              type="text"
              placeholder="Search orders, customers, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-wl-text-primary text-sm font-sans outline-none"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => {
              const count = f.key === 'all' ? orders.length : orders.filter((o) => o.status.toLowerCase() === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all',
                    statusFilter === f.key
                      ? 'bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500'
                      : 'bg-transparent text-wl-text-tertiary border-wl-border-default'
                  )}
                >
                  {f.label}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders Grid + Detail */}
        <div className={cn('grid gap-5', selectedOrder ? 'grid-cols-[1fr_400px]' : 'grid-cols-1')}>
          {/* Orders Table */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['Order ID', 'Customer', 'Status', 'Amount', 'Items', 'Delivery', 'Created'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide border-b border-wl-border-subtle bg-wl-bg-surface sticky top-0 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-wl-border-subtle">
                        <td colSpan={7} className="px-4 py-3 h-12 bg-wl-bg-overlay/50 animate-pulse" />
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-wl-text-tertiary">
                        No orders found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                        className={cn(
                          'border-b border-wl-border-subtle cursor-pointer transition-colors',
                          selectedOrder?.id === order.id ? 'bg-[rgba(245,166,35,0.06)]' : 'bg-transparent'
                        )}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-wl-primary-400 text-xs whitespace-nowrap">
                          {order.id}
                        </td>
                        <td className="px-4 py-3 text-wl-text-primary font-medium">
                          {order.customerName}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(order.status)} dot>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-wl-text-primary">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-wl-text-secondary text-center">
                          {order.items.length}
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary text-xs">
                          {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary text-xs">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Order Detail Panel */}
          {selectedOrder && (
            <Card
              className="wl-animate-in sticky overflow-y-auto"
              style={{
                top: 'calc(var(--wl-header-height) + var(--wl-space-6))',
                maxHeight: 'calc(100vh - var(--wl-header-height) - var(--wl-space-12))',
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-lg font-bold font-mono text-wl-primary-400">{selectedOrder.id}</span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="bg-none border-none text-wl-text-tertiary cursor-pointer text-lg font-sans"
                >
                  ✕
                </button>
              </div>

              <Badge variant={statusVariant(selectedOrder.status)} dot className="mb-4">
                {selectedOrder.status.replace(/_/g, ' ')}
              </Badge>

              <div className="flex flex-col gap-4">
                {/* Customer Info */}
                <div>
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
                    Customer
                  </div>
                  <div className="text-base font-semibold text-wl-text-primary">{selectedOrder.customerName}</div>
                  <div className="text-xs text-wl-text-secondary mt-0.5">{selectedOrder.customerEmail}</div>
                  <div className="text-xs text-wl-text-secondary font-mono">{selectedOrder.customerPhone}</div>
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Delivery Details */}
                <div>
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
                    Delivery
                  </div>
                  <div className="text-sm text-wl-text-secondary mb-1">
                    {selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}
                  </div>
                  {selectedOrder.deliveryDate && (
                    <div className="text-xs text-wl-text-tertiary">
                      Delivery: {new Date(selectedOrder.deliveryDate).toLocaleDateString()}
                    </div>
                  )}
                  {selectedOrder.estimatedDelivery && (
                    <div className="text-sm font-semibold text-wl-primary-400 font-mono mt-1">
                      ETA: {new Date(selectedOrder.estimatedDelivery).toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Order Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-wl-text-tertiary">Items</div>
                    <div className="text-base font-bold font-mono text-wl-text-primary">{selectedOrder.items.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-wl-text-tertiary">Total</div>
                    <div className="text-base font-bold font-mono text-wl-success-400">
                      {formatCurrency(selectedOrder.totalAmount)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button variant="primary" size="sm">
                    Assign Driver
                  </Button>
                  <Button variant="secondary" size="sm">
                    Edit Order
                  </Button>
                  <Button variant="ghost" size="sm">
                    View Tracking
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
