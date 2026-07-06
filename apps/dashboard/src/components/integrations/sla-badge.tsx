"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TrendDirection = "improving" | "stable" | "declining";

export interface SLABadgeProps {
  targetPercent: number;
  actualPercent: number;
  uptimePercent: number;
  avgLatencyMs: number;
  errorRatePercent: number;
  trend: TrendDirection;
  className?: string;
}

export function SLABadge({
  targetPercent,
  actualPercent,
  uptimePercent,
  avgLatencyMs,
  errorRatePercent,
  trend,
  className,
}: SLABadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine status color
  const getStatusColor = (): string => {
    if (actualPercent >= targetPercent) {
      return "var(--wl-success-500)";
    } else if (actualPercent >= targetPercent - 1) {
      return "var(--wl-warning-500)";
    } else {
      return "var(--wl-danger-500)";
    }
  };

  const getStatusLabel = (): string => {
    if (actualPercent >= targetPercent) {
      return "On Target";
    } else if (actualPercent >= targetPercent - 1) {
      return "At Risk";
    } else {
      return "Below Target";
    }
  };

  const getTrendIcon = (): string => {
    switch (trend) {
      case "improving":
        return "↑";
      case "declining":
        return "↓";
      case "stable":
        return "→";
      default:
        return "—";
    }
  };

  const getTrendColor = (): string => {
    switch (trend) {
      case "improving":
        return "var(--wl-success-500)";
      case "declining":
        return "var(--wl-danger-500)";
      case "stable":
        return "var(--wl-warning-500)";
      default:
        return "var(--wl-text-secondary)";
    }
  };

  const statusColor = getStatusColor();
  const difference = (actualPercent - targetPercent).toFixed(2);
  const differenceLabel = difference.startsWith("-")
    ? difference
    : `+${difference}`;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Compact badge */}
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
          style={{
            backgroundColor: `${statusColor}15`,
            borderColor: statusColor,
            color: statusColor,
          }}
        >
          {/* Main SLA display */}
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold">
              {actualPercent.toFixed(2)}%
            </span>
            <span className="text-xs opacity-75">/ {targetPercent}%</span>
          </div>

          {/* Separator */}
          <div
            className="w-px h-4"
            style={{ backgroundColor: `${statusColor}40` }}
          />

          {/* Status and trend */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium">{getStatusLabel()}</span>
            <span
              className="text-sm font-semibold"
              style={{ color: getTrendColor() }}
            >
              {getTrendIcon()}
            </span>
          </div>
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-wl-bg-surface border border-wl-border-subtle rounded-lg shadow-lg p-4 min-w-72 animate-in fade-in duration-200">
            {/* Header */}
            <div className="mb-4 pb-3 border-b border-wl-border-subtle">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-wl-text-secondary">
                  SLA Status
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: statusColor }}
                >
                  {getStatusLabel()}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-wl-text-primary">
                  {actualPercent.toFixed(2)}%
                </span>
                <span className="text-sm text-wl-text-secondary">
                  target: {targetPercent}%
                </span>
              </div>
              <div className="text-xs text-wl-text-secondary mt-1">
                Difference:{" "}
                <span style={{ color: statusColor }}>{differenceLabel}%</span>
              </div>
            </div>

            {/* Metrics breakdown */}
            <div className="space-y-3 mb-4">
              {/* Uptime */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-wl-text-secondary">
                    Uptime
                  </span>
                  <span className="text-xs font-semibold text-wl-text-primary">
                    {uptimePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="h-1.5 bg-wl-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-wl-success-500"
                    style={{ width: `${Math.min(uptimePercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Latency */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-wl-text-secondary">
                    Avg Latency
                  </span>
                  <span className="text-xs font-semibold text-wl-text-primary">
                    {avgLatencyMs.toFixed(0)}ms
                  </span>
                </div>
                <div className="text-xs text-wl-text-secondary">
                  {avgLatencyMs > 500
                    ? "High latency detected"
                    : avgLatencyMs > 200
                      ? "Moderate latency"
                      : "Good latency"}
                </div>
              </div>

              {/* Error rate */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-wl-text-secondary">
                    Error Rate
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color:
                        errorRatePercent > 5
                          ? "var(--wl-danger-600)"
                          : errorRatePercent > 1
                            ? "var(--wl-warning-600)"
                            : "var(--wl-success-600)",
                    }}
                  >
                    {errorRatePercent.toFixed(3)}%
                  </span>
                </div>
                <div className="h-1.5 bg-wl-surface-hover rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full",
                      errorRatePercent > 5
                        ? "bg-wl-danger-500"
                        : errorRatePercent > 1
                          ? "bg-wl-warning-500"
                          : "bg-wl-success-500",
                    )}
                    style={{
                      width: `${Math.min((errorRatePercent / 10) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Trend */}
            <div className="flex items-center gap-2 p-2 rounded bg-wl-surface-hover">
              <span className="text-lg" style={{ color: getTrendColor() }}>
                {getTrendIcon()}
              </span>
              <span className="text-xs text-wl-text-secondary">
                {trend === "improving" && "Trend improving"}
                {trend === "stable" && "Trend stable"}
                {trend === "declining" && "Trend declining"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
