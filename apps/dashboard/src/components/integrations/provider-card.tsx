"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type {
  ProviderCardProps,
  IntegrationConnection as Provider,
} from "./types";

/**
 * Provider card component
 * Displays a single integration provider with status, metrics, and quick actions
 * Features: status indicator with pulse animation, metrics overview, quick actions
 */
export function ProviderCard({
  provider,
  onConfigure,
  onTest,
  onDisconnect,
  className,
}: ProviderCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Get status badge color
  const getStatusColor = (): string => {
    switch (provider.status) {
      case "connected":
        return "var(--wl-success-500)";
      case "disconnected":
        return "var(--wl-border-subtle)";
      case "error":
        return "var(--wl-danger-500)";
      case "connecting":
        return "var(--wl-warning-500)";
      default:
        return "var(--wl-border-subtle)";
    }
  };

  const getStatusLabel = (): string => {
    switch (provider.status) {
      case "connected":
        return "Connected";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Error";
      case "connecting":
        return "Connecting...";
      default:
        return "Unknown";
    }
  };

  // Calculate sparkline data and dimensions
  const sparklineData = useMemo(() => {
    const width = 60;
    const height = 20;
    const padding = 2;
    const data = provider.metrics.requestTrend;
    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((value, idx) => {
      const x =
        padding + (idx / (data.length - 1 || 1)) * (width - padding * 2);
      const normalized = (value - min) / range;
      const y = height - padding - normalized * (height - padding * 2);
      return [x, y];
    });

    return { points, width, height, max };
  }, [provider.metrics.requestTrend]);

  const handleTest = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onTest?.(provider.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigure = () => {
    onConfigure?.(provider.id);
  };

  const handleDisconnect = () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setConfirmDisconnect(false);
    onDisconnect?.(provider.id);
  };

  return (
    <div
      className={cn(
        "border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-4 transition-all duration-200 hover:border-wl-border-default hover:shadow-sm",
        className,
      )}
    >
      {/* Header with provider name and status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-wl-text-primary mb-1">
            {provider.name}
          </h3>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                provider.status === "connected" && "animate-pulse",
              )}
              style={{ backgroundColor: getStatusColor() }}
            />
            <span className="text-xs text-wl-text-secondary">
              {getStatusLabel()}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            provider.isActive
              ? "bg-wl-success-100 text-wl-success-700 dark:bg-wl-success-900/30 dark:text-wl-success-300"
              : "bg-wl-surface-hover text-wl-text-secondary",
          )}
        >
          {provider.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-wl-border-subtle">
        {/* Success rate */}
        <div>
          <div className="text-xs text-wl-text-secondary mb-1">
            Success Rate
          </div>
          <div className="text-lg font-semibold text-wl-text-primary">
            {Math.round(provider.metrics.successRate * 100)}%
          </div>
        </div>

        {/* Latency */}
        <div>
          <div className="text-xs text-wl-text-secondary mb-1">Latency</div>
          <div className="text-lg font-semibold text-wl-text-primary">
            {Math.round(provider.metrics.averageLatencyMs)}ms
          </div>
        </div>

        {/* Request count */}
        <div>
          <div className="text-xs text-wl-text-secondary mb-1">Requests</div>
          <div className="text-lg font-semibold text-wl-text-primary">
            {provider.metrics.requestCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Sparkline chart for request trend */}
      <div className="mb-4">
        <div className="text-xs text-wl-text-secondary mb-2">
          Last 24h Trend
        </div>
        <svg
          width="100%"
          height="24"
          viewBox={`0 0 ${sparklineData.width} ${sparklineData.height}`}
          className="overflow-visible"
          style={{ minHeight: "24px" }}
        >
          {/* Grid lines */}
          <line
            x1="0"
            y1={sparklineData.height / 2}
            x2={sparklineData.width}
            y2={sparklineData.height / 2}
            stroke="var(--wl-border-subtle)"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />

          {/* Trend line */}
          {sparklineData.points.length > 1 && (
            <>
              {/* Fill area */}
              <path
                d={`M ${sparklineData.points[0][0]} ${sparklineData.height} L ${sparklineData.points
                  .map((p) => `${p[0]} ${p[1]}`)
                  .join(
                    " L ",
                  )} L ${sparklineData.points[sparklineData.points.length - 1][0]} ${
                  sparklineData.height
                } Z`}
                fill="var(--wl-primary-400)"
                fillOpacity="0.1"
              />

              {/* Line */}
              <polyline
                points={sparklineData.points
                  .map((p) => `${p[0]},${p[1]}`)
                  .join(" ")}
                fill="none"
                stroke="var(--wl-primary-500)"
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>
      </div>

      {/* Last sync info */}
      {provider.lastSyncAt && (
        <div className="mb-4 pb-4 border-b border-wl-border-subtle">
          <div className="text-xs text-wl-text-secondary">
            Last sync: {new Date(provider.lastSyncAt).toLocaleString()}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleConfigure}
          className={cn(
            "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
            "bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200",
            "dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50",
          )}
        >
          Configure
        </button>

        <button
          onClick={handleTest}
          disabled={isLoading}
          className={cn(
            "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
            "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle",
            "dark:bg-wl-surface-hover dark:hover:bg-wl-border-default",
            isLoading && "opacity-60 cursor-not-allowed",
          )}
        >
          {isLoading ? "Testing..." : "Test"}
        </button>

        {confirmDisconnect ? (
          <div className="flex-1 flex gap-1">
            <button
              onClick={() => setConfirmDisconnect(false)}
              className={cn(
                "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
                "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle",
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnect}
              className={cn(
                "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
                "bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200",
                "dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50",
              )}
            >
              Confirm
            </button>
          </div>
        ) : (
          <button
            onClick={handleDisconnect}
            className={cn(
              "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
              "bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200",
              "dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50",
            )}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
