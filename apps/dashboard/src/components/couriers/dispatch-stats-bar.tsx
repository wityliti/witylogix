"use client";

import { useMemo } from "react";
import { Truck, Package, Clock, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface DispatchStats {
  activeCouriers: number;
  pendingDeliveries: number;
  inTransitCount: number;
  completedToday: number;
  avgDeliveryTime: number;
  onTimePercentage: number;
}

interface DispatchStatsBarProps {
  stats: DispatchStats;
  isLoading?: boolean;
}

interface StatCard {
  label: string;
  value: number | string;
  unit?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  color?: "primary" | "success" | "warning" | "danger" | "info";
}

const getColorClasses = (color: string) => {
  switch (color) {
    case "success":
      return {
        bg: "bg-wl-success-bg",
        text: "text-wl-success-400",
        border: "border-wl-success-400/20",
      };
    case "warning":
      return {
        bg: "bg-wl-warning-bg",
        text: "text-wl-warning-400",
        border: "border-wl-warning-400/20",
      };
    case "danger":
      return {
        bg: "bg-wl-danger-bg",
        text: "text-wl-danger-400",
        border: "border-wl-danger-400/20",
      };
    case "info":
      return {
        bg: "bg-wl-info-bg",
        text: "text-wl-info-400",
        border: "border-wl-info-400/20",
      };
    case "primary":
    default:
      return {
        bg: "bg-wl-primary-500/12",
        text: "text-wl-primary-400",
        border: "border-wl-primary-400/20",
      };
  }
};

export function DispatchStatsBar({
  stats,
  isLoading = false,
}: DispatchStatsBarProps) {
  const cards = useMemo<StatCard[]>(
    () => [
      {
        label: "Active Couriers",
        value: stats.activeCouriers,
        icon: <Truck className="w-5 h-5" />,
        color: "primary",
      },
      {
        label: "Pending",
        value: stats.pendingDeliveries,
        icon: <Package className="w-5 h-5" />,
        color: "danger",
      },
      {
        label: "In Transit",
        value: stats.inTransitCount,
        icon: <Zap className="w-5 h-5" />,
        color: "warning",
      },
      {
        label: "Completed Today",
        value: stats.completedToday,
        icon: <CheckCircle2 className="w-5 h-5" />,
        color: "success",
      },
      {
        label: "Avg Delivery Time",
        value: stats.avgDeliveryTime,
        unit: "min",
        icon: <Clock className="w-5 h-5" />,
        color: "info",
      },
    ],
    [stats],
  );

  return (
    <div className="bg-wl-bg-primary border-b border-wl-border-subtle">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {cards.map((card, index) => {
            const colorClasses = getColorClasses(card.color || "primary");

            return (
              <div
                key={index}
                className={cn(
                  "relative overflow-hidden rounded-lg border p-4",
                  "bg-wl-bg-surface border-wl-border-subtle",
                  "transition-all duration-300 hover:border-wl-border-default",
                  isLoading && "opacity-60 pointer-events-none",
                )}
              >
                {/* Color accent bar */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    card.color === "success" && "bg-wl-success-400",
                    card.color === "warning" && "bg-wl-warning-400",
                    card.color === "danger" && "bg-wl-danger-400",
                    card.color === "info" && "bg-wl-info-400",
                    card.color === "primary" && "bg-wl-primary-400",
                  )}
                />

                <div className="flex items-start justify-between mb-2 pt-1">
                  <div className="text-wl-text-secondary text-xs font-medium uppercase tracking-wider">
                    {card.label}
                  </div>
                  <div className={cn("p-2 rounded-lg", colorClasses.bg)}>
                    <div className={cn("w-4 h-4", colorClasses.text)}>
                      {card.icon}
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <div className="text-2xl font-bold text-wl-text-primary">
                    {isLoading ? (
                      <div className="h-8 w-16 bg-wl-bg-overlay rounded animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </div>
                  {card.unit && (
                    <span className="text-sm text-wl-text-secondary font-medium">
                      {card.unit}
                    </span>
                  )}
                </div>

                {/* On-time gauge for last card */}
                {index === cards.length - 1 && !isLoading && (
                  <div className="mt-3 pt-3 border-t border-wl-border-subtle">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-wl-text-secondary">
                        On-time Rate
                      </span>
                      <span className="text-sm font-semibold text-wl-success-400">
                        {stats.onTimePercentage}%
                      </span>
                    </div>
                    <svg viewBox="0 0 100 12" className="w-full h-2">
                      {/* Background */}
                      <rect
                        x="0"
                        y="4"
                        width="100"
                        height="4"
                        rx="2"
                        fill="rgb(55, 65, 81)"
                      />
                      {/* Progress */}
                      <rect
                        x="0"
                        y="4"
                        width={stats.onTimePercentage}
                        height="4"
                        rx="2"
                        fill="rgb(34, 197, 94)"
                      />
                    </svg>
                  </div>
                )}

                {/* Trend */}
                {card.trend && !isLoading && index < cards.length - 1 && (
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      card.trend.direction === "up"
                        ? "text-wl-success-400"
                        : "text-wl-warning-400",
                    )}
                  >
                    <span>
                      {card.trend.direction === "up" ? "↑" : "↓"}
                      {card.trend.value}%
                    </span>
                    <span className="text-wl-text-tertiary text-xs">
                      vs yesterday
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
