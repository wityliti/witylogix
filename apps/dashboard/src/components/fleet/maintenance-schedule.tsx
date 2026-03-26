"use client";

import { forwardRef, useMemo, type HTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MaintenanceStatus = "overdue" | "due-soon" | "scheduled";
type ServiceType =
  | "oil-change"
  | "tire-rotation"
  | "brake-inspection"
  | "fluid-check"
  | "filter-replacement"
  | "transmission-service"
  | "battery-replacement";

interface MaintenanceItem {
  id: string;
  vehicleId: string;
  vehicleName: string;
  serviceType: ServiceType;
  dueDate: string;
  mileageThreshold?: number;
  currentMileage?: number;
  status: MaintenanceStatus;
  priority: "critical" | "high" | "medium" | "low";
}

interface MaintenanceScheduleProps extends HTMLAttributes<HTMLDivElement> {
  items: MaintenanceItem[];
  sortBy?: "urgency" | "date" | "vehicle";
  maxItems?: number;
  onServiceClick?: (id: string) => void;
}

const serviceLabels: Record<ServiceType, string> = {
  "oil-change": "Oil Change",
  "tire-rotation": "Tire Rotation",
  "brake-inspection": "Brake Inspection",
  "fluid-check": "Fluid Check",
  "filter-replacement": "Filter Replacement",
  "transmission-service": "Transmission Service",
  "battery-replacement": "Battery Replacement",
};

const statusConfig = {
  overdue: {
    badge: "danger",
    icon: AlertCircle,
    label: "Overdue",
  },
  "due-soon": {
    badge: "warning",
    icon: Clock,
    label: "Due Soon",
  },
  scheduled: {
    badge: "success",
    icon: CheckCircle2,
    label: "Scheduled",
  },
} as const;

const priorityConfig = {
  critical: "border-l-4 border-l-wl-danger-400 bg-wl-danger-500/5",
  high: "border-l-4 border-l-wl-warning-400 bg-wl-warning-500/5",
  medium: "border-l-4 border-l-wl-info-400 bg-wl-info-500/5",
  low: "border-l-4 border-l-wl-success-400 bg-wl-success-500/5",
};

const MaintenanceSchedule = forwardRef<
  HTMLDivElement,
  MaintenanceScheduleProps
>(
  (
    {
      items,
      sortBy = "urgency",
      maxItems,
      onServiceClick,
      className,
      ...props
    },
    ref
  ) => {
    const sortedItems = useMemo(() => {
      let sorted = [...items];

      // Sort by urgency/date
      if (sortBy === "urgency") {
        const urgencyOrder = { overdue: 0, "due-soon": 1, scheduled: 2 };
        sorted.sort((a, b) => {
          const urgencyDiff =
            urgencyOrder[a.status] - urgencyOrder[b.status];
          if (urgencyDiff !== 0) return urgencyDiff;
          return (
            new Date(a.dueDate).getTime() -
            new Date(b.dueDate).getTime()
          );
        });
      } else if (sortBy === "date") {
        sorted.sort(
          (a, b) =>
            new Date(a.dueDate).getTime() -
            new Date(b.dueDate).getTime()
        );
      } else if (sortBy === "vehicle") {
        sorted.sort((a, b) =>
          a.vehicleName.localeCompare(b.vehicleName)
        );
      }

      return maxItems ? sorted.slice(0, maxItems) : sorted;
    }, [items, sortBy, maxItems]);

    const overdueCount = sortedItems.filter(
      (i) => i.status === "overdue"
    ).length;
    const dueSoonCount = sortedItems.filter(
      (i) => i.status === "due-soon"
    ).length;

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        {/* Summary badges */}
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <div className="flex gap-2">
            {overdueCount > 0 && (
              <Badge variant="danger">
                {overdueCount} Overdue
              </Badge>
            )}
            {dueSoonCount > 0 && (
              <Badge variant="warning">
                {dueSoonCount} Due Soon
              </Badge>
            )}
          </div>
        )}

        {/* Items list */}
        <div className="space-y-2">
          {sortedItems.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-wl-text-secondary">
                No maintenance scheduled
              </p>
            </Card>
          ) : (
            sortedItems.map((item) => {
              const statusInfo = statusConfig[item.status];
              const StatusIcon = statusInfo.icon;
              const daysUntil = getDaysUntil(item.dueDate);
              const isMileageBased =
                item.mileageThreshold && item.currentMileage;
              const mileageRemaining = isMileageBased
                ? item.mileageThreshold - item.currentMileage
                : null;
              const mileageOverdue =
                mileageRemaining !== null && mileageRemaining < 0;

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "p-4 hover:shadow-md transition-shadow",
                    onServiceClick && "cursor-pointer",
                    priorityConfig[item.priority]
                  )}
                  onClick={() => onServiceClick?.(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Service type and vehicle */}
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-wl-text-primary">
                          {serviceLabels[item.serviceType]}
                        </h4>
                        <span className="text-xs text-wl-text-secondary">
                          • {item.vehicleName}
                        </span>
                      </div>

                      {/* Due date and mileage info */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-wl-text-secondary">
                        <span>
                          {item.status === "overdue"
                            ? `Overdue by ${Math.abs(daysUntil)} days`
                            : `Due in ${daysUntil} days`}
                        </span>
                        <span className="text-wl-border-subtle">•</span>
                        <span>
                          {new Date(item.dueDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>

                        {isMileageBased && (
                          <>
                            <span className="text-wl-border-subtle">•</span>
                            <span>
                              {mileageRemaining! >= 0
                                ? `${Math.abs(mileageRemaining!)} km left`
                                : `${Math.abs(mileageRemaining!)} km overdue`}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Mileage progress bar */}
                      {isMileageBased && (
                        <div className="mt-2 h-1.5 bg-wl-bg-surface rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              mileageOverdue
                                ? "bg-wl-danger-400"
                                : "bg-wl-primary-400"
                            )}
                            style={{
                              width: `${Math.min(
                                (item.currentMileage! /
                                  item.mileageThreshold!) *
                                  100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={statusInfo.badge}
                        className="flex items-center gap-1"
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Show more indicator */}
        {maxItems && items.length > maxItems && (
          <p className="text-xs text-wl-text-secondary text-center pt-2">
            +{items.length - maxItems} more items
          </p>
        )}
      </div>
    );
  }
);

MaintenanceSchedule.displayName = "MaintenanceSchedule";

function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff;
}

export { MaintenanceSchedule };
export type { MaintenanceScheduleProps, MaintenanceItem, MaintenanceStatus };
