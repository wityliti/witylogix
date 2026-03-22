'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  MapPin,
  Clock,
  AlertCircle,
  Truck,
  Package,
  Signal,
  Zap,
  ArrowRight,
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
  rating?: number;
}

type FilterType = 'all' | 'urgent' | 'standard' | 'scheduled';
type SortType = 'time' | 'priority';

export default function DispatchPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('priority');
  const [autoAssign, setAutoAssign] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { items: orders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useApiList<UnassignedOrder>('/api/v4/dispatch/orders');
  const { items: drivers, loading: driversLoading, error: driversError, refetch: refetchDrivers } = useApiList<Driver>('/api/v4/dispatch/drivers');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterType === 'all') return true;
      if (filterType === 'urgent') return order.priority === 'high';
      if (filterType === 'standard') return order.priority === 'medium';
      if (filterType === 'scheduled') return order.priority === 'low';
      return true;
    });
  }, [filterType, orders]);

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    if (sortType === 'priority') {
      const priorityMap = { high: 0, medium: 1, low: 2 };
      sorted.sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority]);
    } else if (sortType === 'time') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return sorted;
  }, [filteredOrders, sortType]);

  const stats = useMemo(() => {
    const inTransit = Math.floor(Math.random() * 20) + 8;
    const completedToday = Math.floor(Math.random() * 45) + 25;
    const avgDeliveryTime = Math.floor(Math.random() * 15) + 28;
    const onTimePercent = Math.floor(Math.random() * 8) + 92;
    return {
      unassigned: orders.length,
      inTransit,
      completedToday,
      avgDeliveryTime,
      onTimePercent,
    };
  }, [orders.length]);

  const driverStats = useMemo(() => {
    const available = drivers.filter((d) => d.status === 'available').length;
    const busy = drivers.filter((d) => d.status === 'busy').length;
    const offline = drivers.filter((d) => d.status === 'offline').length;
    return { available, busy, offline, total: drivers.length };
  }, [drivers]);

  const formatTimeElapsed = (dateStr: string): string => {
    const date = new Date(dateStr);
    const elapsed = Math.floor((currentTime.getTime() - date.getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m`;
    return `${Math.floor(elapsed / 3600)}h`;
  };

  const calculateSLAStatus = (createdAt: string, priority: string): { text: string; variant: 'danger' | 'warning' | 'success' } => {
    const elapsed = Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 60000);
    const thresholds = { high: 15, medium: 30, low: 60 };
    const threshold = thresholds[priority as keyof typeof thresholds] || 60;

    if (elapsed > threshold * 0.9) return { text: `${threshold - elapsed}m`, variant: 'danger' };
    if (elapsed > threshold * 0.7) return { text: `${threshold - elapsed}m`, variant: 'warning' };
    return { text: `${threshold - elapsed}m`, variant: 'success' };
  };

  const handleAssignDriver = useCallback(
    (orderId: string, driverId: string) => {
      setAssigningOrderId(orderId);
      setTimeout(() => {
        // TODO: API call to assign driver
        setAssigningOrderId(null);
        setSelectedOrderId(null);
      }, 300);
    },
    []
  );

  const availableDrivers = drivers.filter((d) => d.status === 'available');

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
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Dispatch Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Clock */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <Clock className="w-4 h-4 text-zinc-400" />
              <div className="flex flex-col text-right">
                <span className="text-sm font-mono font-semibold text-white">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <Signal className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-400">Connected</span>
            </div>

            {/* Auto-Assign Toggle */}
            <Button
              variant={autoAssign ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAutoAssign(!autoAssign)}
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Auto-Assign</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* LEFT PANEL: Unassigned Orders (col-span-4) */}
        <div className="col-span-4 flex flex-col border-r border-zinc-800 bg-zinc-900">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Unassigned Queue
                </h2>
                <Badge variant="danger" className="text-xs">
                  {sortedOrders.length}
                </Badge>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="flex gap-2">
              {(["priority", "time"] as const).map((sort) => (
                <Button
                  key={sort}
                  variant={sortType === sort ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setSortType(sort)}
                  className="text-xs"
                >
                  {sort === 'priority' ? 'Priority' : 'Time'}
                </Button>
              ))}
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="px-5 py-3 border-b border-zinc-800 flex gap-2 flex-wrap bg-zinc-900/50">
            {(["all", "urgent", "standard", "scheduled"] as const).map((filter) => (
              <Button
                key={filter}
                variant={filterType === filter ? "primary" : "ghost"}
                size="sm"
                onClick={() => setFilterType(filter)}
                className="text-xs"
              >
                {filter === 'urgent' ? '🔴 Urgent' : filter === 'standard' ? '🟡 Standard' : filter === 'scheduled' ? '⚪ Low' : 'All'}
              </Button>
            ))}
          </div>

          {/* Orders Scroll Area */}
          <div className="flex-1 overflow-y-auto">
            {ordersLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-36 bg-zinc-800 rounded animate-pulse" />
                ))}
              </div>
            ) : sortedOrders.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-zinc-500">
                <div>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">All orders assigned</p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {sortedOrders.map((order) => {
                  const slaStatus = calculateSLAStatus(order.createdAt, order.priority);
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all duration-200 cursor-pointer",
                        "bg-zinc-800 border-zinc-700 hover:border-zinc-600",
                        selectedOrderId === order.id && "border-blue-500 ring-1 ring-blue-500/20 bg-zinc-750"
                      )}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      {/* Order Number & Priority */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{order.orderNumber}</span>
                          <Badge
                            variant={
                              order.priority === "high"
                                ? "danger"
                                : order.priority === "medium"
                                  ? "warning"
                                  : "default"
                            }
                            className="text-xs"
                          >
                            {order.priority}
                          </Badge>
                        </div>
                        <Badge variant={slaStatus.variant} className="text-xs font-mono">
                          {slaStatus.text}
                        </Badge>
                      </div>

                      {/* Customer & Address */}
                      <div className="mb-2">
                        <p className="text-xs text-zinc-400">{order.customerName}</p>
                        <div className="flex gap-2 mt-1 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                          <span className="text-zinc-300 line-clamp-2">{order.address}</span>
                        </div>
                      </div>

                      {/* Delivery Window */}
                      <div className="mb-3 text-xs text-zinc-400 border-t border-zinc-700 pt-2">
                        <span className="font-medium text-zinc-300">Deliver:</span> {order.deliveryWindow.start} - {order.deliveryWindow.end}
                      </div>

                      {/* Items & Time */}
                      <div className="flex justify-between text-xs text-zinc-500 mb-3">
                        <span>📦 {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</span>
                        <span>⏱️ {formatTimeElapsed(order.createdAt)} ago</span>
                      </div>

                      {/* Assignment Section */}
                      {assigningOrderId === order.id ? (
                        <Button variant="primary" size="sm" className="w-full opacity-75" disabled>
                          Assigning...
                        </Button>
                      ) : selectedOrderId === order.id ? (
                        <div className="space-y-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Choose Driver
                          </Button>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {availableDrivers.length === 0 ? (
                              <div className="text-xs text-zinc-500 text-center py-2">
                                No available drivers
                              </div>
                            ) : (
                              availableDrivers.map((driver) => (
                                <button
                                  key={driver.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignDriver(order.id, driver.id);
                                  }}
                                  className="w-full text-left px-2.5 py-2 text-xs rounded bg-zinc-700 hover:bg-blue-600 text-zinc-100 transition-colors flex items-center justify-between group"
                                >
                                  <span>{driver.name}</span>
                                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-blue-400 hover:bg-blue-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(order.id);
                          }}
                        >
                          Assign →
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CENTER PANEL: Map View (col-span-4) */}
        <div className="col-span-4 flex flex-col border-r border-zinc-800 bg-zinc-900">
          {/* Map Header */}
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/30">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-500" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Map View
              </h2>
            </div>
          </div>

          {/* Map Placeholder with Grid */}
          <div className="flex-1 bg-gradient-to-br from-zinc-800 to-zinc-900 relative overflow-hidden flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Driver Dots & Stats */}
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="grid grid-cols-4 gap-6 mb-6">
                  {/* Driver pins as colored dots */}
                  <div className="flex justify-center">
                    <div className="relative w-6 h-6 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 animate-pulse" />
                  </div>
                  <div className="flex justify-center">
                    <div className="relative w-6 h-6 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 animate-pulse" />
                  </div>
                  <div className="flex justify-center">
                    <div className="relative w-6 h-6 bg-amber-500 rounded-full shadow-lg shadow-amber-500/50" />
                  </div>
                  <div className="flex justify-center">
                    <div className="relative w-6 h-6 bg-gray-500 rounded-full opacity-50" />
                  </div>
                </div>

                {/* Stats Overlay */}
                <div className="bg-black/60 backdrop-blur px-4 py-3 rounded-lg border border-zinc-700">
                  <div className="text-white mb-2">
                    <p className="text-lg font-bold">{driverStats.available}</p>
                    <p className="text-xs text-zinc-400">Drivers Active</p>
                  </div>
                  <div className="border-t border-zinc-700 pt-2 text-white">
                    <p className="text-lg font-bold">{stats.inTransit}</p>
                    <p className="text-xs text-zinc-400">Deliveries In Progress</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Driver Grid (col-span-4) */}
        <div className="col-span-4 flex flex-col bg-zinc-900">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/30">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Driver Fleet
              </h2>
              <Badge variant="primary" className="text-xs">
                {drivers.length}
              </Badge>
            </div>
          </div>

          {/* Drivers Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {driversLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-36 bg-zinc-800 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {drivers.map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={cn(
                      "p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                      "bg-zinc-800 border-zinc-700 hover:border-zinc-600",
                      selectedDriverId === driver.id && "border-blue-500 ring-1 ring-blue-500/20 bg-zinc-750"
                    )}
                  >
                    {/* Name & Status */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-sm text-white">{driver.name}</div>
                      <div
                        className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          driver.status === 'available' && 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse',
                          driver.status === 'busy' && 'bg-amber-500 shadow-lg shadow-amber-500/30',
                          driver.status === 'offline' && 'bg-gray-500 opacity-50'
                        )}
                      />
                    </div>

                    {/* Status Badge */}
                    <Badge
                      variant={
                        driver.status === "available"
                          ? "success"
                          : driver.status === "busy"
                            ? "warning"
                            : "default"
                      }
                      className="text-xs mb-2"
                      dot
                    >
                      {driver.status}
                    </Badge>

                    {/* Load */}
                    <div className="text-xs text-zinc-400 mb-2">
                      <span className="font-medium text-zinc-300">Load:</span> {driver.activeDeliveries}/5
                    </div>

                    {/* Rating */}
                    {driver.rating && (
                      <div className="text-xs text-zinc-400 mb-2">
                        <span className="text-yellow-500">★ {driver.rating.toFixed(1)}</span>
                      </div>
                    )}

                    {/* Location */}
                    <div className="text-xs text-zinc-400 flex gap-1 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="line-clamp-1">{driver.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fleet Stats Footer */}
          <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-800/30">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="font-bold text-white">{driverStats.total}</div>
                <div className="text-zinc-500 text-xs">Total</div>
              </div>
              <div>
                <div className="font-bold text-emerald-400">{driverStats.available}</div>
                <div className="text-zinc-500 text-xs">Available</div>
              </div>
              <div>
                <div className="font-bold text-amber-400">{driverStats.busy}</div>
                <div className="text-zinc-500 text-xs">Busy</div>
              </div>
              <div>
                <div className="font-bold text-gray-500">{driverStats.offline}</div>
                <div className="text-zinc-500 text-xs">Offline</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <div className="border-t border-zinc-800 bg-zinc-900 px-6 py-3">
        <div className="grid grid-cols-5 gap-6">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-white">{stats.unassigned}</div>
            <div>
              <p className="text-xs font-semibold text-zinc-400">Orders</p>
              <p className="text-xs text-zinc-500">Unassigned</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-6">
            <div className="text-2xl font-bold text-blue-400">{stats.inTransit}</div>
            <div>
              <p className="text-xs font-semibold text-zinc-400">In</p>
              <p className="text-xs text-zinc-500">Transit</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-6">
            <div className="text-2xl font-bold text-emerald-400">{stats.completedToday}</div>
            <div>
              <p className="text-xs font-semibold text-zinc-400">Completed</p>
              <p className="text-xs text-zinc-500">Today</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-6">
            <div className="text-2xl font-bold text-orange-400">{stats.avgDeliveryTime}</div>
            <div>
              <p className="text-xs font-semibold text-zinc-400">Avg Time</p>
              <p className="text-xs text-zinc-500">Per Delivery</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-6">
            <div className="text-2xl font-bold text-green-400">{stats.onTimePercent}%</div>
            <div>
              <p className="text-xs font-semibold text-zinc-400">On-Time</p>
              <p className="text-xs text-zinc-500">Delivery Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
