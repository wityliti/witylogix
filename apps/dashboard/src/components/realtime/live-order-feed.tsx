"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useApiList } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, Clock, Package, AlertCircle } from "lucide-react";
import { useOrders, type Order } from "@/hooks/use-orders";

interface LiveOrderFeedProps {
  className?: string;
  onOrderClick?: (order: Order) => void;
}

const statusConfig: Record<string, { badge: BadgeVariant; label: string }> = {
  pending:    { badge: "warning",  label: "Pending" },
  confirmed:  { badge: "info",     label: "Confirmed" },
  assigned:   { badge: "info",     label: "Assigned" },
  in_transit: { badge: "primary",  label: "In Transit" },
  delivered:  { badge: "success",  label: "Delivered" },
  cancelled:  { badge: "danger",   label: "Cancelled" },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function OrderSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-wl-bg-overlay rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <Skeleton className="h-3 w-32 rounded" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderCard({ order, onClick }: { order: Order; onClick?: (o: Order) => void }) {
  const cfg = statusConfig[order.status] ?? { badge: "default" as BadgeVariant, label: order.status };

  return (
    <div
      onClick={() => onClick?.(order)}
      className={cn(
        "bg-wl-bg-overlay rounded-lg p-4 border border-wl-border-subtle",
        "transition-all duration-fast ease-default hover:border-wl-border-default hover:shadow-md",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-wl-text-primary text-sm truncate block">
            Order #{order.id.substring(0, 8)}
          </span>
          <p className="text-xs text-wl-text-secondary truncate">{order.customerName}</p>
        </div>
        <Badge variant={cfg.badge} className="flex-shrink-0">{cfg.label}</Badge>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-wl-text-secondary mb-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(order.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Package className="w-3 h-3" />
          <span>{order.items?.length ?? 0} items</span>
        </div>
      </div>

      <div className="pt-2 border-t border-wl-border-subtle">
        <p className="font-semibold text-wl-text-primary text-sm">
          ${((order.totalAmount ?? 0) / 100).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

const STATUS_NORMALIZE: Record<string, Order["status"]> = {
  PENDING: "pending",
  CONFIRMED: "assigned",
  ASSIGNED: "assigned",
  IN_TRANSIT: "in-transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export function LiveOrderFeed({
  className,
  onOrderClick,
}: LiveOrderFeedProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const { items: rawOrders, loading: isLoading, refetch } =
    useApiList<any>('/api/v4/orders', { limit: 10 });

  const orders = useMemo<Order[]>(() =>
    rawOrders.map((o) => ({
      id: o.id,
      customerId: o.customerId ?? o.id,
      customerName: o.customerName ?? "Unknown",
      status: STATUS_NORMALIZE[o.status] ?? "pending",
      createdAt: new Date(o.createdAt),
      amount: o.totalAmount ?? o.totalPrice ?? 0,
      itemCount: o.itemCount ?? o.items?.length ?? 0,
    })),
  [rawOrders]);

  // Poll for new orders every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Notify when new orders arrive
  useEffect(() => {
    if (orders.length > prevCountRef.current && prevCountRef.current > 0) {
      setNewOrderCount((prev) => (isScrolled ? prev + (orders.length - prevCountRef.current) : 0));
    }
    prevCountRef.current = orders.length;
  }, [orders.length, isScrolled]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    setIsScrolled(scrollRef.current.scrollTop > 0);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setNewCount(0);
    setIsScrolled(false);
  }, []);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between p-5 border-b border-wl-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase">
            Live Order Feed
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">Recent order updates</p>
        </div>
        <div className="text-xs text-wl-text-secondary">{orders.length} orders</div>
      </div>

      {newCount > 0 && isScrolled && (
        <div
          onClick={scrollToTop}
          className={cn(
            "bg-wl-primary-500/20 border-b border-wl-primary-500/30 px-5 py-3",
            "flex items-center justify-between cursor-pointer",
            "hover:bg-wl-primary-500/30 transition-colors duration-fast"
          )}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-wl-primary-400" />
            <span className="text-xs font-semibold text-wl-primary-400">
              {newCount} new order{newCount !== 1 ? "s" : ""}
            </span>
          </div>
          <ChevronUp className="w-4 h-4 text-wl-primary-400" />
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseEnter={() => {/* pause handled by real polling */}}
        onMouseLeave={() => {}}
        className="flex-1 overflow-y-auto space-y-2 p-5"
      >
        {loading ? (
          <OrderSkeleton />
        ) : error ? (
          <div className="flex items-center justify-center h-full text-center py-12">
            <div>
              <AlertCircle className="w-8 h-8 text-wl-danger-400 mx-auto mb-2 opacity-70" />
              <p className="text-xs text-wl-text-secondary">Failed to load orders</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-wl-primary-400 hover:text-wl-primary-500 mt-2"
              >
                Retry
              </button>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center py-12">
            <div>
              <Package className="w-8 h-8 text-wl-text-secondary mx-auto mb-2 opacity-50" />
              <p className="text-xs text-wl-text-secondary">No orders yet</p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onClick={onOrderClick} />
          ))
        )}
      </div>
    </Card>
  );
}
