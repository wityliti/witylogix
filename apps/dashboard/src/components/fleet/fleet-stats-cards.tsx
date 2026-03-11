"use client";

import { cn } from "@/lib/utils";
import type { FleetStatsCardsProps } from "./types";

/**
 * Fleet Stats Cards Component
 * Responsive grid of 6 stat cards with icons, values, and trend indicators
 */
export function FleetStatsCards({ stats, className }: FleetStatsCardsProps) {
  const getTrendArrow = (trend: number | undefined): string => {
    if (trend === undefined) return "→";
    return trend >= 0 ? "↑" : "↓";
  };

  const getTrendColor = (trend: number | undefined): string => {
    if (trend === undefined) return "text-wl-text-secondary";
    return trend >= 0 ? "text-wl-danger-400" : "text-wl-success-400";
  };

  const cards = [
    {
      title: "Total Vehicles",
      value: stats.totalVehicles.toString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: "text-wl-primary-400",
      trend: undefined,
    },
    {
      title: "Active Now",
      value: stats.activeNow.toString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: "text-wl-success-400",
      trend: undefined,
    },
    {
      title: "Avg Speed",
      value: `${Math.round(stats.avgSpeed)} km/h`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      color: "text-wl-info-400",
      trend: undefined,
    },
    {
      title: "Total Distance",
      value: `${Math.round(stats.totalDistance)} km`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19.5l-7-7.5h4V8h6v4h4l-7 7.5z"
          />
        </svg>
      ),
      color: "text-wl-warning-400",
      trend: stats.totalDistanceTrend,
    },
    {
      title: "Fuel Consumed",
      value: `${Math.round(stats.fuelConsumed)} L`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      ),
      color: "text-wl-danger-400",
      trend: stats.fuelConsumedTrend,
    },
    {
      title: "Alerts Count",
      value: stats.alertsCount.toString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4v2m0-12a9 9 0 110 18 9 9 0 010-18z"
          />
        </svg>
      ),
      color: "text-wl-danger-400",
      trend: stats.alertsTrend,
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4 hover:border-wl-border-strong transition-colors"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-medium text-wl-text-secondary">{card.title}</h3>
            <div className={cn("opacity-70", card.color)}>{card.icon}</div>
          </div>

          {/* Value */}
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-wl-text-primary">{card.value}</div>
            {card.trend !== undefined && (
              <div
                className={cn(
                  "text-sm font-semibold flex items-center gap-0.5",
                  getTrendColor(card.trend)
                )}
              >
                <span>{getTrendArrow(card.trend)}</span>
                <span>{Math.abs(card.trend)}%</span>
              </div>
            )}
          </div>

          {/* Trend indicator bar */}
          {card.trend !== undefined && (
            <div className="mt-3 h-1 bg-wl-bg-overlay rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  card.trend >= 0 ? "bg-gradient-to-r from-wl-danger-400 to-wl-danger-500" : "bg-gradient-to-r from-wl-success-400 to-wl-success-500"
                )}
                style={{
                  width: `${Math.min(Math.abs(card.trend), 100)}%`,
                }}
              />
            </div>
          )}

          {/* Background accent */}
          <div
            className="absolute -bottom-1 -right-1 w-20 h-20 rounded-full opacity-5 -z-10"
            style={{
              background: card.color,
              filter: "blur(20px)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
