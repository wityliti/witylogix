"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { MapPin, AlertCircle, Users, Truck, Map, List } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiList, useApiQuery } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import type { DriverLocation } from "@/components/map/driver-location-layer";

// Dynamic imports — avoids SSR issues with Leaflet
const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => ({ default: m.WLMap })),
  { ssr: false }
);
const DriverLocationLayer = dynamic(
  () => import("@/components/map/driver-location-layer").then((m) => ({ default: m.DriverLocationLayer })),
  { ssr: false }
);

interface ApiDriver {
  id: string;
  name: string;
  status: "OFFLINE" | "AVAILABLE" | "ON_ROUTE" | "ON_BREAK";
  phone: string;
}

interface ApiOrder {
  id: string;
  customerName: string;
  status: string;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  driverId?: string;
  estimatedDelivery?: string | null;
  createdAt: string;
}

const DRIVER_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  ON_ROUTE: "En Route",
  ON_BREAK: "On Break",
  OFFLINE: "Offline",
};

const ORDER_STATUS_PROGRESS: Record<string, number> = {
  pending: 0,
  confirmed: 10,
  assigned: 25,
  in_transit: 60,
  delivered: 100,
  cancelled: 0,
};

const getOrderStatusVariant = (status: string) => {
  switch (status) {
    case "delivered": return "success";
    case "in_transit": return "primary";
    case "assigned": return "info";
    case "pending":
    case "confirmed": return "warning";
    case "cancelled": return "danger";
    default: return "default";
  }
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#34d399",
  ON_ROUTE: "#60a5fa",
  ON_BREAK: "#fbbf24",
  OFFLINE: "#6b7280",
};

