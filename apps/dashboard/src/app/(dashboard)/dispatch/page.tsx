"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  MapPin,
  Clock,
  Truck,
  Package,
  Signal,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApiList, useApiQuery, useApiMutation } from "@/hooks/use-api";
import { ErrorState } from "@/components/ui/error-state";
import { DispatchLiveMap } from "@/components/dispatch/dispatch-live-map";

// ── Types ───────────────────────────────────────────────────

interface DispatchOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  priority: "low" | "medium" | "high";
  status: string;
  createdAt: string;
  itemCount?: number | null;
  totalWeight?: number | null;
  deliveryWindow?: { start: string; end: string };
  lat: number | null;
  lng: number | null;
}

interface DispatchDriver {
  id: string;
  name: string;
  phone?: string;
  status: string;
  vehicleType: string;
  vehiclePlate?: string | null;
  activeDeliveries: number;
  location: string;
  lat: number | null;
  lng: number | null;
}

interface DispatchStats {
  unassigned: number;
  inTransit: number;
  completedToday: number;
  avgDeliveryTime: number;
  onTimePercent: number;
}

interface ActiveOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  status: string;
  driverId: string | null;
  driverName: string | null;
  estimatedArrival: string | null;
  lat: number | null;
  lng: number | null;
}

type FilterType = "all" | "high" | "medium" | "low";
type SortType = "time" | "priority";

// ── Helpers ─────────────────────────────────────────────────

const normalizeDriverStatus = (
  status: string,
): "available" | "busy" | "break" | "offline" => {
  const s = status?.toUpperCase() ?? "";
  if (s === "AVAILABLE") return "available";
  if (s === "ON_ROUTE") return "busy";
  if (s === "ON_BREAK") return "break";
  return "offline";
};

const PRIORITY_ORDER: Record<DispatchOrder["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const VEHICLE_ICON: Record<string, string> = {
  bicycle: "🚲",
  motorcycle: "🏍",
  car: "🚗",
  van: "🚐",
  truck: "🚛",
};

// ── Order Card ───────────────────────────────────────────────

interface OrderCardProps {
  order: DispatchOrder;
  isSelected: boolean;
  availableDrivers: DispatchDriver[];
  assigningOrderId: string | null;
  currentTime: Date;
  onSelect: (id: string) => void;
  onAssign: (orderId: string, driverId: string) => void;
}

