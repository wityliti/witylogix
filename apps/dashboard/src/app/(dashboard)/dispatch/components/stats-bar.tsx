"use client";

import { useMemo } from "react";
import { Truck, MapPin, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DispatchStats } from "@witylogix/core/dispatch";

interface StatsBarProps {
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
}

export function StatsBar({ stats, isLoading = false }: StatsBarProps) {
  const cards = useMemo<StatCard[]>(
    () => [
      {
        label: "Active Drivers",
        value: stats.activeDrivers,
        icon: <Truck className="w-5 h-5" />,
        trend: { value: 2, direction: "up" },
      },
      {
        label: "Total Stops",
        value: stats.totalStops,
        icon: <MapPin className="w-5 h-5" />,
        trend: { value: 5, direction: "up" },
      },
      {
        label: "Total Distance",
        value: stats.totalDistance.toFixed(1),
        unit: "km",
        icon: <Clock className="w-5 h-5" />,
        trend: { value: 3, direction: "down" },
      },
      {
        label: "Est. Time",
        value: stats.estimatedHours,
        unit: "hrs",
        icon: <Package className="w-5 h-5" />,
        trend: { value: 1, direction: "down" },
      },
    ],
    [stats]
  );

  return (
    <div className="bg-wl-bg-primary border-b border-wl-border-subtle">
      <div className="max-w-full mx-auto px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, index) => (
            <div
              key={index}
              className={cn(
                "bg-wl-bg-surface rounded-lg border border-wl-border-subtle p-4",
                "transition-all duration-300 hover:border-wl-border-default",
                isLoading && "opacity-60 pointer-events-none"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-wl-text-secondary text-xs font-medium uppercase tracking-wider">
                  {card.label}
                </div>
                <div className="text-wl-text-tertiary">{card.icon}</div>
              </div>

              <div className="flex items-baseline gap-2 mb-3">
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

              {card.trend && !isLoading && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium",
                    card.trend.direction === "up"
                      ? "text-wl-success-400"
                      : "text-wl-warning-400"
                  )}
                >
                  <span>
                    {card.trend.direction === "up" ? "↑" : "↓"}
                    {card.trend.value}%
                  </span>
                  <span className="text-wl-text-tertiary">vs yesterday</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