export default function TrackingPage() {
  const { items: drivers, loading: driversLoading, error: driversError } =
    useApiList<ApiDriver>("/api/v4/drivers", { limit: 50 });

  const { items: orders, loading: ordersLoading, error: ordersError } =
    useApiList<ApiOrder>("/api/v4/orders", { limit: 50 });

  const { data: driverLocations } = useApiQuery<DriverLocation[]>("/api/v4/drivers/locations");

  const [view, setView] = useState<"list" | "map">("list");
  const [mapId, setMapId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const loading = driversLoading || ordersLoading;
  const error = driversError || ordersError;

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled"),
    [orders],
  );

  const onlineDriversCount = useMemo(
    () => drivers.filter((d) => d.status !== "OFFLINE").length,
    [drivers],
  );

  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === "delivered").length,
    [orders],
  );

  const completionRate = useMemo(
    () => (orders.length > 0 ? Math.round((deliveredCount / orders.length) * 100) : 0),
    [deliveredCount, orders.length],
  );

  const mappedDriverLocations: DriverLocation[] = useMemo(
    () => (driverLocations ?? []).filter((d) => d.lat && d.lng),
    [driverLocations],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e] p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Tracking Overview</h1>
            <p className="text-gray-400 text-sm">Monitor active shipments and delivery progress</p>
          </div>
          {/* View toggle */}
          <div className="flex rounded-lg border border-[#1e1e2e] overflow-hidden">
            <button
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-colors ${
                view === "list" ? "bg-blue-600 text-white" : "bg-[#12121a] text-gray-400 hover:text-white"
              }`}
            >
              <List size={14} /> List
            </button>
            <button
              onClick={() => setView("map")}
              aria-pressed={view === "map"}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-colors ${
                view === "map" ? "bg-blue-600 text-white" : "bg-[#12121a] text-gray-400 hover:text-white"
              }`}
            >
              <Map size={14} /> Live Map
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto p-6">
          <Card className="bg-red-900/20 border border-red-800 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-400 mb-1">Tracking Error</h3>
                <p className="text-sm text-red-300">{error.message}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Active Deliveries</p>
              <Truck className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white">{activeOrders.length}</p>
            <p className="text-xs text-emerald-500 mt-2">{orders.length} total orders</p>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Drivers Online</p>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white">{onlineDriversCount}</p>
            <p className="text-xs text-gray-500 mt-2">
              {drivers.length > 0 ? Math.round((onlineDriversCount / drivers.length) * 100) : 0}% of {drivers.length} drivers
            </p>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Completion Rate</p>
              <div className="w-5 h-5 text-emerald-500 text-lg">✓</div>
            </div>
            <p className="text-3xl font-bold text-white">{completionRate}%</p>
            <p className="text-xs text-emerald-500 mt-2">{deliveredCount} delivered</p>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Total Shipments</p>
              <MapPin className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white">{orders.length}</p>
            <p className="text-xs text-gray-500 mt-2">{deliveredCount} completed</p>
          </Card>
        </div>

        {/* MAP VIEW — live driver positions */}
        {view === "map" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* Map */}
            <div>
              {/* Legend */}
              <div className="flex gap-4 flex-wrap mb-3">
                {[
                  { label: "Available", color: "#34d399" },
                  { label: "En Route", color: "#60a5fa" },
                  { label: "On Break", color: "#fbbf24" },
                  { label: "Offline", color: "#6b7280" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[#1e1e2e] overflow-hidden" style={{ height: 520 }}>
                <WLMap center={[40.7128, -74.006]} zoom={10} onReady={setMapId} className="w-full h-full">
                  {mapId && mappedDriverLocations.length > 0 && (
                    <DriverLocationLayer
                      mapId={mapId}
                      drivers={mappedDriverLocations}
                      selectedDriverId={selectedDriverId}
                      onDriverClick={setSelectedDriverId}
                    />
                  )}
                </WLMap>
                {mappedDriverLocations.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none" style={{ zIndex: 500 }}>
                    <MapPin className="w-8 h-8 text-white/10 mb-3" />
                    <p className="text-sm text-white/30">No driver GPS data available</p>
                    <p className="text-xs text-white/20 mt-1">Positions appear once drivers share their location</p>
                  </div>
                )}
              </div>
            </div>

            {/* Driver sidebar */}
            <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 560 }}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Drivers ({drivers.length})
              </div>
              {drivers.map((driver) => {
                const hasLocation = mappedDriverLocations.some((l) => l.id === driver.id);
                return (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(selectedDriverId === driver.id ? null : driver.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedDriverId === driver.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-[#1e1e2e] bg-[#12121a] hover:border-[#2e2e3e]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: STATUS_COLOR[driver.status] ?? "#6b7280" }}
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{driver.name}</p>
                          <p className="text-xs text-gray-400">{driver.phone}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={driver.status === "OFFLINE" ? "default" : driver.status === "AVAILABLE" ? "success" : "primary"}>
                          {DRIVER_STATUS_LABEL[driver.status] ?? driver.status}
                        </Badge>
                        {!hasLocation && (
                          <span className="text-xs text-gray-600">No GPS</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {drivers.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">No drivers assigned</div>
              )}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {view === "list" && (
          <>
            {/* Status Breakdown */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Order Status Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Pending", status: "pending", color: "text-amber-400" },
                  { label: "Confirmed", status: "confirmed", color: "text-blue-400" },
                  { label: "In Transit", status: "in_transit", color: "text-indigo-400" },
                  { label: "Delivered", status: "delivered", color: "text-emerald-400" },
                  { label: "Cancelled", status: "cancelled", color: "text-red-400" },
                ].map((item) => (
                  <div key={item.label} className="text-center p-4 rounded-lg bg-[#1a1a2e] hover:bg-[#1a1a2e]/80 transition-colors">
                    <p className="text-gray-400 text-xs font-semibold mb-2">{item.label}</p>
                    <p className={`text-2xl font-bold ${item.color}`}>
                      {orders.filter((o) => o.status === item.status).length}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Drivers */}
            {drivers.length > 0 && (
              <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Drivers ({drivers.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {drivers.slice(0, 6).map((driver) => (
                    <div key={driver.id} className="p-3 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{driver.name}</p>
                          <p className="text-xs text-gray-400">{driver.phone}</p>
                        </div>
                        <Badge variant={driver.status === "OFFLINE" ? "default" : driver.status === "AVAILABLE" ? "success" : "primary"}>
                          {DRIVER_STATUS_LABEL[driver.status] ?? driver.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Orders */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Orders</h2>
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">No orders found</p>
                ) : (
                  orders.slice(0, 10).map((order) => {
                    const progress = ORDER_STATUS_PROGRESS[order.status] ?? 0;
                    return (
                      <div
                        key={order.id}
                        className="p-3 rounded-lg bg-[#1a1a2e] hover:bg-[#1a1a2e]/80 transition-colors border border-[#1e1e2e]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-white font-mono">#{order.id.slice(0, 8)}</p>
                            <p className="text-xs text-gray-400">{order.customerName}</p>
                          </div>
                          <Badge variant={getOrderStatusVariant(order.status) as "success" | "primary" | "info" | "warning" | "danger" | "default"}>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="mb-2">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-xs text-gray-400">Progress</p>
                            <p className="text-xs font-semibold text-gray-300">{progress}%</p>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {order.deliveryAddress.street}, {order.deliveryAddress.city}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
