"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useOrderStats, useOrders } from "@/hooks/use-orders";
import { useDrivers } from "@/hooks/use-drivers";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

// Shapes matching the real API responses
interface ApiOrder {
  id: string;
  customerName: string | null;
  status: string;
  addressLine1: string | null;
  city: string | null;
  estimatedArrival: string | null;
  createdAt: string;
}

interface ApiDriver {
  id: string;
  name: string;
  status: string; // OFFLINE | AVAILABLE | ON_ROUTE | ON_BREAK
  _count: { orders: number };
}

function Icon({
  d,
  size = 24,
  className = "",
}: {
  d: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

function KPICard({
  label,
  value,
  subtitle,
  variant = "default",
  loading = false,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "primary" | "success" | "warning";
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-24 mb-4" />
        <div className="h-8 bg-zinc-800 rounded w-32 mb-2" />
        <div className="h-3 bg-zinc-800 rounded w-20" />
      </div>
    );
  }

  const accentColor = {
    default: "var(--wl-primary)",
    primary: "var(--wl-primary)",
    success: "var(--wl-success)",
    warning: "#f59e0b",
  }[variant];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </h3>
      </div>
      <div className="mb-2">
        <p style={{ color: accentColor }} className="text-3xl font-bold">
          {value}
        </p>
      </div>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

const ORDER_STATUS_CONFIG: Record<
  string,
  {
    badge: "success" | "warning" | "danger" | "info" | "primary" | "default";
    label: string;
  }
> = {
  PENDING: { badge: "warning", label: "Pending" },
  ACCEPTED: { badge: "info", label: "Accepted" },
  ASSIGNED: { badge: "info", label: "Assigned" },
  PICKED_UP: { badge: "primary", label: "Picked Up" },
  OUT_FOR_DELIVERY: { badge: "primary", label: "In Transit" },
  ARRIVED: { badge: "primary", label: "Arrived" },
  DELIVERED: { badge: "success", label: "Delivered" },
  FAILED: { badge: "danger", label: "Failed" },
  RETURNED: { badge: "danger", label: "Returned" },
  CANCELLED: { badge: "danger", label: "Cancelled" },
};

function OrderFeedItem({ order }: { order: ApiOrder }) {
  const config = ORDER_STATUS_CONFIG[order.status] ?? {
    badge: "default" as const,
    label: order.status,
  };
  const destination =
    [order.addressLine1, order.city].filter(Boolean).join(", ") ||
    "Destination pending";
  const eta = order.estimatedArrival
    ? new Date(order.estimatedArrival).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="border-b border-zinc-800 last:border-0 pb-4 last:pb-0 transition-all duration-200 hover:bg-zinc-900/50 px-4 py-3 rounded -mx-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-gray-100 truncate">
              {order.customerName ?? `Order #${order.id.slice(0, 8)}`}
            </p>
            <Badge variant={config.badge}>{config.label}</Badge>
          </div>
          <p className="text-sm text-gray-500 truncate">{destination}</p>
          {eta && <p className="text-xs text-gray-600 mt-1">ETA: {eta}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-600">
            {new Date(order.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

const DRIVER_STATUS_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; dot: string; label: string }
> = {
  AVAILABLE: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/50",
    text: "text-emerald-400",
    dot: "#10b981",
    label: "AVAILABLE",
  },
  ON_ROUTE: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    text: "text-blue-400",
    dot: "#3b82f6",
    label: "EN ROUTE",
  },
  ON_BREAK: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-400",
    dot: "#f59e0b",
    label: "ON BREAK",
  },
  OFFLINE: {
    bg: "bg-gray-500/20",
    border: "border-gray-500/50",
    text: "text-gray-400",
    dot: "#6b7280",
    label: "OFFLINE",
  },
};

function DriverStatusCard({
  driver,
  loading = false,
}: {
  driver?: ApiDriver;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-24 mb-3" />
        <div className="h-6 bg-zinc-800 rounded w-32 mb-3" />
        <div className="h-3 bg-zinc-800 rounded w-full" />
      </div>
    );
  }

  if (!driver) return null;

  const config =
    DRIVER_STATUS_CONFIG[driver.status] ?? DRIVER_STATUS_CONFIG.OFFLINE;
  const activeDeliveries = driver._count?.orders ?? 0;

  return (
    <div
      className={cn(
        "bg-zinc-900 border border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:border-zinc-700",
        config.bg,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-100">{driver.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.dot }}
            />
            <p className={cn("text-xs font-medium", config.text)}>
              {config.label}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-100">{activeDeliveries}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data: orderStats, loading: statsLoading } = useOrderStats();
  const { data: dashStats, loading: dashLoading, error: statsError } = useDashboardStats();
  const { items: recentApiOrders, loading: ordersLoading } = useOrders({
    limit: 5,
    sort: "-createdAt",
  } as any);
  const { items: drivers, loading: driversLoading } = useDrivers({ limit: 4 });

  const recentOrders: ApiOrder[] = recentApiOrders.map((o) => ({
    id: o.id,
    customerName: o.customerName || null,
    status: o.status,
    addressLine1: o.deliveryAddress?.street || null,
    city: o.city || null,
    estimatedArrival: o.estimatedDelivery || null,
    createdAt: o.createdAt,
  }));

  const displayDrivers: ApiDriver[] = drivers.map((d) => {
    const statusMap: Record<string, string> = {
      online: "AVAILABLE",
      on_delivery: "ON_ROUTE",
      on_break: "ON_BREAK",
      offline: "OFFLINE",
      unavailable: "OFFLINE",
    };
    return {
      id: d.id,
      name: d.name,
      status: statusMap[d.status] ?? "OFFLINE",
      _count: { orders: 0 },
    };
  });

  const totalOrders =
    dashStats?.totalOrders ?? orderStats?.total ?? 0;
  const activeDeliveries = dashStats?.pendingOrders ?? 0;
  const driverUtilization =
    drivers.length > 0
      ? Math.round(
          (drivers.filter((d: any) => d.status !== "offline").length /
            drivers.length) *
            100,
        )
      : 0;
  const todayRevenue =
    dashStats?.revenue != null
      ? `$${dashStats.revenue.toFixed(2)}`
      : "—";

  const overallLoading = statsLoading && dashLoading;

  return (
    <div className="bg-zinc-950 min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Dashboard</h1>
            <p className="text-gray-500 mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/analytics">
              <Button variant="secondary">View Reports</Button>
            </Link>
            <Link href="/orders/create">
              <Button variant="primary">Create Order</Button>
            </Link>
          </div>
        </div>

        {/* Stats error */}
        {statsError && !statsLoading && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg">
            <p className="text-sm text-red-300">
              Failed to load dashboard statistics. Please refresh.
            </p>
          </div>
        )}

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            label="Total Orders"
            value={totalOrders}
            subtitle="Today"
            variant="primary"
            loading={overallLoading}
          />
          <KPICard
            label="Active Deliveries"
            value={activeDeliveries}
            subtitle="In progress"
            variant="success"
            loading={overallLoading}
          />
          <KPICard
            label="Driver Utilization"
            value={`${driverUtilization}%`}
            subtitle={`${drivers.filter((d) => d.status !== "offline").length} active drivers`}
            loading={driversLoading}
          />
          <KPICard
            label="Revenue"
            value={todayRevenue}
            subtitle="Today"
            variant="success"
            loading={overallLoading}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KPICard
            label="Pending Orders"
            value={dashStats?.pendingOrders ?? "—"}
            subtitle="Awaiting dispatch"
            variant="warning"
            loading={statsLoading}
          />
          <KPICard
            label="Total Customers"
            value={dashStats?.totalCustomers ?? "—"}
            subtitle="Registered customers"
            loading={statsLoading}
          />
          <KPICard
            label="Total Drivers"
            value={dashStats?.totalDrivers ?? "—"}
            subtitle="Active driver roster"
            loading={statsLoading}
          />
        </div>

        {/* Main Grid: Left (Orders) + Right (Drivers) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Order Feed - Left Column */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    size={20}
                  />
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-6 px-6">
                  {ordersLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-16 bg-zinc-800 rounded animate-pulse"
                        />
                      ))}
                    </div>
                  ) : recentOrders.length > 0 ? (
                    <div className="space-y-2">
                      {recentOrders.map((order) => (
                        <OrderFeedItem key={order.id} order={order} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Icon
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        size={40}
                        className="mx-auto text-gray-600 mb-2"
                      />
                      <p className="text-gray-500">No orders yet</p>
                    </div>
                  )}
                </div>
                {recentOrders.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <Link
                      href="/orders"
                      className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      View all orders →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Driver Status Grid - Right Column */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" size={20} />
                  Driver Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {driversLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <DriverStatusCard key={i} loading={true} />
                    ))
                  ) : displayDrivers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No drivers found
                    </p>
                  ) : (
                    displayDrivers.map((driver) => (
                      <DriverStatusCard key={driver.id} driver={driver} />
                    ))
                  )}
                </div>
                {drivers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <Link
                      href="/drivers"
                      className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      View all drivers →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Section: Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link href="/orders/create">
                <Button
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-2 h-12"
                >
                  <Icon d="M12 5v14m-7-7h14" size={18} />
                  <span>Create Order</span>
                </Button>
              </Link>
              <Link href="/dispatch">
                <Button
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-2 h-12"
                >
                  <Icon d="M13 10V3L4 14h7v7l9-11h-7z" size={18} />
                  <span>Dispatch</span>
                </Button>
              </Link>
              <Link href="/analytics">
                <Button
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-2 h-12"
                >
                  <Icon d="M18 20V10M12 20V4M6 20v-6" size={18} />
                  <span>Reports</span>
                </Button>
              </Link>
              <Link href="/drivers">
                <Button
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-2 h-12"
                >
                  <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" size={18} />
                  <span>Drivers</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
