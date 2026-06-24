"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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

export function LiveOrderFeed({ className, onOrderClick }: LiveOrderFeedProps) {
  const { items: orders, loading, error, refetch } = useOrders({ limit: 10 });
  const [isScrolled, setIsScrolled] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Poll every 30 s for new orders
  useEffect(() => {
    const id = setInterval(() => {
      const prev = prevCountRef.current;
      refetch().then(() => {
        if (orders.length > prev && isScrolled) {
          setNewCount((c) => c + (orders.length - prev));
        }
        prevCountRef.current = orders.length;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [refetch, orders.length, isScrolled]);

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
