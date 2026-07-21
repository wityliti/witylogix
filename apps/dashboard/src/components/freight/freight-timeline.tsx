"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface Milestone {
  status: "booked" | "dispatched" | "picked_up" | "in_transit" | "delivered";
  label: string;
  timestamp?: string;
  estimatedTime?: string;
  isCompleted: boolean;
  isDelayed?: boolean;
}

export interface FreightTimelineProps {
  shipmentId: string;
  currentStatus: Milestone["status"];
  milestones: Milestone[];
  estimatedDelivery?: string;
  actualDelivery?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Freight Timeline Component
 * Horizontal shipment timeline with milestones, delays, and estimated vs actual times
 */
export function FreightTimeline({
  shipmentId,
  currentStatus,
  milestones,
  estimatedDelivery,
  actualDelivery,
  compact = false,
  className,
}: FreightTimelineProps) {
  const statusOrder = [
    "booked",
    "dispatched",
    "picked_up",
    "in_transit",
    "delivered",
  ];

  const completedCount = useMemo(() => {
    return milestones.filter((m) => m.isCompleted).length;
  }, [milestones]);

  const delayedMilestones = useMemo(() => {
    return milestones.filter((m) => m.isDelayed && m.isCompleted);
  }, [milestones]);

  const totalDelay = useMemo(() => {
    if (delayedMilestones.length === 0) return 0;
    return delayedMilestones.length * 2; // Simplified: assume 2 hours per delayed milestone
  }, [delayedMilestones]);

  // Get milestone icon
  const getMilestoneIcon = (status: string) => {
    switch (status) {
      case "booked":
        return "📋";
      case "dispatched":
        return "🚚";
      case "picked_up":
        return "📦";
      case "in_transit":
        return "🛣️";
      case "delivered":
        return "✅";
      default:
        return "•";
    }
  };

  const getStatusColor = (status: string, isCompleted: boolean) => {
    if (!isCompleted) return "text-wl-text-secondary";
    if (status === "delivered") return "text-wl-success-400";
    return "text-wl-primary-400";
  };

  const progress = (completedCount / milestones.length) * 100;

  return (
    <div
      className={cn(
        "rounded-lg border border-wl-border-default bg-wl-bg-elevated p-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-wl-text-primary">
            Shipment Timeline
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">ID: {shipmentId}</p>
        </div>

        {/* Delay Indicator */}
        {totalDelay > 0 && (
          <div className="flex items-center gap-2 bg-wl-danger-500/20 border border-wl-danger-500/30 rounded-md px-2 py-1 flex-shrink-0 ml-4">
            <span className="text-wl-danger-400 text-xs">⚠️</span>
            <span className="text-xs font-medium text-wl-danger-400">
              {totalDelay}h delay
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-wl-text-secondary">Overall Progress</span>
          <span className="text-xs font-semibold text-wl-text-primary">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 bg-wl-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      {!compact && (
        <div className="space-y-3 mb-4">
          {milestones.map((milestone, index) => {
            const isCurrentStatus = milestone.status === currentStatus;
            const isPastStatus = statusOrder.indexOf(milestone.status) <
              statusOrder.indexOf(currentStatus) ||
              milestone.isCompleted;

            return (
              <div key={milestone.status} className="flex gap-4 items-start">
                {/* Timeline Node */}
                <div className="relative flex flex-col items-center pt-1">
                  {/* Node Circle */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg flex-shrink-0",
                      milestone.isCompleted
                        ? "bg-wl-success-500/20 border-wl-success-400"
                        : isCurrentStatus
                          ? "bg-wl-primary-500/20 border-wl-primary-400 animate-pulse"
                          : "bg-wl-bg-secondary border-wl-border-default"
                    )}
                  >
                    {milestone.isCompleted ? "✓" : getMilestoneIcon(milestone.status)}
                  </div>

                  {/* Connector Line */}
                  {index < milestones.length - 1 && (
                    <div
                      className={cn(
                        "w-0.5 h-10 mt-1",
                        isPastStatus
                          ? "bg-wl-success-500"
                          : "bg-wl-border-default"
                      )}
                    />
                  )}
                </div>

                {/* Milestone Info */}
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          getStatusColor(milestone.status, milestone.isCompleted)
                        )}
                      >
                        {milestone.label}
                      </p>

                      {/* Times */}
                      <div className="mt-1 space-y-0.5 text-xs text-wl-text-secondary">
                        {milestone.timestamp && (
                          <p>
                            <span className="font-medium text-wl-text-primary">
                              Actual:
                            </span>{" "}
                            {milestone.timestamp}
                          </p>
                        )}
                        {milestone.estimatedTime && !milestone.isCompleted && (
                          <p>
                            <span className="font-medium text-wl-text-primary">
                              Est:
                            </span>{" "}
                            {milestone.estimatedTime}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Delay Badge */}
                    {milestone.isDelayed && milestone.isCompleted && (
                      <div className="flex-shrink-0 bg-wl-danger-500/20 border border-wl-danger-500/30 rounded px-2 py-1 mt-1">
                        <span className="text-xs font-medium text-wl-danger-400">
                          +2h
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compact View - Milestone Badges */}
      {compact && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          {milestones.map((milestone, index) => (
            <div key={milestone.status} className="flex items-center gap-1">
              <div
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                  milestone.isCompleted
                    ? "bg-wl-success-500/20 text-wl-success-400"
                    : milestone.status === currentStatus
                      ? "bg-wl-primary-500/20 text-wl-primary-400"
                      : "bg-wl-bg-secondary text-wl-text-secondary"
                )}
              >
                {getMilestoneIcon(milestone.status)} {milestone.label}
              </div>
              {index < milestones.length - 1 && (
                <span className="text-wl-text-secondary text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delivery Timeline */}
      <div className="border-t border-wl-border-default pt-4 grid grid-cols-3 gap-4 text-center text-xs">
        <div>
          <p className="text-wl-text-secondary mb-1">Estimated Delivery</p>
          <p className="text-sm font-semibold text-wl-text-primary">
            {estimatedDelivery || "—"}
          </p>
        </div>

        <div>
          <p className="text-wl-text-secondary mb-1">Status</p>
          <p className="text-sm font-semibold capitalize text-wl-primary-400">
            {currentStatus.replace("_", " ")}
          </p>
        </div>

        <div>
          <p className="text-wl-text-secondary mb-1">Actual Delivery</p>
          <p className={cn(
            "text-sm font-semibold",
            actualDelivery ? "text-wl-success-400" : "text-wl-text-secondary"
          )}>
            {actualDelivery || "Pending"}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      {!compact && (
        <div className="border-t border-wl-border-default mt-4 pt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-wl-text-secondary mb-1">Completed Milestones</p>
            <p className="text-lg font-bold text-wl-text-primary">
              {completedCount}/{milestones.length}
            </p>
          </div>
          <div>
            <p className="text-wl-text-secondary mb-1">On-Time Status</p>
            <p className={cn(
              "text-lg font-bold",
              totalDelay === 0 ? "text-wl-success-400" : "text-wl-danger-400"
            )}>
              {totalDelay === 0 ? "On Schedule" : `${totalDelay}h Behind`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
