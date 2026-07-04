"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useApiList } from "@/hooks/use-api";

const HomeLiveMap = dynamic(
  () => import("./components/home-live-map").then((m) => m.HomeLiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] rounded-xl bg-wl-bg-surface border border-wl-border-default animate-pulse" />
    ),
  },
);

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
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-wl-bg-elevated rounded w-24 mb-4" />
        <div className="h-8 bg-wl-bg-elevated rounded w-32 mb-2" />
        <div className="h-3 bg-wl-bg-elevated rounded w-20" />
      </div>
    );
  }

  const accentColor = {
    default: "var(--wl-primary)",
    primary: "var(--wl-primary)",
    success: "var(--wl-success)",
    warning: "var(--wl-warning-400)",
  }[variant];

  return (
    <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6 transition-all duration-200 hover:border-wl-border-strong hover:bg-wl-bg-elevated">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-wl-text-secondary uppercase tracking-wide">
          {label}
        </h3>
      </div>
      <div className="mb-2">
        <p style={{ color: accentColor }} className="text-3xl font-bold">
          {value}
        </p>
      </div>
      {subtitle && <p className="text-xs text-wl-text-tertiary">{subtitle}</p>}
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
    <div className="border-b border-wl-border-default last:border-0 pb-4 last:pb-0 transition-all duration-200 hover:bg-wl-bg-surface/50 px-4 py-3 rounded -mx-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-wl-text-primary truncate">
              {order.customerName ?? `Order #${order.id.slice(0, 8)}`}
            </p>
            <Badge variant={config.badge}>{config.label}</Badge>
          </div>
          <p className="text-sm text-wl-text-tertiary truncate">
            {destination}
          </p>
          {eta && (
            <p className="text-xs text-wl-text-tertiary mt-1">ETA: {eta}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-wl-text-tertiary">
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
    dot: "var(--wl-success-500)",
    label: "AVAILABLE",
  },
  ON_ROUTE: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    text: "text-blue-400",
    dot: "var(--wl-info-500)",
    label: "EN ROUTE",
  },
  ON_BREAK: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-400",
    dot: "var(--wl-warning-500)",
    label: "ON BREAK",
  },
  OFFLINE: {
    bg: "bg-wl-neutral-500/20",
    border: "border-wl-neutral-500/50",
    text: "text-wl-text-secondary",
    dot: "var(--wl-neutral-500)",
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
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-wl-bg-elevated rounded w-24 mb-3" />
        <div className="h-6 bg-wl-bg-elevated rounded w-32 mb-3" />
        <div className="h-3 bg-wl-bg-elevated rounded w-full" />
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
        "bg-wl-bg-surface border border-wl-border-default rounded-lg p-4 transition-all duration-200 hover:border-wl-border-strong",
        config.bg,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-wl-text-primary">{driver.name}</p>
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
          <p className="text-sm font-bold text-wl-text-primary">
            {activeDeliveries}
          </p>
          <p className="text-xs text-wl-text-tertiary">Active</p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
  } = useDashboardStats();
  const { items: recentOrders, loading: ordersLoading } = useApiList<ApiOrder>(
    "/api/v4/orders",
    { limit: 5 },
  );
  const { items: drivers, loading: driversLoading } = useApiList<ApiDriver>(
    "/api/v4/drivers",
    { limit: 8 },
  );

  const driverUtilization =
    drivers.length > 0
      ? Math.round(
          (drivers.filter((d) => d.status !== "OFFLINE").length /
            drivers.length) *
            100,
        )
      : 0;

  return (
    <div className="bg-wl-bg-root min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-wl-text-primary">
              Dashboard
            </h1>
            <p className="text-wl-text-tertiary mt-1">
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
            value={stats?.totalOrders ?? "—"}
            subtitle="All time"
            variant="primary"
            loading={statsLoading}
          />
          <KPICard
            label="Delivered Today"
            value={stats?.deliveredToday ?? "—"}
            subtitle="Completed deliveries"
            variant="success"
            loading={statsLoading}
          />
          <KPICard
            label="Active Drivers"
            value={
              stats ? `${stats.activeDrivers} / ${stats.totalDrivers}` : "—"
            }
            subtitle={`${driverUtilization}% utilization`}
            loading={statsLoading}
          />
          <KPICard
            label="Revenue"
            value={
              stats
                ? `$${stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"
            }
            subtitle="Total revenue"
            variant="success"
            loading={statsLoading}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KPICard
            label="Pending Orders"
            value={stats?.pendingOrders ?? "—"}
            subtitle="Awaiting dispatch"
            variant="warning"
            loading={statsLoading}
          />
          <KPICard
            label="Total Customers"
            value={stats?.totalCustomers ?? "—"}
            subtitle="Registered customers"
            loading={statsLoading}
          />
          <KPICard
            label="Total Drivers"
            value={stats?.totalDrivers ?? "—"}
            subtitle="Active driver roster"
            loading={statsLoading}
          />
        </div>

        {/* Live Delivery Map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Map className="w-5 h-5" />
                Live Delivery Map
              </span>
              <Link
                href="/map"
                className="text-xs font-normal text-wl-text-secondary hover:text-wl-text-primary transition-colors"
              >
                Open full map →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HomeLiveMap />
          </CardContent>
        </Card>

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
                          className="h-16 bg-wl-bg-elevated rounded animate-pulse"
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
                        className="mx-auto text-wl-text-tertiary mb-2"
                      />
                      <p className="text-wl-text-tertiary">No orders yet</p>
                    </div>
                  )}
                </div>
                {recentOrders.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-wl-border-default">
                    <Link
                      href="/orders"
                      className="text-sm text-wl-text-secondary hover:text-wl-text-primary transition-colors"
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
                  ) : drivers.length > 0 ? (
                    drivers
                      .slice(0, 4)
                      .map((driver) => (
                        <DriverStatusCard key={driver.id} driver={driver} />
                      ))
                  ) : (
                    <div className="text-center py-6">
                      <Icon
                        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                        size={32}
                        className="mx-auto text-wl-text-tertiary mb-2"
                      />
                      <p className="text-sm text-wl-text-tertiary">
                        No drivers found
                      </p>
                    </div>
                  )}
                </div>
                {drivers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-wl-border-default">
                    <Link
                      href="/drivers"
                      className="text-sm text-wl-text-secondary hover:text-wl-text-primary transition-colors"
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
