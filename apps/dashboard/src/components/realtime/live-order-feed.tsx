"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, Clock, Package, AlertCircle, RefreshCw } from "lucide-react";
import { useApiList } from "@/hooks/use-api";
import Link from "next/link";

interface ApiOrder {
  id: string;
  status: string;
  totalPrice: string | number | null;
  createdAt: string;
  customer?: { name?: string; email?: string } | null;
  customerName?: string | null;
  shopifyOrderNumber?: string | null;
}

interface LiveOrderFeedProps {
  className?: string;
}

const statusMap: Record<string, { badge: BadgeVariant; label: string }> = {
  PENDING: { badge: "warning", label: "Pending" },
  CONFIRMED: { badge: "info", label: "Confirmed" },
  ASSIGNED: { badge: "info", label: "Assigned" },
  IN_TRANSIT: { badge: "primary", label: "In Transit" },
  DELIVERED: { badge: "success", label: "Delivered" },
  CANCELLED: { badge: "danger", label: "Cancelled" },
  FAILED: { badge: "danger", label: "Failed" },
};

function normalizeStatus(status: string) {
  return statusMap[status.toUpperCase()] ?? { badge: "default" as BadgeVariant, label: status };
}

function timeAgo(ts: string): string {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function OrderSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-wl-bg-overlay rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: ApiOrder }) {
  const { badge, label } = normalizeStatus(order.status);
  const amount = order.totalPrice != null ? parseFloat(String(order.totalPrice)) : null;
  const customerName = order.customerName ?? order.customer?.name ?? order.customer?.email ?? "Customer";
  const orderRef = order.shopifyOrderNumber ?? `#${order.id.slice(0, 8)}`;

  return (
    <Link href={`/orders/${order.id}`}>
      <div className={cn(
        "bg-wl-bg-overlay rounded-lg p-4 border border-wl-border-subtle",
        "transition-all hover:border-wl-border-default hover:shadow-md cursor-pointer"
      )}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-wl-text-primary text-sm truncate block">
              Order {orderRef}
            </span>
            <p className="text-xs text-wl-text-secondary truncate">{customerName}</p>
          </div>
          <Badge variant={badge} className="flex-shrink-0">{label}</Badge>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-wl-text-secondary mt-2">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(order.createdAt)}</span>
          </div>
          {amount !== null && (
            <span className="font-semibold text-wl-text-primary">${amount.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function LiveOrderFeed({ className }: LiveOrderFeedProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { items: orders, loading, error, refetch } = useApiList<ApiOrder>("/api/v4/orders", {
    limit: 10,
    sort: "createdAt:desc",
  });

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setIsScrolled(scrollContainerRef.current.scrollTop > 0);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setIsScrolled(false);
  }, []);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between p-5 border-b border-wl-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase">
            Recent Orders
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">
            {loading ? "Loading…" : error ? "Error loading orders" : `${orders.length} orders`}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded hover:bg-wl-bg-overlay transition-colors text-wl-text-secondary"
          aria-label="Refresh orders"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {isScrolled && (
        <div
          onClick={scrollToTop}
          className="bg-wl-primary-500/20 border-b border-wl-primary-500/30 px-5 py-2 flex items-center justify-between cursor-pointer hover:bg-wl-primary-500/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-wl-primary-400" />
            <span className="text-xs font-semibold text-wl-primary-400">Scroll to top</span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-wl-primary-400" />
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading ? (
          <OrderSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 p-4 text-center">
            <AlertCircle className="w-6 h-6 text-wl-danger-400 opacity-60" />
            <p className="text-xs text-wl-text-secondary">Failed to load orders</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 p-4 text-center">
            <Package className="w-6 h-6 text-wl-text-secondary opacity-40" />
            <p className="text-xs text-wl-text-secondary">No recent orders</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
