"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TimelineStatus = "completed" | "active" | "pending" | "error";

interface TimelineItem {
  title: string;
  description?: string;
  timestamp?: string;
  status?: TimelineStatus;
  icon?: ReactNode;
}

interface TimelineProps extends HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[];
  compact?: boolean;
}

const statusConfig: Record<TimelineStatus, { dot: string; line: string; label: string }> = {
  completed: {
    dot: "bg-wl-success-500 border-wl-success-500",
    line: "bg-wl-success-500",
    label: "Completed",
  },
  active: {
    dot: "bg-wl-primary-500 border-wl-primary-500 animate-pulse",
    line: "bg-wl-primary-500",
    label: "Active",
  },
  pending: {
    dot: "bg-wl-neutral-500 border-wl-neutral-500",
    line: "bg-wl-neutral-500",
    label: "Pending",
  },
  error: {
    dot: "bg-wl-danger-500 border-wl-danger-500",
    line: "bg-wl-danger-500",
    label: "Error",
  },
};

const Timeline = forwardRef<HTMLDivElement, TimelineProps>(
  ({ items, compact = false, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-0", className)} {...props}>
        {items.map((item, index) => {
          const status = item.status || "pending";
          const config = statusConfig[status];
          const isLast = index === items.length - 1;

          return (
            <div key={index} className="relative">
              <div className="flex gap-4">
                {/* Timeline line and dot */}
                <div className="flex flex-col items-center">
                  {/* Dot */}
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 bg-wl-bg-primary",
                      "flex items-center justify-center",
                      "relative z-10",
                      config.dot
                    )}
                  >
                    {item.icon && (
                      <span className="text-wl-text-inverse text-xs">
                        {item.icon}
                      </span>
                    )}
                  </div>

                  {/* Line connecting to next item */}
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-20",
                        config.line
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div
                  className={cn(
                    "pb-8 flex-1 pt-0.5",
                    compact ? "space-y-1" : "space-y-2"
                  )}
                >
                  <div>
                    <p
                      className={cn(
                        "font-semibold text-wl-text-primary",
                        compact ? "text-sm" : "text-base"
                      )}
                    >
                      {item.title}
                    </p>
                    <p
                      className={cn(
                        "text-wl-text-secondary",
                        compact ? "text-xs" : "text-sm"
                      )}
                    >
                      {config.label}
                    </p>
                  </div>

                  {item.description && !compact && (
                    <p className="text-sm text-wl-text-tertiary">
                      {item.description}
                    </p>
                  )}

                  {item.timestamp && (
                    <p
                      className={cn(
                        "text-wl-text-tertiary",
                        compact ? "text-xs" : "text-sm"
                      )}
                    >
                      {item.timestamp}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

Timeline.displayName = "Timeline";

export { Timeline };
