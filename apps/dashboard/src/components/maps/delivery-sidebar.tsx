"use client";

import { useMemo, useState, useCallback } from "react";
import { Search, Filter, Clock, Truck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DeliverySidebarProps, Delivery } from "./delivery-types";

type FilterType = "all" | "en-route" | "delivering" | "completed";
type SortType = "eta" | "status" | "distance";

/**
 * Delivery Sidebar Component
 *
 * Lists active deliveries with:
 * - Order #, customer name, driver name
 * - Status badge, ETA, progress bar
 * - Click to select (highlights on map)
 * - Filters: All / En Route / Delivering / Completed
 * - Search by order # or customer name
 * - Sortable by ETA, status, distance
 */
export function DeliverySidebar({
  deliveries,
  selectedDeliveryId,
  onSelectDelivery,
}: DeliverySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("eta");

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      // Status filter
      if (filter !== "all") {
        if (filter === "en-route" && d.status !== "en-route") return false;
        if (filter === "delivering" && d.status !== "delivering") return false;
        if (filter === "completed" && d.status !== "completed") return false;
      } else {
        // Exclude cancelled/completed from "all" view
        if (d.status === "cancelled") return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesOrder = d.orderId.toLowerCase().includes(query);
        const matchesCustomer = d.customerName.toLowerCase().includes(query);
        return matchesOrder || matchesCustomer;
      }

      return true;
    });
  }, [deliveries, filter, searchQuery]);

  // Sort deliveries
  const sortedDeliveries = useMemo(() => {
    const sorted = [...filteredDeliveries];

    switch (sortBy) {
      case "eta":
        sorted.sort((a, b) => {
          if (!a.eta && !b.eta) return 0;
          if (!a.eta) return 1;
          if (!b.eta) return -1;
          return a.eta.getTime() - b.eta.getTime();
        });
        break;
      case "status":
        const statusOrder: Record<string, number> = {
          delivering: 0,
          "en-route": 1,
          pending: 2,
          completed: 3,
        };
        sorted.sort((a, b) => {
          const aOrder = statusOrder[a.status] ?? 99;
          const bOrder = statusOrder[b.status] ?? 99;
          return aOrder - bOrder;
        });
        break;
      case "distance":
        // In a real app, calculate actual distance
        sorted.sort((a, b) => a.progress - b.progress);
        break;
    }

    return sorted;
  }, [filteredDeliveries, sortBy]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "en-route":
        return "info";
      case "delivering":
        return "warning";
      case "completed":
        return "success";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      "en-route": "En Route",
      delivering: "Delivering",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "en-route":
        return <Truck className="w-4 h-4" />;
      case "delivering":
        return <Clock className="w-4 h-4" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full",
      "bg-wl-bg-surface"
    )}>
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-wl-border-default",
        "space-y-3"
      )}>
        <h2 className="font-semibold text-wl-text-primary">
          Active Deliveries
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary" />
          <input
            type="text"
            placeholder="Search order # or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-2",
              "bg-wl-bg-overlay border border-wl-border-default",
              "text-sm text-wl-text-primary placeholder-wl-text-secondary",
              "rounded-md focus:outline-none focus:border-wl-primary-400",
              "transition-colors"
            )}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1 flex-wrap">
          {(["all", "en-route", "delivering", "completed"] as FilterType[]).map(
            (filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded",
                  "transition-all duration-200",
                  filter === filterOption
                    ? "bg-wl-primary-500/20 text-wl-primary-400"
                    : "text-wl-text-secondary hover:bg-wl-bg-overlay"
                )}
              >
                {filterOption === "all"
                  ? "All"
                  : filterOption === "en-route"
                    ? "En Route"
                    : filterOption === "delivering"
                      ? "Delivering"
                      : "Completed"}
              </button>
            )
          )}
        </div>

        {/* Sort */}
        <div className="flex gap-2 items-center">
          <Filter className="w-4 h-4 text-wl-text-secondary" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
            className={cn(
              "flex-1 px-2 py-1.5 text-xs",
              "bg-wl-bg-overlay border border-wl-border-default",
              "text-wl-text-primary rounded",
              "focus:outline-none focus:border-wl-primary-400"
            )}
          >
            <option value="eta">Sort by ETA</option>
            <option value="status">Sort by Status</option>
            <option value="distance">Sort by Progress</option>
          </select>
        </div>
      </div>

      {/* Deliveries List */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        "divide-y divide-wl-border-default"
      )}>
        {sortedDeliveries.length === 0 ? (
          <div className={cn(
            "p-6 text-center",
            "flex flex-col items-center justify-center h-full"
          )}>
            <div className="w-10 h-10 rounded-lg bg-wl-bg-overlay mb-3 flex items-center justify-center">
              <Truck className="w-5 h-5 text-wl-text-secondary" />
            </div>
            <p className="text-sm text-wl-text-secondary font-medium">
              {searchQuery ? "No deliveries found" : "No active deliveries"}
            </p>
          </div>
        ) : (
          sortedDeliveries.map((delivery) => (
            <div
              key={delivery.id}
              onClick={() => onSelectDelivery(delivery.id)}
              className={cn(
                "p-4 cursor-pointer transition-all duration-200",
                "hover:bg-wl-bg-overlay",
                selectedDeliveryId === delivery.id
                  ? "bg-wl-primary-500/10 border-l-2 border-wl-primary-500"
                  : ""
              )}
            >
              {/* Order Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-wl-text-primary truncate">
                    {delivery.orderId}
                  </h3>
                  <p className="text-xs text-wl-text-secondary truncate">
                    {delivery.customerName}
                  </p>
                </div>
                <Badge
                  variant={getStatusBadgeVariant(delivery.status)}
                  className="ml-2 flex-shrink-0"
                >
                  <span className="flex items-center gap-1">
                    {getStatusIcon(delivery.status)}
                    {getStatusLabel(delivery.status)}
                  </span>
                </Badge>
              </div>

              {/* Driver Info */}
              {delivery.driverId && (
                <p className="text-xs text-wl-text-secondary mb-3">
                  <span className="font-medium">Driver:</span> (ID: {delivery.driverId})
                </p>
              )}

              {/* ETA */}
              {delivery.eta && (
                <div className="flex items-center gap-1 text-xs text-wl-text-secondary mb-3">
                  <Clock className="w-3 h-3" />
                  <span>
                    {Math.ceil(
                      (delivery.eta.getTime() - Date.now()) / 60000
                    )}{" "}
                    minutes
                  </span>
                </div>
              )}

              {/* Progress Bar */}
              <div className={cn(
                "w-full h-1.5 rounded-full overflow-hidden",
                "bg-wl-bg-surface"
              )}>
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    delivery.status === "completed"
                      ? "bg-wl-success-500"
                      : "bg-wl-primary-500"
                  )}
                  style={{ width: `${Math.min(delivery.progress, 100)}%` }}
                />
              </div>

              {/* Progress Text */}
              <p className="text-xs text-wl-text-secondary mt-1.5">
                {delivery.progress}% complete
              </p>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      {sortedDeliveries.length > 0 && (
        <div className={cn(
          "p-3 border-t border-wl-border-default",
          "bg-wl-bg-overlay text-xs text-wl-text-secondary text-center"
        )}>
          {sortedDeliveries.length} of {deliveries.length} deliveries
        </div>
      )}
    </div>
  );
}
