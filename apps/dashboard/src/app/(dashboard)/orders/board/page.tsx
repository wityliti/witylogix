"use client";

import { useState, useCallback, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiList } from "@/hooks/use-api";
import { KanbanColumn, OrderStatus } from "@/components/orders/kanban-column";
import { Search, Users, RefreshCw } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  destination: string;
  fullAddress: string;
  createdAt: string;
  priority: "high" | "medium" | "low";
  status: OrderStatus;
  driverName?: string;
  driverInitials?: string;
  value: number;
}

const COLUMN_CONFIG: { status: OrderStatus; title: string }[] = [
  { status: "PENDING", title: "Pending" },
  { status: "CONFIRMED", title: "Confirmed" },
  { status: "ASSIGNED", title: "Assigned" },
  { status: "PICKED_UP", title: "Picked Up" },
  { status: "IN_TRANSIT", title: "In Transit" },
  { status: "DELIVERED", title: "Delivered" },
  { status: "FAILED", title: "Failed" },
  { status: "CANCELLED", title: "Cancelled" },
];

export default function OrderBoardPage() {
  const {
    items: apiOrders,
    loading,
    error,
    refetch,
  } = useApiList<Order>("/api/v4/orders?view=board");
  const [localOrderOverrides, setLocalOrderOverrides] = useState<
    Record<string, OrderStatus>
  >({});
  const orders = useMemo(
    () =>
      apiOrders.map((o) =>
        localOrderOverrides[o.id]
          ? { ...o, status: localOrderOverrides[o.id] }
          : o,
      ),
    [apiOrders, localOrderOverrides],
  );
  const setOrders = useCallback(
    (updater: (prev: Order[]) => Order[]) => {
      const updated = updater(orders);
      const overrides: Record<string, OrderStatus> = {};
      updated.forEach((o, i) => {
        if (o.status !== apiOrders[i]?.status) overrides[o.id] = o.status;
      });
      setLocalOrderOverrides(overrides);
    },
    [orders, apiOrders],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OrderStatus>>(
    new Set(["FAILED", "CANCELLED"]),
  );
  const [sortBy, setSortBy] = useState<"time" | "priority">("time");

  // Get unique drivers for filter
  const drivers = useMemo(() => {
    const driverSet = new Set<string>();
    orders.forEach((order) => {
      if (order.driverInitials) {
        driverSet.add(order.driverInitials);
      }
    });
    return Array.from(driverSet).sort();
  }, [orders]);

  // Filter orders based on search and driver filter
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        searchQuery === "" ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.destination.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDriver =
        selectedDriver === null || order.driverInitials === selectedDriver;

      return matchesSearch && matchesDriver;
    });
  }, [orders, searchQuery, selectedDriver]);

  // Group orders by status
  const ordersByStatus = useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      PENDING: [],
      CONFIRMED: [],
      ASSIGNED: [],
      PICKED_UP: [],
      IN_TRANSIT: [],
      DELIVERED: [],
      FAILED: [],
      CANCELLED: [],
    };

    filteredOrders.forEach((order) => {
      grouped[order.status].push(order);
    });

    return grouped;
  }, [filteredOrders]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetStatus: OrderStatus) => {
      e.preventDefault();

      try {
        const data = JSON.parse(e.dataTransfer.getData("application/json")) as {
          id: string;
          sourceStatus: OrderStatus;
        };

        setOrders((prev) =>
          prev.map((order) =>
            order.id === data.id ? { ...order, status: targetStatus } : order,
          ),
        );
      } catch (error) {
        console.error("Drop error:", error);
      }
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const toggleColumnCollapse = (status: OrderStatus) => {
    setCollapsedColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  const totalOrders = filteredOrders.length;
  const totalValue = filteredOrders.reduce(
    (sum, order) => sum + order.value,
    0,
  );

  if (loading && orders.length === 0) return <LoadingSkeleton />;
  if (error && orders.length === 0)
    return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Order Kanban Board"
        subtitle="Manage orders with drag and drop"
      />

      <div className="flex flex-col gap-4 px-6 py-4">
        {/* Top Bar: Filters & Controls */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3">
              {/* Title & Stats */}
              <div className="flex flex-col gap-1">
                <CardTitle>Orders Dashboard</CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-wl-text-secondary">
                    Total: {totalOrders} orders
                  </span>
                  <span className="text-wl-text-secondary">
                    Value: ${totalValue.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary" />
                  <Input
                    placeholder="Search orders, customers, destinations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Driver Filter */}
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-wl-text-tertiary" />
                  <select
                    value={selectedDriver || ""}
                    onChange={(e) => setSelectedDriver(e.target.value || null)}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm",
                      "bg-wl-bg-overlay border border-wl-border-default",
                      "text-wl-text-primary",
                      "focus:outline-none focus:border-wl-border-strong",
                    )}
                  >
                    <option value="">All Drivers</option>
                    {drivers.map((driver) => (
                      <option key={driver} value={driver}>
                        {driver}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSortBy(sortBy === "time" ? "priority" : "time")
                  }
                >
                  {sortBy === "time" ? "Sort: Time" : "Sort: Priority"}
                </Button>

                {/* Auto-refresh */}
                <Button
                  variant={autoRefresh ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="flex items-center gap-2"
                >
                  <RefreshCw
                    className={cn("w-4 h-4", autoRefresh && "animate-spin")}
                  />
                  {autoRefresh ? "Refreshing" : "Refresh"}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-min">
            {COLUMN_CONFIG.map(({ status, title }) => (
              <KanbanColumn
                key={status}
                status={status}
                title={title}
                orders={ordersByStatus[status]}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
                isCollapsed={collapsedColumns.has(status)}
                onToggleCollapse={() => toggleColumnCollapse(status)}
                sortBy={sortBy}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
