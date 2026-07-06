"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { VehicleStatusBadgeProps } from "./types";

/**
 * Vehicle Status Badge Component
 * Displays vehicle status with animated indicator for moving vehicles
 */
const VehicleStatusBadge = forwardRef<
  HTMLSpanElement,
  VehicleStatusBadgeProps & HTMLAttributes<HTMLSpanElement>
>(({ status, className, ...props }, ref) => {
  const statusConfig = {
    moving: {
      label: "Moving",
      bgColor: "bg-wl-success-500/12",
      textColor: "text-wl-success-400",
      dotColor: "bg-wl-success-400",
      animate: true,
    },
    idle: {
      label: "Idle",
      bgColor: "bg-wl-warning-500/12",
      textColor: "text-wl-warning-400",
      dotColor: "bg-wl-warning-400",
      animate: false,
    },
    stopped: {
      label: "Stopped",
      bgColor: "bg-wl-danger-500/12",
      textColor: "text-wl-danger-400",
      dotColor: "bg-wl-danger-400",
      animate: false,
    },
    offline: {
      label: "Offline",
      bgColor: "bg-wl-neutral-500/12",
      textColor: "text-wl-neutral-300",
      dotColor: "bg-wl-neutral-400",
      animate: false,
    },
    maintenance: {
      label: "Maintenance",
      bgColor: "bg-wl-info-500/12",
      textColor: "text-wl-info-400",
      dotColor: "bg-wl-info-400",
      animate: false,
    },
  };

  const config = statusConfig[status];

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2.5 py-1",
        "rounded-full",
        "text-xs font-semibold",
        "tracking-wide",
        config.bgColor,
        config.textColor,
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          "flex-shrink-0",
          config.dotColor,
          config.animate && "animate-pulse",
        )}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
});

VehicleStatusBadge.displayName = "VehicleStatusBadge";

export { VehicleStatusBadge };
