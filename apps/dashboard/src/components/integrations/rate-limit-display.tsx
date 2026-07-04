"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { RateLimitDisplayProps } from "./types";

/**
 * Rate limit display component
 * Visualizes rate limit usage with progress bars and historical data
 */
export function RateLimitDisplay({
  rateLimit,
  endpoints,
  className,
}: RateLimitDisplayProps) {
  // Calculate usage percentage
  const usagePercent = useMemo(() => {
    return Math.min((rateLimit.current / rateLimit.limit) * 100, 100);
  }, [rateLimit.current, rateLimit.limit]);

  // Get color based on usage
  const getUsageColor = (): string => {
    if (usagePercent < 60) return 'var(--wl-success-500)';
    if (usagePercent < 80) return 'var(--wl-warning-500)';
    return 'var(--wl-danger-500)';
  };

  // Calculate time until reset
  const getResetTimeDisplay = (): string => {
    const now = new Date();
    const diff = rateLimit.resetAt.getTime() - now.getTime();

    if (diff <= 0) return 'Resetting now...';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
    return `${seconds}s remaining`;
  };

  // Generate historical usage chart from current data point only
  const generateHistoricalChart = () => {
    const width = 300;
    const height = 60;
    const padding = 5;
    const dataPoints = 1;

    const historicalData = [rateLimit.current];

    const max = Math.max(...historicalData, rateLimit.limit);
    const range = max || 1;

    const points = historicalData.map((value, idx) => {
      const x = padding + (idx / (dataPoints - 1)) * (width - padding * 2);
      const normalized = value / max;
      const y = height - padding - normalized * (height - padding * 2);
      return [x, y];
    });

    return (
      <svg width="100%" height={height + 20} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Grid line */}
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--wl-border-subtle)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* Fill area */}
        {points.length > 1 && (
          <path
            d={`M ${padding} ${height - padding} L ${points.map((p) => `${p[0]} ${p[1]}`).join(' L ')} L ${width - padding} ${height - padding} Z`}
            fill="var(--wl-primary-400)"
            fillOpacity="0.1"
          />
        )}

        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke="var(--wl-primary-500)"
            strokeWidth="1.5"
          />
        )}

        {/* Current usage indicator */}
        <line
          x1={width - padding}
          y1="0"
          x2={width - padding}
          y2={height}
          stroke="var(--wl-warning-500)"
          strokeWidth="1"
          opacity="0.7"
        />
      </svg>
    );
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="space-y-6">
        {/* Main rate limit display */}
        <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-wl-text-primary">Rate Limit Status</h3>
            <div className="text-right">
              <div className="text-xs text-wl-text-secondary">Resets in</div>
              <div className="text-sm font-medium text-wl-text-primary">
                {getResetTimeDisplay()}
              </div>
            </div>
          </div>

          {/* Usage bars */}
          <div className="space-y-4">
            {/* Sustained limit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-wl-text-primary">
                  Sustained Limit
                </label>
                <span className="text-sm text-wl-text-secondary">
                  {rateLimit.current} / {rateLimit.limit}
                </span>
              </div>
              <div className="relative h-8 bg-wl-surface-hover rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${usagePercent}%`,
                    backgroundColor: getUsageColor(),
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-wl-text-secondary">
                <span>0%</span>
                <span>
                  {usagePercent < 60 ? '✓ Good' : usagePercent < 80 ? '⚠ Caution' : '✗ Critical'}
                </span>
                <span>100%</span>
              </div>
            </div>

            {/* Burst limit (if available) */}
            {rateLimit.burstLimit && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-wl-text-primary">
                    Burst Limit
                  </label>
                  <span className="text-sm text-wl-text-secondary">
                    {rateLimit.burstCurrent || 0} / {rateLimit.burstLimit}
                  </span>
                </div>
                <div className="relative h-6 bg-wl-surface-hover rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg bg-wl-warning-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        ((rateLimit.burstCurrent || 0) / rateLimit.burstLimit) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Historical usage */}
        <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <h3 className="text-sm font-semibold text-wl-text-secondary mb-4">Last Hour Usage</h3>
          {generateHistoricalChart()}
        </div>

        {/* Per-endpoint breakdown */}
        {endpoints && endpoints.length > 0 && (
          <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
            <h3 className="text-sm font-semibold text-wl-text-secondary mb-4">Per-Endpoint Usage</h3>
            <div className="space-y-3">
              {endpoints.map((endpoint) => {
                const endpointUsagePercent = Math.min((endpoint.current / endpoint.limit) * 100, 100);
                const endpointColor =
                  endpointUsagePercent < 60
                    ? 'var(--wl-success-500)'
                    : endpointUsagePercent < 80
                      ? 'var(--wl-warning-500)'
                      : 'var(--wl-danger-500)';

                return (
                  <div key={endpoint.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-wl-text-primary">
                        {endpoint.name}
                      </span>
                      <span className="text-xs text-wl-text-secondary">
                        {endpoint.current} / {endpoint.limit}
                      </span>
                    </div>
                    <div className="relative h-2 bg-wl-surface-hover rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${endpointUsagePercent}%`,
                          backgroundColor: endpointColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info card */}
        <div
          className={cn(
            'border rounded-lg p-4 text-sm',
            'bg-wl-primary-100 border-wl-primary-200 text-wl-primary-700',
            'dark:bg-wl-primary-900/30 dark:border-wl-primary-800 dark:text-wl-primary-300'
          )}
        >
          <p className="font-medium mb-1">Rate Limit Information</p>
          <ul className="text-xs space-y-1">
            <li>• Sustained requests: {rateLimit.limit} per hour</li>
            {rateLimit.burstLimit && (
              <li>• Burst capacity: {rateLimit.burstLimit} requests</li>
            )}
            <li>• Current usage: {usagePercent.toFixed(1)}%</li>
            <li>• Resets at: {rateLimit.resetAt.toLocaleTimeString()}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
