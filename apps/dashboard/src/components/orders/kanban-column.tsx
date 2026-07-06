"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { KanbanCard } from "./kanban-card";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

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

interface KanbanColumnProps {
  status: OrderStatus;
  title: string;
  orders: Order[];
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, status: OrderStatus) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  sortBy?: "time" | "priority";
}

export function KanbanColumn({
  status,
  title,
  orders,
  onDragOver,
  onDrop,
  onDragLeave,
  isCollapsed = false,
  onToggleCollapse,
  sortBy = "time",
}: KanbanColumnProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const totalValue = orders.reduce((sum, order) => sum + order.value, 0);

  const sortedOrders = [...orders].sort((a, b) => {
    if (sortBy === "priority") {
      const priorityMap = { high: 0, medium: 1, low: 2 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getHeaderColor = (status: OrderStatus): string => {
    switch (status) {
      case "PENDING":
        return "text-wl-warning-400";
      case "CONFIRMED":
        return "text-wl-primary-400";
      case "ASSIGNED":
        return "text-wl-info-400";
      case "PICKED_UP":
        return "text-wl-info-400";
      case "IN_TRANSIT":
        return "text-wl-info-400";
      case "DELIVERED":
        return "text-wl-success-400";
      case "FAILED":
        return "text-wl-danger-400";
      case "CANCELLED":
        return "text-wl-danger-400";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col flex-shrink-0 w-80 rounded-lg",
        "bg-wl-bg-surface border border-wl-border-default",
        "overflow-hidden transition-all duration-200",
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3",
          "bg-wl-bg-overlay border-b border-wl-border-default",
          "cursor-pointer hover:bg-wl-bg-elevated transition-colors",
        )}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2
            className={cn("font-bold text-sm truncate", getHeaderColor(status))}
          >
            {title}
          </h2>
          <Badge variant="default" className="flex-shrink-0">
            {orders.length}
          </Badge>
        </div>

        {/* Total value */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-wl-text-secondary">
            ${totalValue.toFixed(0)}
          </span>
          {onToggleCollapse && (
            <button
              className="p-1 hover:bg-wl-bg-surface rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
            >
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
              ) : (
                <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Drop Zone & Cards */}
      <div
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
        onDragLeave={onDragLeave}
        className={cn(
          "flex-1 overflow-y-auto p-3 space-y-2 min-h-96",
          "transition-all duration-200",
          dragOverIndex !== null &&
            "bg-wl-primary-500/8 border-l-2 border-wl-primary-500",
        )}
      >
        {isCollapsed ? (
          <div className="text-xs text-wl-text-tertiary py-8 text-center">
            {orders.length} order{orders.length !== 1 ? "s" : ""}
          </div>
        ) : sortedOrders.length > 0 ? (
          sortedOrders.map((order, index) => (
            <KanbanCard
              key={order.id}
              {...order}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({
                    id: order.id,
                    sourceStatus: status,
                  }),
                );
              }}
            />
          ))
        ) : (
          <div className="text-xs text-wl-text-tertiary py-8 text-center">
            No orders
          </div>
        )}
      </div>
    </div>
  );
}
