'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Package, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCard } from '@/components/order-card';
import { OrderListSkeleton, ErrorMessage, EmptyState } from '@/components/loading-skeleton';
import { useQuery } from '@/lib/use-api';
import type { ApiOrder } from '@/lib/portal-api';
import { ROUTES } from '@/lib/portal-api';
import type { Order, OrderStatus } from '@/types';

// ─── Map API order → portal Order type ───────────────────────

function mapApiOrder(o: ApiOrder): Order {
  return {
    id: o.id,
    orderNumber: o.externalOrderNumber ?? `#${o.id.slice(-8).toUpperCase()}`,
    status: mapStatus(o.status),
    createdAt: new Date(o.createdAt),
    scheduledDeliveryDate: o.deliveryDate ? new Date(o.deliveryDate) : new Date(o.createdAt),
    actualDeliveryDate: o.actualDelivery ? new Date(o.actualDelivery) : undefined,
    items: (o.lineItems ?? []).map((li) => ({
      id: li.id,
      name: li.title,
      quantity: li.quantity,
      price: li.price,
    })),
    deliveryAddress: {
      street: [o.addressLine1, o.addressLine2].filter(Boolean).join(', '),
      city: o.city,
      state: o.province ?? '',
      zipCode: o.postalCode ?? '',
      country: o.country ?? '',
    },
    totalPrice: o.totalPrice ?? 0,
    estimatedDelivery: o.estimatedArrival
      ? format(new Date(o.estimatedArrival), 'PPp')
      : undefined,
  };
}

function mapStatus(status: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    PENDING: 'pending',
    ACCEPTED: 'confirmed',
    ASSIGNED: 'confirmed',
    PICKED_UP: 'out-for-delivery',
    OUT_FOR_DELIVERY: 'out-for-delivery',
    ARRIVED: 'out-for-delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    FAILED: 'cancelled',
    RETURNED: 'cancelled',
  };
  return statusMap[status] ?? 'pending';
}

// ─── Status filter tabs ───────────────────────────────────────

type FilterTab = 'all' | 'active' | 'delivered' | 'cancelled';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

const ACTIVE_STATUSES = new Set<OrderStatus>(['out-for-delivery', 'confirmed', 'pending']);
const DELIVERED_STATUSES = new Set<OrderStatus>(['delivered']);
const CANCELLED_STATUSES = new Set<OrderStatus>(['cancelled']);

// ─── Paginated response shape ─────────────────────────────────

interface PaginatedOrders {
  data: ApiOrder[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Component ────────────────────────────────────────────────

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const { data, loading, error, refetch } = useQuery<PaginatedOrders>(
    `${ROUTES.ORDERS}?limit=50&sortBy=createdAt&sortOrder=desc`,
  );

  const orders = useMemo(() => (data?.data ?? []).map(mapApiOrder), [data]);

  const filtered = useMemo(() => {
    let result = orders;

    switch (activeTab) {
      case 'active':
        result = result.filter((o) => ACTIVE_STATUSES.has(o.status));
        break;
      case 'delivered':
        result = result.filter((o) => DELIVERED_STATUSES.has(o.status));
        break;
      case 'cancelled':
        result = result.filter((o) => CANCELLED_STATUSES.has(o.status));
        break;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q)) ||
          o.deliveryAddress.city.toLowerCase().includes(q),
      );
    }

    return result;
  }, [orders, activeTab, search]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Orders</h1>
        <p className="page-subtitle">
          {data
            ? `${data.pagination.total} order${data.pagination.total !== 1 ? 's' : ''} total`
            : 'View and track all your deliveries'}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 stagger-1">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-wl-text-tertiary"
          />
          <input
            type="search"
            placeholder="Search by order number, item, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn('btn', activeTab === tab.id ? 'btn-primary' : 'btn-ghost')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="stagger-2">
        {loading && <OrderListSkeleton count={4} />}

        {!loading && error && (
          <ErrorMessage message={error.message} onRetry={refetch} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<Package size={24} />}
            title="No orders found"
            description={
              search
                ? 'No orders match your search. Try a different term.'
                : activeTab !== 'all'
                  ? `You have no ${activeTab} orders.`
                  : "You haven't placed any orders yet."
            }
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
