"use client";

import { useState, useMemo, useCallback } from "react";
import { MapPin, Users, Truck, LayoutList, Map } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiList } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   TRACKING OVERVIEW — real API, List/Map toggle
   ═══════════════════════════════════════════════════════════ */

const TrackingMapView = dynamic(
  () => import("./components/tracking-map-view"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[560px] rounded-xl bg-wl-bg-overlay border border-wl-border-default flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-wl-border-strong border-t-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-wl-text-muted">Loading map…</p>
        </div>
      </div>
    ),
  },
);

interface ApiDriver {
  id: string;
  name: string;
  status: "OFFLINE" | "AVAILABLE" | "ON_ROUTE" | "ON_BREAK";
  phone: string;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  vehicleType?: string;
  activeDeliveries?: number;
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
  deliveryLat?: number | null;
  deliveryLng?: number | null;
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

const getOrderStatusVariant = (
  status: string,
): "success" | "primary" | "info" | "warning" | "danger" | "default" => {
  switch (status) {
    case "delivered":
      return "success";
    case "in_transit":
      return "primary";
    case "assigned":
      return "info";
    case "pending":
    case "confirmed":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
};

export default function TrackingPage() {
  const [view, setView] = useState<"list" | "map">("list");
  const {
    items: drivers,
    loading: driversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useApiList<ApiDriver>("/api/v4/dispatch/drivers", { limit: 50 });

  const {
    items: orders,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useApiList<ApiOrder>("/api/v4/orders", { limit: 50 });

  const loading = driversLoading || ordersLoading;
  const error = driversError || ordersError;
  const refetch = useCallback(async () => { await Promise.all([refetchDrivers(), refetchOrders()]); }, [refetchDrivers, refetchOrders]);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled",
      ),
    [orders],
  );

  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === "delivered").length,
    [orders],
  );

  const onlineDriversCount = useMemo(
    () => drivers.filter((d) => d.status !== "OFFLINE").length,
    [drivers],
  );

