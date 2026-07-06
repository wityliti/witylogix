"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DeliveryStatus =
  | "pending"
  | "assigned"
  | "picked-up"
  | "en-route"
  | "delivering"
  | "completed"
  | "failed"
  | "cancelled";

interface DeliveryStatusPillProps extends HTMLAttributes<HTMLDivElement> {
  status: DeliveryStatus;
  lastUpdated?: Date;
  showTimestamp?: boolean;
  compact?: boolean;
}

const statusConfig: Record<
  DeliveryStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "bg-wl-bg-overlay text-wl-text-secondary border-wl-border-subtle",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  assigned: {
    label: "Assigned",
    color: "bg-wl-info-bg text-wl-info-400 border-wl-info-400/30",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
      </svg>
    ),
  },
  "picked-up": {
    label: "Picked Up",
    color: "bg-wl-primary-bg text-wl-primary-400 border-wl-primary-500/30",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-. 9-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-9-2h14V4H6v12z" />
      </svg>
    ),
  },
  "en-route": {
    label: "En Route",
    color: "bg-wl-primary-bg text-wl-primary-400 border-wl-primary-500/30",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM5 12l1.5-4.5h11L19 12H5z" />
      </svg>
    ),
  },
  delivering: {
    label: "Delivering",
    color:
      "bg-wl-warning-bg text-wl-warning-400 border-wl-warning-500/30 animate-pulse",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
      </svg>
    ),
  },
  completed: {
    label: "Completed",
    color: "bg-wl-success-bg text-wl-success-400 border-wl-success-500/30",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  },
  failed: {
    label: "Failed",
    color: "bg-wl-danger-bg text-wl-danger-400 border-wl-danger-500/30",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    ),
  },
  cancelled: {
    label: "Cancelled",
    color:
      "bg-wl-bg-overlay text-wl-text-tertiary border-wl-border-subtle line-through",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
      </svg>
    ),
  },
};

const DeliveryStatusPill = forwardRef<HTMLDivElement, DeliveryStatusPillProps>(
  (
    {
      status,
      lastUpdated,
      showTimestamp = false,
      compact = false,
      className,
      ...props
    },
    ref,
  ) => {
    const config = statusConfig[status];

    const formatTime = (date: Date): string => {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5",
          "px-2.5 py-1.5 rounded-full",
          "border text-xs font-medium transition-all duration-base",
          compact && "px-2 py-1 text-xs gap-1",
          config.color,
          className,
        )}
        {...props}
        title={
          lastUpdated ? `Last updated: ${formatTime(lastUpdated)}` : undefined
        }
      >
        {config.icon}
        <span className={compact ? "hidden sm:inline" : ""}>
          {config.label}
        </span>
        {!compact && showTimestamp && lastUpdated && (
          <span className="text-xs opacity-75 ml-1">
            ({formatTime(lastUpdated)})
          </span>
        )}
      </div>
    );
  },
);

DeliveryStatusPill.displayName = "DeliveryStatusPill";

export { DeliveryStatusPill };
export type { DeliveryStatus };
