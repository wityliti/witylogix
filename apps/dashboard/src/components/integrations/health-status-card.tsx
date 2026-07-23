"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type HealthStatus = "healthy" | "degraded" | "down";

export interface HealthStatusCardProps {
  id: string;
  providerName: string;
  category: string;
  status: HealthStatus;
  uptimePercent: number;
  lastCheckTime: Date;
  healthHistory: number[]; // 24hr array of uptime percentages
  recentErrors?: string[];
  latencyP95?: number;
  circuitBreakerState?: "closed" | "open" | "half-open";
  onNavigateToDetail?: () => void;
  className?: string;
}

export function HealthStatusCard({
  id,
  providerName,
  category,
  status,
  uptimePercent,
  lastCheckTime,
  healthHistory,
  recentErrors,
  latencyP95,
  circuitBreakerState,
  onNavigateToDetail,
  className,
}: HealthStatusCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (): string => {
    switch (status) {
      case "healthy":
        return "var(--wl-success-500)";
      case "degraded":
        return "var(--wl-warning-500)";
      case "down":
        return "var(--wl-danger-500)";
      default:
        return "var(--wl-border-subtle)";
    }
  };

  const getStatusLabel = (): string => {
    switch (status) {
      case "healthy":
        return "Healthy";
      case "degraded":
        return "Degraded";
      case "down":
        return "Down";
      default:
        return "Unknown";
    }
  };

  const getStatusIcon = (): string => {
    switch (status) {
      case "healthy":
        return "✓";
      case "degraded":
        return "⚠";
      case "down":
        return "✕";
      default:
        return "?";
    }
  };

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  // Create sparkline SVG
  const sparklineWidth = 120;
  const sparklineHeight = 40;
  const maxValue = 100;
  const minValue = Math.min(...healthHistory);
  const range = maxValue - minValue;
  const pointSpacing = sparklineWidth / (healthHistory.length - 1);

  const sparklinePoints = healthHistory
    .map(
      (value, idx) =>
        `${idx * pointSpacing},${sparklineHeight - (value / 100) * sparklineHeight}`
    )
    .join(" ");

  const circuitBreakerColor =
    circuitBreakerState === "closed"
      ? "var(--wl-success-500)"
      : circuitBreakerState === "open"
        ? "var(--wl-danger-500)"
        : "var(--wl-warning-500)";

  return (
    <div className={cn("w-full", className)}>
      <div
        className="border rounded-lg bg-wl-bg-surface p-4 transition-all hover:shadow-md"
        style={{
          borderColor: getStatusColor(),
          borderLeftWidth: "4px",
          borderTopWidth: "1px",
          borderRightWidth: "1px",
          borderBottomWidth: "1px",
          cursor: "pointer",
        }}
        onClick={onNavigateToDetail}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full flex items-center justify-center text-wl-text-primary text-xs font-bold"
                style={{ backgroundColor: getStatusColor() }}
              >
                {getStatusIcon()}
              </div>
              <h3 className="text-sm font-semibold text-wl-text-primary">
                {providerName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-medium bg-wl-primary-100 dark:bg-wl-primary-900/30 text-wl-primary-700 dark:text-wl-primary-300">
                {category}
              </span>
              <span className="text-xs text-wl-text-secondary">
                {getStatusLabel()}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-wl-text-secondary hover:text-wl-text-primary transition-colors"
          >
            {expanded ? "▼" : "▶"}
          </button>
        </div>

        {/* Uptime and last check */}
        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-wl-border-subtle">
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Uptime</div>
            <div className="text-lg font-semibold text-wl-text-primary">
              {uptimePercent.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Last Check</div>
            <div className="text-sm font-medium text-wl-text-primary">
              {formatTime(lastCheckTime)}
            </div>
          </div>
        </div>

        {/* Mini sparkline */}
        <div className="mb-4">
          <div className="text-xs text-wl-text-secondary mb-2">24h Health History</div>
          <svg
            width={sparklineWidth}
            height={sparklineHeight}
            className="w-full h-auto"
            viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            <line
              x1="0"
              y1={sparklineHeight / 2}
              x2={sparklineWidth}
              y2={sparklineHeight / 2}
              stroke="var(--wl-border-subtle)"
              strokeWidth="0.5"
            />
            {/* Filled area */}
            <polygon
              points={`0,${sparklineHeight} ${sparklinePoints} ${sparklineWidth},${sparklineHeight}`}
              fill={getStatusColor()}
              opacity="0.2"
            />
            {/* Line */}
            <polyline
              points={sparklinePoints}
              fill="none"
              stroke={getStatusColor()}
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Expandable details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-wl-border-subtle space-y-4 animate-in fade-in duration-200">
            {/* Latency P95 */}
            {latencyP95 !== undefined && (
              <div>
                <div className="text-xs font-medium text-wl-text-secondary mb-2">
                  Latency (P95)
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-wl-text-primary">
                    {latencyP95}ms
                  </div>
                  <div className="text-xs text-wl-text-secondary">response time</div>
                </div>
              </div>
            )}

            {/* Circuit Breaker State */}
            {circuitBreakerState && (
              <div>
                <div className="text-xs font-medium text-wl-text-secondary mb-2">
                  Circuit Breaker
                </div>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${circuitBreakerColor}15`,
                    color: circuitBreakerColor,
                    border: `1px solid ${circuitBreakerColor}40`,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: circuitBreakerColor }}
                  />
                  {circuitBreakerState.charAt(0).toUpperCase() +
                    circuitBreakerState.slice(1)}
                </div>
              </div>
            )}

            {/* Recent Errors */}
            {recentErrors && recentErrors.length > 0 && (
              <div>
                <div className="text-xs font-medium text-wl-text-secondary mb-2">
                  Recent Errors ({recentErrors.length})
                </div>
                <div className="space-y-2">
                  {recentErrors.slice(0, 3).map((error, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-wl-danger-100 dark:bg-wl-danger-900/30 border border-wl-danger-200 dark:border-wl-danger-800"
                    >
                      <div className="text-xs text-wl-danger-700 dark:text-wl-danger-300 break-words">
                        {error}
                      </div>
                    </div>
                  ))}
                  {recentErrors.length > 3 && (
                    <div className="text-xs text-wl-text-secondary">
                      +{recentErrors.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
