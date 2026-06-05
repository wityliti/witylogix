'use client';

import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { KanbanColumn, OrderStatus } from '@/components/orders/kanban-column';
import {
  Search,
  Users,
  RefreshCw,
  Kanban,
} from 'lucide-react';

// ── Board-view Order shape (as expected by KanbanColumn/KanbanCard) ──

interface BoardOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  destination: string;
  fullAddress: string;
  createdAt: string;
  priority: 'high' | 'medium' | 'low';
  status: OrderStatus;
  driverName?: string;
  driverInitials?: string;
  value: number;
}

// ── Raw API order shape ──

interface ApiOrder {
  id: string;
  externalOrderNumber?: string;
  customerName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  status: string;
  totalPrice?: string | number;
  createdAt: string;
  driver?: { id: string; name: string };
  tags?: string[];
}

function toInitials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function mapPriority(tags: string[] = []): 'high' | 'medium' | 'low' {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => ['high', 'urgent', 'priority'].includes(t))) return 'high';
  if (lower.includes('low')) return 'low';
  return 'medium';
}

function mapStatus(status: string): OrderStatus {
  const upper = status.toUpperCase();
  const valid: OrderStatus[] = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED'];
  return (valid.includes(upper as OrderStatus) ? upper : 'PENDING') as OrderStatus;
}

function mapApiOrder(raw: ApiOrder): BoardOrder {
  const city = raw.city ?? '';
  const line1 = raw.addressLine1 ?? '';
  const fullAddress = [line1, raw.addressLine2, city, raw.province, raw.postalCode, raw.country]
    .filter(Boolean).join(', ');
  return {
    id: raw.id,
    orderNumber: raw.externalOrderNumber ?? raw.id.slice(0, 8).toUpperCase(),
    customerName: raw.customerName ?? 'Unknown Customer',
    destination: city || line1 || 'Unknown',
    fullAddress: fullAddress || 'No address',
    createdAt: raw.createdAt,
    priority: mapPriority(raw.tags),
    status: mapStatus(raw.status),
    driverName: raw.driver?.name,
    driverInitials: raw.driver?.name ? toInitials(raw.driver.name) : undefined,
    value: raw.totalPrice ? parseFloat(String(raw.totalPrice)) : 0,
  };
}

const COLUMN_CONFIG: { status: OrderStatus; title: string }[] = [
  { status: 'PENDING', title: 'Pending' },
  { status: 'CONFIRMED', title: 'Confirmed' },
  { status: 'ASSIGNED', title: 'Assigned' },
  { status: 'PICKED_UP', title: 'Picked Up' },
  { status: 'IN_TRANSIT', title: 'In Transit' },
  { status: 'DELIVERED', title: 'Delivered' },
  { status: 'FAILED', title: 'Failed' },
  { status: 'CANCELLED', title: 'Cancelled' },
];

function BoardSkeleton() {
  return (
    <div className="flex gap-4 min-w-min px-6 py-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col flex-shrink-0 w-80 rounded-lg bg-wl-bg-surface border border-wl-border-default overflow-hidden">
          <div className="px-4 py-3 border-b border-wl-border-default">
            <Skeleton variant="text" className="h-4 w-24" />
          </div>
          <div className="p-3 space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} variant="card" className="h-24 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrderBoardPage() {
  const { items: rawApiOrders, loading, error, refetch } = useApiList<ApiOrder>('/api/v4/orders?limit=200');
  const [localOverrides, setLocalOverrides] = useState<Record<string, OrderStatus>>({});

  const apiOrders = useMemo(() => rawApiOrders.map(mapApiOrder), [rawApiOrders]);
  const orders = useMemo(
    () => apiOrders.map((o) => (localOverrides[o.id] ? { ...o, status: localOverrides[o.id] } : o)),
    [apiOrders, localOverrides]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OrderStatus>>(new Set(['FAILED', 'CANCELLED']));
  const [sortBy, setSortBy] = useState<'time' | 'priority'>('time');

  const drivers = useMemo(() => {
    const seen = new Set<string>();
    orders.forEach((o) => { if (o.driverInitials) seen.add(o.driverInitials); });
    return Array.from(seen).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    return (
      (!q || o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.destination.toLowerCase().includes(q)) &&
      (!selectedDriver || o.driverInitials === selectedDriver)
    );
  }), [orders, searchQuery, selectedDriver]);

  const ordersByStatus = useMemo(() => {
    const grouped: Record<OrderStatus, BoardOrder[]> = {
      PENDING: [], CONFIRMED: [], ASSIGNED: [], PICKED_UP: [],
      IN_TRANSIT: [], DELIVERED: [], FAILED: [], CANCELLED: [],
    };
    filteredOrders.forEach((o) => grouped[o.status].push(o));
    return grouped;
  }, [filteredOrders]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetStatus: OrderStatus) => {
    e.preventDefault();
    try {
      const { id } = JSON.parse(e.dataTransfer.getData('application/json')) as { id: string };
      setLocalOverrides((prev) => ({ ...prev, [id]: targetStatus }));
    } catch { /* malformed drag data */ }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); }, []);

  const toggleColumnCollapse = (status: OrderStatus) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  const totalOrders = filteredOrders.length;
  const totalValue = filteredOrders.reduce((sum, o) => sum + o.value, 0);

  if (error && orders.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header title="Order Kanban Board" subtitle="Drag and drop to update order status" />

      <div className="flex flex-col gap-4 px-6 py-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  <Kanban className="w-4 h-4 text-wl-primary-400" />
                  Orders Dashboard
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-wl-text-secondary">
                  <span>{totalOrders} orders</span>
                  {totalValue > 0 && (
                    <span>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  )}
                  {loading && <span className="text-wl-text-tertiary">Refreshing…</span>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary" />
                  <Input
                    placeholder="Search orders, customers, destinations…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    aria-label="Search orders"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-wl-text-tertiary" />
                  <select
                    value={selectedDriver ?? ''}
                    onChange={(e) => setSelectedDriver(e.target.value || null)}
                    className={cn('px-3 py-2 rounded-md text-sm bg-wl-bg-overlay border border-wl-border-default text-wl-text-primary focus:outline-none focus:border-wl-border-strong')}
                    aria-label="Filter by driver"
                  >
                    <option value="">All Drivers</option>
                    {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <Button variant="secondary" size="sm" onClick={() => setSortBy(sortBy === 'time' ? 'priority' : 'time')}>
                  Sort: {sortBy === 'time' ? 'Time' : 'Priority'}
                </Button>

                <Button
                  variant={autoRefresh ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => { setAutoRefresh(!autoRefresh); if (!autoRefresh) refetch(); }}
                  className="flex items-center gap-2"
                  aria-label="Refresh orders"
                >
                  <RefreshCw className={cn('w-4 h-4', autoRefresh && 'animate-spin')} />
                  {autoRefresh ? 'Refreshing' : 'Refresh'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {loading && orders.length === 0 ? (
          <BoardSkeleton />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Orders will appear here as they are created."
            icon={<Kanban className="w-10 h-10" />}
          />
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-min">
              {COLUMN_CONFIG.map(({ status, title }) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  title={title}
                  orders={ordersByStatus[status]}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragLeave={handleDragLeave}
                  isCollapsed={collapsedColumns.has(status)}
                  onToggleCollapse={() => toggleColumnCollapse(status)}
                  sortBy={sortBy}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
