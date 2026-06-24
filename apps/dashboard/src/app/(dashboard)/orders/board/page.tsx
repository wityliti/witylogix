'use client';

import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { KanbanColumn, OrderStatus } from '@/components/orders/kanban-column';
import {
  Search,
  Users,
  RefreshCw,
} from 'lucide-react';

// Shape the API returns (after orders.ts transformOrder)
interface ApiOrder {
  id: string;
  orderNumber: string | null;
  customerName: string;
  deliveryAddress: { street: string; city: string; state: string; zipCode: string; country: string };
  city: string;
  status: string;
  totalAmount: number;
  driver: { id: string; name: string; phone: string } | null;
  createdAt: string;
}

// Shape KanbanColumn / KanbanCard expect
interface KanbanOrder {
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

const VALID_STATUSES: Set<string> = new Set([
  'PENDING', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED',
]);

function normalizeStatus(s: string): OrderStatus {
  const up = s.toUpperCase();
  if (up === 'ACCEPTED') return 'CONFIRMED';
  if (up === 'OUT_FOR_DELIVERY' || up === 'ARRIVED') return 'IN_TRANSIT';
  if (up === 'RETURNED') return 'FAILED';
  if (VALID_STATUSES.has(up)) return up as OrderStatus;
  return 'PENDING';
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function toKanban(o: ApiOrder): KanbanOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber ?? o.id.slice(0, 8),
    customerName: o.customerName,
    destination: o.city || o.deliveryAddress?.city || '',
    fullAddress: [o.deliveryAddress?.street, o.city || o.deliveryAddress?.city].filter(Boolean).join(', '),
    createdAt: o.createdAt,
    priority: 'medium',
    status: normalizeStatus(o.status),
    driverName: o.driver?.name,
    driverInitials: o.driver?.name ? initials(o.driver.name) : undefined,
    value: o.totalAmount ?? 0,
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

export default function OrderBoardPage() {
  const { items: apiOrders, loading, error, refetch } = useApiList<ApiOrder>('/api/v4/orders', { limit: 200 });
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, OrderStatus>>({});

  const orders: KanbanOrder[] = useMemo(
    () => apiOrders.map((o) => {
      const base = toKanban(o);
      return localStatusOverrides[o.id] ? { ...base, status: localStatusOverrides[o.id] } : base;
    }),
    [apiOrders, localStatusOverrides]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OrderStatus>>(
    new Set(['FAILED', 'CANCELLED'])
  );
  const [sortBy, setSortBy] = useState<'time' | 'priority'>('time');

  const drivers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => { if (o.driverInitials) set.add(o.driverInitials); });
    return Array.from(set).sort();
  }, [orders]);

  const filteredOrders = useMemo(
    () => orders.filter((o) => {
      const matchSearch = !searchQuery ||
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.destination.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDriver = !selectedDriver || o.driverInitials === selectedDriver;
      return matchSearch && matchDriver;
    }),
    [orders, searchQuery, selectedDriver]
  );

  const ordersByStatus = useMemo(() => {
    const grouped = Object.fromEntries(
      COLUMN_CONFIG.map(({ status }) => [status, [] as KanbanOrder[]])
    ) as Record<OrderStatus, KanbanOrder[]>;
    filteredOrders.forEach((o) => { grouped[o.status]?.push(o); });
    return grouped;
  }, [filteredOrders]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetStatus: OrderStatus) => {
    e.preventDefault();
    try {
      const { id } = JSON.parse(e.dataTransfer.getData('application/json')) as { id: string; sourceStatus: OrderStatus };
      setLocalStatusOverrides((prev) => ({ ...prev, [id]: targetStatus }));
    } catch {
      // ignore malformed drag data
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const toggleCollapse = (status: OrderStatus) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  const totalValue = filteredOrders.reduce((sum, o) => sum + o.value, 0);

  if (loading && orders.length === 0) return <LoadingSkeleton />;
  if (error && orders.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header title="Order Kanban Board" subtitle="Drag and drop orders between stages" />

      <div className="flex flex-col gap-4 px-6 py-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Orders Dashboard</CardTitle>
                <div className="flex items-center gap-4 text-sm text-wl-text-secondary">
                  <span>{filteredOrders.length} orders</span>
                  <span>Value: ${totalValue.toFixed(2)}</span>
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
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-wl-text-tertiary" />
                  <select
                    value={selectedDriver ?? ''}
                    onChange={(e) => setSelectedDriver(e.target.value || null)}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm',
                      'bg-wl-bg-overlay border border-wl-border-default',
                      'text-wl-text-primary focus:outline-none focus:border-wl-border-strong'
                    )}
                  >
                    <option value="">All Drivers</option>
                    {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSortBy((s) => (s === 'time' ? 'priority' : 'time'))}
                >
                  Sort: {sortBy === 'time' ? 'Time' : 'Priority'}
                </Button>

                <Button
                  variant={autoRefresh ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => { setAutoRefresh((v) => !v); if (!autoRefresh) refetch(); }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={cn('w-4 h-4', autoRefresh && 'animate-spin')} />
                  {autoRefresh ? 'Auto' : 'Refresh'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

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
                onToggleCollapse={() => toggleCollapse(status)}
                sortBy={sortBy}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
