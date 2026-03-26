"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, MapPin } from "lucide-react";

type OrderStatus = "PENDING" | "CONFIRMED" | "ASSIGNED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "CANCELLED";
type PriorityLevel = "high" | "medium" | "low";

interface KanbanCardProps {
  id: string;
  orderNumber: string;
  customerName: string;
  destination: string;
  fullAddress: string;
  createdAt: string;
  priority: PriorityLevel;
  status: OrderStatus;
  driverName?: string;
  driverInitials?: string;
  value: number;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}

const getPriorityColor = (priority: PriorityLevel): string => {
  switch (priority) {
    case "high":
      return "bg-wl-danger-500";
    case "medium":
      return "bg-wl-warning-500";
    case "low":
      return "bg-wl-success-500";
  }
};

const getStatusBadgeVariant = (status: OrderStatus) => {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "FAILED":
    case "CANCELLED":
      return "danger";
    case "IN_TRANSIT":
      return "info";
    default:
      return "default";
  }
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export function KanbanCard({
  id,
  orderNumber,
  customerName,
  destination,
  fullAddress,
  createdAt,
  priority,
  status,
  driverName,
  driverInitials,
  value,
  onDragStart,
}: KanbanCardProps) {
  const router = useRouter();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => router.push(`/orders/${id}`)}
      className={cn(
        "group relative p-3 rounded-lg cursor-move",
        "bg-wl-bg-overlay border border-wl-border-default",
        "hover:border-wl-border-strong hover:shadow-md",
        "transition-all duration-200",
        "flex flex-col gap-2",
        "cursor-pointer"
      )}
    >
      {/* Priority left border */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
          getPriorityColor(priority)
        )}
        aria-hidden="true"
      />

      {/* Header: Order number & Badge */}
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <h3 className="text-xs font-bold text-wl-text-primary truncate">
            #{orderNumber}
          </h3>
          <p className="text-xs text-wl-text-secondary truncate">
            {customerName}
          </p>
        </div>
        <Badge variant={getStatusBadgeVariant(status)} className="flex-shrink-0">
          {status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Destination with icon */}
      <div className="flex gap-1.5 items-start text-xs pl-1 min-w-0">
        <MapPin className="w-3 h-3 text-wl-text-tertiary flex-shrink-0 mt-0.5" />
        <span className="text-wl-text-tertiary truncate">{destination}</span>
      </div>

      {/* Time & Value */}
      <div className="flex items-center justify-between gap-2 text-xs pl-1">
        <div className="flex items-center gap-1 text-wl-text-tertiary">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>{formatTime(createdAt)}</span>
        </div>
        <span className="font-semibold text-wl-primary-400">
          ${value.toFixed(2)}
        </span>
      </div>

      {/* Driver avatar (if assigned) */}
      {driverInitials && (
        <div className="flex items-center gap-2 pt-1 pl-1">
          <div
            className={cn(
              "w-6 h-6 rounded-full",
              "bg-gradient-to-br from-wl-primary-500 to-wl-primary-600",
              "text-wl-text-inverse text-xs font-bold",
              "flex items-center justify-center flex-shrink-0"
            )}
            title={driverName || "Driver"}
          >
            {driverInitials}
          </div>
          {driverName && (
            <span className="text-xs text-wl-text-secondary truncate">
              {driverName}
            </span>
          )}
        </div>
      )}

      {/* Hidden: Full address on hover (accessible via title attribute) */}
      <div className="hidden group-hover:block absolute left-0 right-0 top-full mt-2 z-50 bg-wl-bg-surface border border-wl-border-default rounded-lg p-2 text-xs text-wl-text-secondary max-w-xs">
        {fullAddress}
      </div>
    </div>
  );
}