  const completionRate = useMemo(
    () =>
      orders.length > 0
        ? Math.round((deliveredCount / orders.length) * 100)
        : 0,
    [deliveredCount, orders.length],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-wl-bg-primary p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-wl-text-primary">
              Tracking Overview
            </h1>
            <p className="text-sm text-wl-text-muted mt-0.5">
              Monitor active shipments and delivery progress
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                view === "list"
                  ? "bg-wl-primary text-white"
                  : "text-wl-text-muted hover:text-wl-text-primary",
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setView("map")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                view === "map"
                  ? "bg-wl-primary text-white"
                  : "text-wl-text-muted hover:text-wl-text-primary",
              )}
            >
              <Map className="w-3.5 h-3.5" />
              Map
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <ErrorState message={error.message} onRetry={refetch} />
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Active Deliveries",
              value: activeOrders.length,
              sub: `${orders.length} total orders`,
              icon: <Truck className="w-5 h-5 text-blue-400" />,
              color: "text-blue-400",
            },
            {
              label: "Drivers Online",
              value: onlineDriversCount,
              sub: `${drivers.length > 0 ? Math.round((onlineDriversCount / drivers.length) * 100) : 0}% of ${drivers.length} drivers`,
              icon: <Users className="w-5 h-5 text-emerald-400" />,
              color: "text-emerald-400",
            },
            {
              label: "Completion Rate",
              value: `${completionRate}%`,
              sub: `${deliveredCount} delivered`,
              icon: (
                <span className="w-5 h-5 text-emerald-400 font-bold flex items-center">
                  ✓
                </span>
              ),
              color: "text-emerald-400",
            },
            {
              label: "Total Orders",
              value: orders.length,
              sub: `${deliveredCount} completed`,
              icon: <MapPin className="w-5 h-5 text-violet-400" />,
              color: "text-violet-400",
            },
          ].map((m) => (
            <Card
              key={m.label}
              className="bg-wl-bg-surface border-wl-border-default"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-wl-text-muted font-semibold uppercase tracking-wide">
                    {m.label}
                  </p>
                  {m.icon}
                </div>
                <p className={cn("text-3xl font-bold", m.color)}>{m.value}</p>
                <p className="text-xs text-wl-text-muted mt-2">{m.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {view === "map" ? (
          /* ── MAP VIEW ── */
          <div className="h-[560px]">
            <TrackingMapView
              orders={orders.map((o) => ({
                id: o.id,
                customerName: o.customerName,
                status: o.status,
                deliveryLat: o.deliveryLat,
                deliveryLng: o.deliveryLng,
                deliveryAddress: o.deliveryAddress,
              }))}
              drivers={drivers.map((d) => ({
                id: d.id,
                name: d.name,
                status: d.status,
                lat: d.lat,
                lng: d.lng,
                heading: d.heading,
                vehicleType: d.vehicleType,
                activeDeliveries: d.activeDeliveries,
              }))}
            />
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <>
            {/* Status Breakdown */}
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-wl-text-primary mb-4">
                  Order Status Breakdown
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "Pending", status: "pending", color: "text-amber-400" },
                    { label: "Confirmed", status: "confirmed", color: "text-blue-400" },
                    { label: "In Transit", status: "in_transit", color: "text-indigo-400" },
                    { label: "Delivered", status: "delivered", color: "text-emerald-400" },
                    { label: "Cancelled", status: "cancelled", color: "text-red-400" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="text-center p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-default"
                    >
                      <p className="text-xs text-wl-text-muted font-semibold mb-1">
                        {item.label}
                      </p>
                      <p className={cn("text-2xl font-bold", item.color)}>
                        {orders.filter((o) => o.status === item.status).length}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Drivers */}
            {drivers.length > 0 && (
              <Card className="bg-wl-bg-surface border-wl-border-default">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold text-wl-text-primary mb-4">
                    Drivers ({drivers.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {drivers.slice(0, 6).map((driver) => (
                      <div
                        key={driver.id}
                        className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-default"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-wl-text-primary">
                              {driver.name}
                            </p>
                            <p className="text-xs text-wl-text-muted">
                              {driver.phone}
                            </p>
                          </div>
                          <Badge
                            variant={
                              driver.status === "OFFLINE"
                                ? "default"
                                : driver.status === "AVAILABLE"
                                  ? "success"
                                  : "primary"
                            }
                            dot
                          >
                            {DRIVER_STATUS_LABEL[driver.status] ?? driver.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {drivers.length > 6 && (
                    <p className="text-xs text-wl-text-muted mt-3 text-center">
                      + {drivers.length - 6} more drivers
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Active Orders List */}
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-wl-text-primary mb-4">
                  Active Orders ({activeOrders.length})
                </h2>

                {activeOrders.length === 0 ? (
                  <div className="text-center py-10">
                    <Truck className="w-10 h-10 text-wl-text-muted mx-auto mb-3" />
                    <p className="text-sm text-wl-text-muted">
                      No active orders right now
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-wl-border-default">
                    {activeOrders.slice(0, 20).map((order) => {
                      const progress =
                        ORDER_STATUS_PROGRESS[order.status] ?? 0;
                      return (
                        <div
                          key={order.id}
                          className="py-3 flex items-center gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-mono font-semibold text-wl-text-primary">
                                #{order.id.slice(0, 8)}
                              </p>
                              <Badge
                                variant={getOrderStatusVariant(order.status)}
                              >
                                {order.status.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-wl-text-secondary truncate">
                              {order.customerName} —{" "}
                              {order.deliveryAddress.city}
                            </p>
                          </div>
                          <div className="w-28 shrink-0">
                            <div className="flex justify-between mb-1">
                              <span className="text-[10px] text-wl-text-muted">
                                Progress
                              </span>
                              <span className="text-[10px] text-wl-text-secondary font-semibold">
                                {progress}%
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-wl-bg-overlay overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          {order.estimatedDelivery && (
                            <p className="text-xs text-blue-400 font-semibold shrink-0 hidden sm:block">
                              ETA:{" "}
                              {new Date(
                                order.estimatedDelivery,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {activeOrders.length > 20 && (
                      <div className="pt-3 text-center">
                        <p className="text-xs text-wl-text-muted">
                          + {activeOrders.length - 20} more orders
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
