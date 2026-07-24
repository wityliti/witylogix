"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Clock,
  HelpCircle,
  MapPin,
  Package,
  PackageCheck,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderCard } from "@/components/order-card";
import {
  OrderListSkeleton,
  ErrorMessage,
  Skeleton,
} from "@/components/loading-skeleton";
import { useQuery } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { ApiOrder } from "@/lib/portal-api";
import { ROUTES } from "@/lib/portal-api";
import type { Order, OrderStatus } from "@/types";
import { useMemo } from "react";

// ─── Map API order → portal Order type ───────────────────────

function mapStatus(status: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    PENDING: "pending",
    ACCEPTED: "confirmed",
    ASSIGNED: "confirmed",
    PICKED_UP: "out-for-delivery",
    OUT_FOR_DELIVERY: "out-for-delivery",
    ARRIVED: "out-for-delivery",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
    FAILED: "cancelled",
    RETURNED: "cancelled",
  };
  return statusMap[status] ?? "pending";
}

function mapApiOrder(o: ApiOrder): Order {
  return {
    id: o.id,
    orderNumber: o.externalOrderNumber ?? `#${o.id.slice(-8).toUpperCase()}`,
    status: mapStatus(o.status),
    createdAt: new Date(o.createdAt),
    scheduledDeliveryDate: o.deliveryDate
      ? new Date(o.deliveryDate)
      : new Date(o.createdAt),
    actualDeliveryDate: o.actualDelivery
      ? new Date(o.actualDelivery)
      : undefined,
    items: (o.lineItems ?? []).map((li) => ({
      id: li.id,
      name: li.title,
      quantity: li.quantity,
      price: li.price,
    })),
    deliveryAddress: {
      street: [o.addressLine1, o.addressLine2].filter(Boolean).join(", "),
      city: o.city,
      state: o.province ?? "",
      zipCode: o.postalCode ?? "",
      country: o.country ?? "",
    },
    totalPrice: o.totalPrice ?? 0,
    estimatedDelivery: o.estimatedArrival
      ? format(new Date(o.estimatedArrival), "PPp")
      : undefined,
  };
}

// ─── Paginated envelope ───────────────────────────────────────

interface PaginatedOrders {
  data: ApiOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Quick actions ────────────────────────────────────────────

const quickActions = [
  { label: "Track a Delivery", href: "/track", icon: MapPin },
  { label: "View All Orders", href: "/orders", icon: Package },
  { label: "Get Support", href: "/support", icon: HelpCircle },
] as const;

// ─── Component ────────────────────────────────────────────────

export default function DashboardPage() {
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const { user } = useAuth();

  const { data, loading, error, refetch } = useQuery<PaginatedOrders>(
    `${ROUTES.ORDERS}?limit=20&sortBy=createdAt&sortOrder=desc`,
  );

  const orders = useMemo(() => (data?.data ?? []).map(mapApiOrder), [data]);

  const activeOrders = orders.filter((o) =>
    ["out-for-delivery", "confirmed", "pending"].includes(o.status),
  );
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const pendingOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "confirmed",
  );

  const statsLoading = loading;
  const total = data?.pagination.total ?? 0;

  const statCards = [
    {
      label: "Total Orders",
      value: total,
      icon: Package,
      color: "text-wl-primary-400",
    },
    {
      label: "Active",
      value: activeOrders.length,
      icon: Truck,
      color: "text-wl-info-500",
    },
    {
      label: "Pending",
      value: pendingOrders.length,
      icon: Clock,
      color: "text-wl-warning-500",
    },
    {
      label: "Delivered",
      value: deliveredOrders.length,
      icon: PackageCheck,
      color: "text-wl-success-500",
    },
  ] as const;

  const greeting = user?.name
    ? `Welcome back, ${user.name.split(" ")[0]}`
    : "Welcome back";

  return (
    <div className="page-container">
      {/* Welcome greeting */}
      <div className="page-header animate-fade-in">
        <p className="text-wl-text-tertiary text-sm">{today}</p>
        <h1 className="page-title">{greeting}</h1>
        <p className="page-subtitle">
          Here is an overview of your deliveries and orders.
        </p>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in stagger-1">
        {statCards.map((card) =>
          statsLoading ? (
            <Skeleton key={card.label} className="h-28 w-full" />
          ) : (
            <div
              key={card.label}
              className="section-card flex flex-col items-center gap-2 py-5"
            >
              <card.icon size={24} className={card.color} />
              <p className="text-3xl font-bold text-wl-text-primary">
                {card.value}
              </p>
              <p className="text-sm text-wl-text-secondary">{card.label}</p>
            </div>
          ),
        )}
      </div>

      {/* Quick actions row */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in stagger-1">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "section-card flex-1 flex items-center gap-3 px-4 py-3",
              "hover:border-wl-primary-500/40 transition-colors",
            )}
          >
            <action.icon size={18} className="text-wl-primary-400 shrink-0" />
            <span className="text-sm font-medium text-wl-text-primary">
              {action.label}
            </span>
            <ArrowRight size={14} className="ml-auto text-wl-text-tertiary" />
          </Link>
        ))}
      </div>

      {error && <ErrorMessage message={error.message} onRetry={refetch} />}

      {/* Upcoming / active deliveries */}
      {!error && (
        <section className="animate-fade-in stagger-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-wl-primary-500" />
              <h2 className="text-base font-semibold text-wl-text-primary">
                Active Deliveries
              </h2>
              {!loading && (
                <span className="status-badge text-xs px-2 py-0.5 rounded-full bg-wl-primary-500/10 text-wl-primary-400">
                  {activeOrders.length}
                </span>
              )}
            </div>
            <Link
              href="/orders"
              className="flex items-center gap-1 text-xs font-medium text-wl-text-tertiary hover:text-wl-text-secondary transition-colors"
            >
              View all
              <ArrowRight size={12} />
            </Link>
          </div>

          {loading && <OrderListSkeleton count={2} />}

          {!loading && activeOrders.length === 0 && (
            <div className="section-card flex items-center justify-center py-8">
              <p className="text-sm text-wl-text-tertiary">
                No active deliveries right now.
              </p>
            </div>
          )}

          {!loading && activeOrders.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {activeOrders.slice(0, 4).map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent orders */}
      {!error && (
        <section className="animate-fade-in stagger-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-wl-text-tertiary" />
              <h2 className="text-base font-semibold text-wl-text-primary">
                Recent Orders
              </h2>
            </div>
            <Link
              href="/orders"
              className="flex items-center gap-1 text-xs font-medium text-wl-text-tertiary hover:text-wl-text-secondary transition-colors"
            >
              View all orders
              <ArrowRight size={12} />
            </Link>
          </div>

          {loading && <OrderListSkeleton count={2} />}

          {!loading && orders.length === 0 && (
            <div className="section-card flex items-center justify-center py-8">
              <p className="text-sm text-wl-text-tertiary">No orders yet.</p>
            </div>
          )}

          {!loading && orders.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {orders.slice(0, 4).map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
