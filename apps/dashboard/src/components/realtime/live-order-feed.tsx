"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiList } from "@/hooks/use-api";
import {
  ChevronUp,
  Clock,
  Package,
  AlertCircle,
} from "lucide-react";

interface ApiOrder {
  id: string;
  customerId: string;
  customerName?: string;
  status: string;
  createdAt: string;
  totalAmount?: number;
  itemCount?: number;
}

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  status: "pending" | "assigned" | "in-transit" | "delivered" | "cancelled";
  createdAt: Date;
  amount: number;
  itemCount: number;
}

interface LiveOrderFeedProps {
  className?: string;
  onOrderClick?: (order: Order) => void;
}

const API_STATUS_MAP: Record<string, Order["status"]> = {
  pending: "pending",
  confirmed: "assigned",
  dispatched: "assigned",
  in_transit: "in-transit",
  delivered: "delivered",
  cancelled: "cancelled",
};

const statusColors: Record<Order["status"], { badge: BadgeVariant; bg: string }> = {
  pending: { badge: "warning", bg: "bg-wl-warning-bg" },
  assigned: { badge: "info", bg: "bg-wl-info-bg" },
  "in-transit": { badge: "primary", bg: "bg-wl-primary-500/12" },
  delivered: { badge: "success", bg: "bg-wl-success-bg" },
  cancelled: { badge: "danger", bg: "bg-wl-danger-bg" },
};

const statusLabels: Record<Order["status"], string> = {
  pending: "Pending",
  assigned: "Assigned",
  "in-transit": "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function toOrder(raw: ApiOrder): Order {
  const status = (API_STATUS_MAP[raw.status] ?? "pending") as Order["status"];
  return {
    id: raw.id,
    customerId: raw.customerId,
    customerName: raw.customerName ?? "Unknown Customer",
    status,
    createdAt: new Date(raw.createdAt),
    amount: raw.totalAmount ?? 0,
    itemCount: raw.itemCount ?? 0,
  };
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
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

function OrderCard({ order, onClick }: { order: Order; onClick?: (order: Order) => void }) {
  const { badge, bg: _bg } = statusColors[order.status];
  const statusLabel = statusLabels[order.status];

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
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-wl-text-primary text-sm truncate">
              Order #{order.id.substring(0, 8)}
            </span>
          </div>
          <p className="text-xs text-wl-text-secondary truncate">{order.customerName}</p>
        </div>
        <Badge variant={badge} className="flex-shrink-0">{statusLabel}</Badge>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-wl-text-secondary mb-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(order.createdAt)}</span>
        </div>
        {order.itemCount > 0 && (
          <div className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            <span>{order.itemCount} items</span>
          </div>
        )}
      </div>

      {order.amount > 0 && (
        <div className="pt-2 border-t border-wl-border-subtle">
          <p className="font-semibold text-wl-text-primary text-sm">
            ${order.amount.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}

export function LiveOrderFeed({
  className,
  onOrderClick,
}: LiveOrderFeedProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { items: rawOrders, loading, error, refetch } =
    useApiList<ApiOrder>('/api/v4/orders', { limit: 10 } as Parameters<typeof useApiList>[1]);

  const prevCountRef = useRef(rawOrders.length);

  // Poll for new orders every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Track new arrivals for the "scroll up" nudge
  useEffect(() => {
    if (rawOrders.length > prevCountRef.current && isScrolled) {
      setNewOrderCount((c) => c + (rawOrders.length - prevCountRef.current));
    }
    prevCountRef.current = rawOrders.length;
  }, [rawOrders.length, isScrolled]);

  const orders = rawOrders.map(toOrder);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setIsScrolled(scrollContainerRef.current.scrollTop > 0);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setNewOrderCount(0);
    setIsScrolled(false);
  }, []);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between p-5 border-b border-wl-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase">
            Live Order Feed
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">Real-time order updates</p>
        </div>
        <div className="text-xs text-wl-text-secondary">{orders.length} orders</div>
      </div>

      {newOrderCount > 0 && isScrolled && (
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
              {newOrderCount} new order{newOrderCount !== 1 ? "s" : ""}
            </span>
          </div>
          <ChevronUp className="w-4 h-4 text-wl-primary-400" />
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
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
              <p className="text-xs text-wl-text-secondary">No orders at the moment</p>
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
