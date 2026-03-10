"use client";

import { forwardRef, type HTMLAttributes } from "react";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  MapPin,
  Package,
  XCircle,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DeliveryStatus =
  | "pending"
  | "assigned"
  | "picking_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "cancelled"
  | "returned";

type BadgeSize = "sm" | "md" | "lg";

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: DeliveryStatus;
  size?: BadgeSize;
}

interface StatusConfig {
  color: string;
  icon: any;
  label: string;
  animated: boolean;
}

const statusConfig: Record<DeliveryStatus, StatusConfig> = {
  pending: {
    color: "text-wl-warning-400 bg-wl-warning-bg",
    icon: Clock,
    label: "Pending",
    animated: false,
  },
  assigned: {
    color: "text-wl-info-400 bg-wl-info-bg",
    icon: Package,
    label: "Assigned",
    animated: false,
  },
  picking_up: {
    color: "text-wl-primary-400 bg-wl-primary-500/12",
    icon: Package,
    label: "Picking Up",
    animated: false,
  },
  in_transit: {
    color: "text-wl-primary-400 bg-wl-primary-500/12",
    icon: Truck,
    label: "In Transit",
    animated: true,
  },
  out_for_delivery: {
    color: "text-wl-primary-400 bg-wl-primary-500/12",
    icon: MapPin,
    label: "Out for Delivery",
    animated: true,
  },
  delivered: {
    color: "text-wl-success-400 bg-wl-success-bg",
    icon: CheckCircle,
    label: "Delivered",
    animated: false,
  },
  failed: {
    color: "text-wl-danger-400 bg-wl-danger-bg",
    icon: XCircle,
    label: "Failed",
    animated: false,
  },
  cancelled: {
    color: "text-wl-neutral-400 bg-white/6",
    icon: AlertCircle,
    label: "Cancelled",
    animated: false,
  },
  returned: {
    color: "text-wl-warning-400 bg-wl-warning-bg",
    icon: RotateCw,
    label: "Returned",
    animated: false,
  },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-1 text-xs gap-1",
  md: "px-2.5 py-1.5 text-sm gap-1.5",
  lg: "px-3 py-2 text-base gap-2",
};

const iconSizeClasses: Record<BadgeSize, string> = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, size = "md", className, ...props }, ref) => {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1",
          "font-semibold rounded-full",
          "tracking-wide uppercase",
          "leading-relaxed whitespace-nowrap",
          "transition-all duration-fast ease-default",
          config.color,
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {config.animated && (
          <span className="relative inline-flex">
            <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-current" />
          </span>
        )}
        <Icon className={cn("flex-shrink-0", iconSizeClasses[size])} />
        <span>{config.label}</span>
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";

export { StatusBadge };
