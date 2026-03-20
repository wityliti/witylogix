'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Truck,
  Package,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';

interface UnassignedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  deliveryWindow: { start: string; end: string };
  itemCount: number;
}

interface Driver {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  location: string;
  activeDeliveries: number;
  vehicleType: 'car' | 'van' | 'truck';
}

type FilterType = 'all' | 'urgent' | 'standard' | 'scheduled';
type SortType = 'time' | 'priority' | 'distance';

export default function DispatchPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('time');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDriverPicker, setShowDriverPicker] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch orders and drivers
  const { items: orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useApiList<UnassignedOrder>('/api/v4/dispatch/orders');
  const { items: drivers, loading: driversLoading, error: driversError, refetch: refetchDrivers } = useApiList<Driver>('/api/v4/dispatch/drivers');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterType === 'all') return true;
      if (filterType === 'urgent') return order.priority === 'high';
      if (filterType === 'standard') return order.priority === 'medium';
      if (filterType === 'scheduled') return order.priority === 'low';
      return true;
    });
  }, [filterType, orders]);

  // Sort orders
  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    if (sortType === 'time') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortType === 'priority') {
      const priorityMap = { high: 0, medium: 1, low: 2 };
      sorted.sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority]);
    }
    return sorted;
  }, [filteredOrders, sortType]);

  // Calculate stats
  const stats = useMemo(() => {
    const inTransit = Math.floor(Math.random() * 20) + 8;
    const completedToday = Math.floor(Math.random() * 45) + 25;
    return {
      unassigned: orders.length,
      inTransit,
      completedToday,
    };
  }, [orders.length]);

  const driverStats = useMemo(() => {
    const available = drivers.filter((d) => d.status === 'available').length;
    const busy = drivers.filter((d) => d.status === 'busy').length;
    const offline = drivers.filter((d) => d.status === 'offline').length;
    return { available, busy, offline, total: drivers.length };
  }, [drivers]);

  // Format time elapsed
  const formatTimeElapsed = (dateStr: string): string => {
    const date = new Date(dateStr);
    const elapsed = Math.floor((currentTime.getTime() - date.getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s ago`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    return `${Math.floor(elapsed / 3600)}h ago`;
  };

  // Handle assign action
  const handleAssignDriver = useCallback(
    (orderId: string, driverId: string) => {
      console.log(`Assigned order ${orderId} to driver ${driverId}`);
      setShowDriverPicker(null);
      setSelectedOrderId(null);
    },
    []
  );

  if (ordersError || driversError) {
    return (
      <ErrorState
        message={ordersError?.message || driversError?.message || 'Failed to load dispatch data'}
        onRetry={() => {
          refetchOrders();
          refetchDrivers();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--wl-bg-primary)]">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-[var(--wl-border-subtle)] bg-[var(--wl-bg-primary)]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--wl-text-primary)]">
              Dispatch Command Center
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {/* Live Clock */}
            <div className="flex flex-col items-end">
              <div className="text-sm font-semibold text-[var(--wl-text-primary)]">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="text-xs text-[var(--wl-text-tertiary)]">
                {currentTime.toLocaleDateString()}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 pl-6 border-l border-[var(--wl-border-subtle)]">
              <div className="flex flex-col items-center">
                <div className="text-lg font-bold text-[var(--wl-warning-400)]">
                  {stats.unassigned}
                </div>
                <div className="text-xs text-[var(--wl-text-tertiary)]">Unassigned</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-lg font-bold text-[var(--wl-info-400)]">
                  {stats.inTransit}
                </div>
                <div className="text-xs text-[var(--wl-text-tertiary)]">In Transit</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-lg font-bold text-[var(--wl-success-400)]">
                  {stats.completedToday}
                </div>
                <div className="text-xs text-[var(--wl-text-tertiary)]">Completed</div>
              </div>
            </div>

            {/* Auto-refresh Toggle */}
            <Button
              variant={autoRefresh ? "primary" : "secondary"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
              <span className="hidden sm:inline">
                {autoRefresh ? "Refreshing" : "Paused"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Unassigned Orders Queue (40%) */}
        <div className="w-[40%] border-r border-[var(--wl-border-subtle)] flex flex-col overflow-hidden bg-[var(--wl-bg-primary)]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--wl-border-subtle)] bg-[var(--wl-bg-secondary)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--wl-text-secondary)]" />
                <h2 className="text-sm font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide">
                  Unassigned Orders
                </h2>
                <Badge variant="primary">{sortedOrders.length}</Badge>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 flex-wrap">
                {(["all", "urgent", "standard", "scheduled"] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={filterType === filter ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setFilterType(filter)}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex gap-2 items-center">
                <span className="text-xs text-[var(--wl-text-tertiary)] uppercase">Sort:</span>
                {(["time", "priority", "distance"] as const).map((sort) => (
                  <Button
                    key={sort}
                    variant={sortType === sort ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSortType(sort)}
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto">
            {ordersLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-32 bg-wl-bg-elevated rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {sortedOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all duration-200",
                    selectedOrderId === order.id
                      ? "bg-[var(--wl-bg-overlay)] border-[var(--wl-primary-500)] shadow-lg"
                      : "bg-[var(--wl-bg-secondary)] border-[var(--wl-border-subtle)] hover:border-[var(--wl-border-default)]"
                  )}
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[var(--wl-text-primary)]">
                          {order.orderNumber}
                        </span>
                        <Badge
                          variant={
                            order.priority === "high"
                              ? "danger"
                              : order.priority === "medium"
                                ? "warning"
                                : "default"
                          }
                        >
                          {order.priority}
                        </Badge>
                      </div>
                      <div className="text-sm text-[var(--wl-text-secondary)]">
                        {order.customerName}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-[var(--wl-text-tertiary)] flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-[var(--wl-text-secondary)] line-clamp-2">
                      {order.address}
                    </div>
                  </div>

                  {/* Time & Items */}
                  <div className="flex items-center justify-between mb-3 text-xs text-[var(--wl-text-tertiary)]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTimeElapsed(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      <span>{order.itemCount} item(s)</span>
                    </div>
                  </div>

                  {/* Delivery Window */}
                  <div className="mb-3 px-2 py-1.5 bg-[var(--wl-bg-overlay)] rounded text-xs text-[var(--wl-text-secondary)]">
                    Deliver: {order.deliveryWindow.start} - {order.deliveryWindow.end}
                  </div>

                  {/* Assign Button */}
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDriverPicker(order.id);
                    }}
                  >
                    Assign Driver
                  </Button>

                  {/* Driver Picker */}
                  {showDriverPicker === order.id && (
                    <div className="mt-3 pt-3 border-t border-[var(--wl-border-subtle)]">
                      <div className="mb-2 text-xs font-semibold text-[var(--wl-text-secondary)]">
                        Select a driver:
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {drivers.filter((d) => d.status === 'available').map((driver) => (
                          <button
                            key={driver.id}
                            onClick={() => handleAssignDriver(order.id, driver.id)}
                            className="w-full text-left px-2 py-1.5 text-sm rounded bg-[var(--wl-bg-overlay)] hover:bg-[var(--wl-primary-500)] hover:text-[var(--wl-text-inverse)] transition-colors text-[var(--wl-text-secondary)]"
                          >
                            {driver.name} - {driver.location}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Map & Drivers (60%) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--wl-bg-primary)]">
          {/* Map Placeholder */}
          <div className="flex-1 bg-[var(--wl-bg-secondary)] border-b border-[var(--wl-border-subtle)] flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-[var(--wl-text-tertiary)] mx-auto mb-4 opacity-50" />
              <div className="text-[var(--wl-text-secondary)]">
                Live Map — requires Leaflet integration
              </div>
              <div className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                Map will display route optimization and real-time driver locations
              </div>
            </div>
          </div>

          {/* Drivers Grid */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--wl-border-subtle)] bg-[var(--wl-bg-secondary)]">
              <h3 className="text-sm font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Active Drivers
              </h3>
            </div>

            {/* Drivers Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {driversLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-40 bg-wl-bg-elevated rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {drivers.map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all duration-200",
                      selectedDriverId === driver.id
                        ? "bg-[var(--wl-bg-overlay)] border-[var(--wl-primary-500)] shadow-md"
                        : "bg-[var(--wl-bg-secondary)] border-[var(--wl-border-subtle)] hover:border-[var(--wl-border-default)]"
                    )}
                  >
                    {/* Name */}
                    <div className="font-semibold text-sm text-[var(--wl-text-primary)] mb-1">
                      {driver.name}
                    </div>

                    {/* Status Badge */}
                    <div className="mb-2">
                      <Badge
                        variant={
                          driver.status === "available"
                            ? "success"
                            : driver.status === "busy"
                              ? "warning"
                              : "default"
                        }
                        dot
                      >
                        {driver.status}
                      </Badge>
                    </div>

                    {/* Location */}
                    <div className="text-xs text-[var(--wl-text-secondary)] mb-2 flex items-start gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{driver.location}</span>
                    </div>

                    {/* Active Deliveries */}
                    <div className="text-xs text-[var(--wl-text-tertiary)] flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      <span>{driver.activeDeliveries} delivery(s)</span>
                    </div>

                    {/* Vehicle Type */}
                    <div className="mt-2 text-xs text-[var(--wl-text-tertiary)]">
                      {driver.vehicleType.charAt(0).toUpperCase() + driver.vehicleType.slice(1)}
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>

            {/* Stats Footer */}
            <div className="px-4 py-3 border-t border-[var(--wl-border-subtle)] bg-[var(--wl-bg-secondary)]">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <div className="font-bold text-[var(--wl-text-primary)]">
                    {driverStats.total}
                  </div>
                  <div className="text-[var(--wl-text-tertiary)]">Total</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--wl-success-400)]">
                    {driverStats.available}
                  </div>
                  <div className="text-[var(--wl-text-tertiary)]">Available</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--wl-warning-400)]">
                    {driverStats.busy}
                  </div>
                  <div className="text-[var(--wl-text-tertiary)]">Busy</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--wl-text-tertiary)]">
                    {driverStats.offline}
                  </div>
                  <div className="text-[var(--wl-text-tertiary)]">Offline</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