function OrderCard({
  order,
  isSelected,
  availableDrivers,
  assigningOrderId,
  currentTime,
  onSelect,
  onAssign,
}: OrderCardProps) {
  const elapsed = Math.floor(
    (currentTime.getTime() - new Date(order.createdAt).getTime()) / 60000,
  );
  const slaMins = 60;
  const remaining = Math.max(0, slaMins - elapsed);
  const slaVariant =
    remaining < 6 ? "danger" : remaining < 18 ? "warning" : "success";

  const formatElapsed = (): string => {
    if (elapsed < 60) return `${elapsed}m`;
    return `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;
  };

  const isAssigning = assigningOrderId === order.id;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(order.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(order.id);
      }}
      className={cn(
        "p-4 rounded-lg border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        "bg-zinc-800/60 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800",
        isSelected && "border-blue-500 ring-1 ring-blue-500/25 bg-zinc-800",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {order.priority === "high" && (
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          )}
          <span className="text-sm font-bold text-white truncate">
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
            className="text-[10px] px-1.5 py-0"
          >
            {order.priority}
          </Badge>
        </div>
        <Badge
          variant={slaVariant}
          className="text-[10px] font-mono px-1.5 flex-shrink-0"
        >
          {remaining}m
        </Badge>
      </div>

      {/* Customer */}
      <p className="text-xs text-zinc-300 font-medium truncate mb-1">
        {order.customerName}
      </p>

      {/* Address */}
      <div className="flex items-start gap-1.5 mb-2">
        <MapPin className="w-3 h-3 text-zinc-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 line-clamp-2">{order.address}</p>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-3">
        <span>
          <Clock className="inline w-3 h-3 mr-0.5" />
          {formatElapsed()} ago
        </span>
        {order.deliveryWindow && (
          <span>
            {order.deliveryWindow.start}–{order.deliveryWindow.end}
          </span>
        )}
        {order.itemCount != null && (
          <span>
            <Package className="inline w-3 h-3 mr-0.5" />
            {order.itemCount}
          </span>
        )}
      </div>

      {/* Assignment section */}
      {isAssigning ? (
        <Button
          variant="primary"
          size="sm"
          className="w-full opacity-60"
          disabled
        >
          Assigning…
        </Button>
      ) : isSelected ? (
        <div
          className="space-y-1.5"
          onClick={(e) => e.stopPropagation()}
          role="region"
          aria-label="Driver selection"
        >
          <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
            Assign driver
          </p>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {availableDrivers.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2 text-center">
                No available drivers
              </p>
            ) : (
              availableDrivers.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => onAssign(order.id, driver.id)}
                  className="w-full text-left px-2.5 py-2 text-xs rounded bg-zinc-700 hover:bg-blue-600 text-zinc-100 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span>{VEHICLE_ICON[driver.vehicleType] ?? "🚗"}</span>
                    <span className="truncate font-medium">{driver.name}</span>
                    <span className="text-zinc-400 text-[10px] flex-shrink-0">
                      {driver.activeDeliveries} active
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-blue-400 hover:bg-blue-500/10 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(order.id);
          }}
        >
          Assign driver →
        </Button>
      )}
    </div>
  );
}

// ── Driver Card ──────────────────────────────────────────────

interface DriverCardProps {
  driver: DispatchDriver;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function DriverCard({ driver, isSelected, onClick }: DriverCardProps) {
  const status = normalizeDriverStatus(driver.status);
  const statusColor =
    status === "available"
      ? "bg-emerald-500"
      : status === "busy"
        ? "bg-amber-500"
        : status === "break"
          ? "bg-violet-400"
          : "bg-zinc-500";
  const statusLabel =
    status === "available"
      ? "Available"
      : status === "busy"
        ? "In Progress"
        : status === "break"
          ? "On Break"
          : "Offline";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onClick(driver.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(driver.id);
      }}
      className={cn(
        "p-3 rounded-lg border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        "bg-zinc-800/60 border-zinc-700 hover:border-zinc-600",
        isSelected && "border-blue-500 ring-1 ring-blue-500/25",
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-white truncate flex-1">
          {driver.name}
        </p>
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5",
            statusColor,
            status === "available" &&
              "animate-pulse shadow-sm shadow-emerald-500/50",
          )}
        />
      </div>

      <Badge
        variant={
          status === "available"
            ? "success"
            : status === "busy"
              ? "warning"
              : "default"
        }
        className="text-[10px] px-1.5 py-0 mb-2"
      >
        {statusLabel}
      </Badge>

      <div className="text-xs text-zinc-400 flex items-center gap-1 mb-1">
        <span>{VEHICLE_ICON[driver.vehicleType] ?? "🚗"}</span>
        <span className="capitalize">{driver.vehicleType}</span>
        {driver.vehiclePlate && (
          <span className="text-zinc-500 font-mono">
            · {driver.vehiclePlate}
          </span>
        )}
      </div>

      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>{driver.activeDeliveries} active</span>
        {driver.location && (
          <span
            className="text-zinc-600 truncate max-w-24"
            title={driver.location}
          >
            {driver.location}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonCard({ height = "h-32" }: { height?: string }) {
  return <div className={cn(height, "bg-zinc-800 rounded-lg animate-pulse")} />;
}

// ── Stats Skeleton ────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-12 bg-zinc-700 rounded animate-pulse" />
      <div className="space-y-1">
        <div className="h-3 w-16 bg-zinc-700 rounded animate-pulse" />
        <div className="h-3 w-12 bg-zinc-700 rounded animate-pulse" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function DispatchPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("priority");
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // API data
  const {
    items: rawOrders,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useApiList<DispatchOrder>("/api/v4/dispatch/orders");

  const {
    items: rawDrivers,
    loading: driversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useApiList<DispatchDriver>("/api/v4/dispatch/drivers");

  const {
    data: statsData,
    loading: statsLoading,
    refetch: refetchStats,
  } = useApiQuery<DispatchStats>("/api/v4/dispatch/stats");

  const { items: activeOrders, refetch: refetchActive } =
    useApiList<ActiveOrder>("/api/v4/dispatch/active-orders");

  const { execute: assignDriverToOrder } = useApiMutation<{ success: boolean }>(
    "POST",
    "/api/v4/dispatch/assign",
  );

  // Auto-refresh every 30s
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      void refetchOrders();
      void refetchDrivers();
      void refetchStats();
      void refetchActive();
    }, 30000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refetchOrders, refetchDrivers, refetchStats, refetchActive]);

  const handleRefresh = useCallback(() => {
    void refetchOrders();
    void refetchDrivers();
    void refetchStats();
    void refetchActive();
  }, [refetchOrders, refetchDrivers, refetchStats, refetchActive]);

  // Derived: filter + sort orders
  const filteredOrders = useMemo(() => {
    const filtered = rawOrders.filter((o) => {
      if (filterPriority === "all") return true;
      return o.priority === filterPriority;
    });

    const sorted = [...filtered];
    if (sortType === "priority") {
      sorted.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      );
    } else {
      sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return sorted;
  }, [rawOrders, filterPriority, sortType]);

  const availableDrivers = useMemo(
    () =>
      rawDrivers.filter((d) => normalizeDriverStatus(d.status) === "available"),
    [rawDrivers],
  );

  const stats = useMemo(() => {
    return (
      statsData ?? {
        unassigned: rawOrders.length,
        inTransit: activeOrders.length,
        completedToday: 0,
        avgDeliveryTime: 0,
        onTimePercent: 0,
      }
    );
  }, [statsData, rawOrders.length, activeOrders.length]);

  const driverStats = useMemo(() => {
    const available = rawDrivers.filter(
      (d) => normalizeDriverStatus(d.status) === "available",
    ).length;
    const busy = rawDrivers.filter(
      (d) => normalizeDriverStatus(d.status) === "busy",
    ).length;
    const offline = rawDrivers.filter(
      (d) => normalizeDriverStatus(d.status) === "offline",
    ).length;
    return { available, busy, offline, total: rawDrivers.length };
  }, [rawDrivers]);

  const handleAssign = useCallback(
    async (orderId: string, driverId: string) => {
      setAssigningOrderId(orderId);
      try {
        await assignDriverToOrder({ orderId, driverId });
        void refetchOrders();
        void refetchDrivers();
        void refetchStats();
        void refetchActive();
      } finally {
        setAssigningOrderId(null);
        setSelectedOrderId(null);
      }
    },
    [
      assignDriverToOrder,
      refetchOrders,
      refetchDrivers,
      refetchStats,
      refetchActive,
    ],
  );

  // Build map data (unassigned orders + active orders + drivers)
  const mapOrders = useMemo((): Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    address: string;
    status: string;
    priority?: string;
    lat: number | null;
    lng: number | null;
  }> => {
    const pendingWithCoords = rawOrders
      .filter((o) => o.lat != null && o.lng != null)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        address: o.address,
        status: o.status,
        priority: o.priority,
        lat: o.lat,
        lng: o.lng,
      }));
    const activeWithCoords = activeOrders
      .filter((o) => o.lat != null && o.lng != null)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        address: o.address,
        status: o.status,
        priority: undefined,
        lat: o.lat,
        lng: o.lng,
      }));
    return [...pendingWithCoords, ...activeWithCoords];
  }, [rawOrders, activeOrders]);

  const isLoading = ordersLoading || driversLoading;

  if (ordersError || driversError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <ErrorState
          message={
            (ordersError ?? driversError)?.message ??
            "Failed to load dispatch data"
          }
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40 flex-shrink-0 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
        <div className="h-14 px-5 flex items-center justify-between gap-4">
          {/* Brand + live indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
              <h1 className="text-base font-bold text-white tracking-tight">
                Dispatch Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-mono font-semibold text-white tabular-nums">
                {currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>

            {/* Connection */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700">
              <Signal className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
              aria-label="Refresh dispatch data"
            >
              <RefreshCw
                className={cn("w-4 h-4", isLoading && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </header>

      {/* ── 3-Panel Grid ── */}
      <main className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
        {/* LEFT PANEL — Unassigned Queue (3 cols) */}
        <aside className="col-span-3 flex flex-col border-r border-zinc-800 bg-zinc-900 overflow-hidden min-h-0">
          {/* Panel header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 bg-zinc-800/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Queue
                </span>
                {!ordersLoading && (
                  <Badge variant="danger" className="text-[10px] px-1.5">
                    {filteredOrders.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSortType("priority")}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded transition-colors",
                    sortType === "priority"
                      ? "bg-blue-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  Priority
                </button>
                <button
                  type="button"
                  onClick={() => setSortType("time")}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded transition-colors",
                    sortType === "time"
                      ? "bg-blue-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  Time
                </button>
              </div>
            </div>

            {/* Priority filter */}
            <div className="flex gap-1 flex-wrap">
              {(["all", "high", "medium", "low"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterPriority(f)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                    filterPriority === f
                      ? "bg-zinc-700 border-zinc-500 text-white"
                      : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600",
                  )}
                >
                  {f === "all"
                    ? "All"
                    : f === "high"
                      ? "🔴 High"
                      : f === "medium"
                        ? "🟡 Med"
                        : "⚪ Low"}
                </button>
              ))}
            </div>
          </div>

          {/* Orders list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {ordersLoading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} height="h-36" />
                ))}
              </>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 py-12">
                <CheckCircle2 className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">All clear</p>
                <p className="text-xs mt-1">No unassigned orders</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isSelected={selectedOrderId === order.id}
                  availableDrivers={availableDrivers}
                  assigningOrderId={assigningOrderId}
                  currentTime={currentTime}
                  onSelect={(id) =>
                    setSelectedOrderId(selectedOrderId === id ? null : id)
                  }
                  onAssign={handleAssign}
                />
              ))
            )}
          </div>
        </aside>

        {/* CENTER PANEL — Live Map (6 cols) */}
        <section className="col-span-6 flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-hidden min-h-0">
          {/* Map header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Live Map
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span>
                  <span className="text-zinc-300 font-semibold">
                    {driverStats.available}
                  </span>{" "}
                  available
                </span>
                <span>
                  <span className="text-zinc-300 font-semibold">
                    {activeOrders.length}
                  </span>{" "}
                  in transit
                </span>
                {(selectedOrderId ?? selectedDriverId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(null);
                      setSelectedDriverId(null);
                    }}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                    aria-label="Clear selection"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 min-h-0">
            <DispatchLiveMap
              drivers={rawDrivers}
              orders={mapOrders}
              selectedDriverId={selectedDriverId}
              selectedOrderId={selectedOrderId}
              onDriverClick={(id) =>
                setSelectedDriverId(selectedDriverId === id ? null : id)
              }
              onOrderClick={(id) =>
                setSelectedOrderId(selectedOrderId === id ? null : id)
              }
              isLoading={isLoading}
              className="w-full h-full"
            />
          </div>
        </section>

        {/* RIGHT PANEL — Driver Fleet (3 cols) */}
        <aside className="col-span-3 flex flex-col bg-zinc-900 overflow-hidden min-h-0">
          {/* Panel header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800 bg-zinc-800/30">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Fleet
              </span>
              {!driversLoading && (
                <Badge variant="primary" className="text-[10px] px-1.5">
                  {rawDrivers.length}
                </Badge>
              )}
            </div>
          </div>

          {/* Driver list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {driversLoading ? (
              <div className="grid grid-cols-1 gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} height="h-24" />
                ))}
              </div>
            ) : rawDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12 text-center">
                <Truck className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">No active drivers</p>
              </div>
            ) : (
              rawDrivers.map((driver) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  isSelected={selectedDriverId === driver.id}
                  onClick={(id) =>
                    setSelectedDriverId(selectedDriverId === id ? null : id)
                  }
                />
              ))
            )}
          </div>

          {/* Fleet stats footer */}
          <div className="flex-shrink-0 px-4 py-2.5 border-t border-zinc-800 bg-zinc-800/30">
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <div className="text-sm font-bold text-white">
                  {driverStats.total}
                </div>
                <div className="text-[10px] text-zinc-500">Total</div>
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-400">
                  {driverStats.available}
                </div>
                <div className="text-[10px] text-zinc-500">Free</div>
              </div>
              <div>
                <div className="text-sm font-bold text-amber-400">
                  {driverStats.busy}
                </div>
                <div className="text-[10px] text-zinc-500">Busy</div>
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-500">
                  {driverStats.offline}
                </div>
                <div className="text-[10px] text-zinc-500">Away</div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* ── Bottom Stats Bar ── */}
      <footer className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/95">
        <div className="h-14 px-5 flex items-center">
          {statsLoading ? (
            <div className="flex gap-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <StatSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-0 w-full">
              {[
                {
                  value: stats.unassigned,
                  label: "Unassigned",
                  color: "text-white",
                },
                {
                  value: stats.inTransit,
                  label: "In Transit",
                  color: "text-blue-400",
                },
                {
                  value: stats.completedToday,
                  label: "Completed",
                  color: "text-emerald-400",
                },
                {
                  value: `${stats.avgDeliveryTime}m`,
                  label: "Avg Delivery",
                  color: "text-orange-400",
                },
                {
                  value: `${stats.onTimePercent}%`,
                  label: "On-Time",
                  color: "text-green-400",
                },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={cn(
                    "flex items-center gap-3 px-4",
                    i > 0 && "border-l border-zinc-800",
                  )}
                >
                  <div
                    className={cn("text-xl font-bold tabular-nums", stat.color)}
                  >
                    {stat.value}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-400 leading-tight">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
